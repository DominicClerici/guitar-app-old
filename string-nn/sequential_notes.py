"""
Sequential note generation for training on fast playing with note transitions.

This module creates synthetic training samples that simulate realistic guitar
playing patterns where multiple notes are played in quick succession. This helps
the model handle windows that contain note transitions.
"""

import numpy as np
import librosa
from pathlib import Path
from dataclasses import dataclass


@dataclass
class NoteRegion:
    """Represents a note's position in the combined audio."""
    start_sample: int
    end_sample: int
    string: int
    fret: int


@dataclass
class SequentialAudioResult:
    """Result of generating sequential audio."""
    audio: np.ndarray
    note_regions: list[NoteRegion]
    sequence_id: str


class SequentialNoteGenerator:
    """
    Generates sequential note audio clips to train the model on handling
    fast playing with note transitions.

    Movement constraints follow realistic guitar playing patterns:
    - Can move up/down 1 string or stay on same string
    - Can move left/right 2 frets or stay on same fret
    - If changing strings significantly, fret movement is limited
    - Each note in sequence must be unique (different string OR different fret)
    """

    MAX_STRING_CHANGE = 1
    MAX_FRET_CHANGE = 2

    def __init__(
        self,
        samples: list[tuple[Path, int, int]],
        target_sr: int = 44100,
        gap_min_ms: float = 1.0,
        gap_max_ms: float = 15.0,
        sequence_length_min: int = 3,
        sequence_length_max: int = 5,
        note_duration_ms: float = 150.0,
        seed: int | None = None,
    ):
        """
        Args:
            samples: List of (path, string, fret) tuples for all available samples
            target_sr: Target sample rate
            gap_min_ms: Minimum gap between notes in milliseconds
            gap_max_ms: Maximum gap between notes in milliseconds
            sequence_length_min: Minimum notes in a sequence
            sequence_length_max: Maximum notes in a sequence
            note_duration_ms: How much of each note to include (from start)
            seed: Random seed for reproducibility
        """
        self.samples = samples
        self.target_sr = target_sr
        self.gap_min_samples = int(gap_min_ms * target_sr / 1000)
        self.gap_max_samples = int(gap_max_ms * target_sr / 1000)
        self.sequence_length_min = sequence_length_min
        self.sequence_length_max = sequence_length_max
        self.note_duration_samples = int(note_duration_ms * target_sr / 1000)
        self._rng = np.random.default_rng(seed)

        # Build index for quick lookup by (string, fret)
        self._samples_by_position: dict[tuple[int, int], list[Path]] = {}
        for path, string, fret in samples:
            key = (string, fret)
            if key not in self._samples_by_position:
                self._samples_by_position[key] = []
            self._samples_by_position[key].append(path)

        self._positions = list(self._samples_by_position.keys())
        print(f"SequentialNoteGenerator initialized with {len(samples)} samples "
              f"across {len(self._positions)} unique positions")

    def get_valid_next_positions(
        self,
        current_string: int,
        current_fret: int,
        visited: set[tuple[int, int]] | None = None,
    ) -> list[tuple[int, int]]:
        """
        Get all valid next positions from current position.

        Movement rules:
        - String can change by ±1 or stay same
        - Fret can change by ±2 or stay same
        - Must move (can't repeat exact same position)
        - If changing strings, fret change limited to ±1 (more realistic)
        """
        valid = []
        visited = visited or set()

        for ds in range(-self.MAX_STRING_CHANGE, self.MAX_STRING_CHANGE + 1):
            for df in range(-self.MAX_FRET_CHANGE, self.MAX_FRET_CHANGE + 1):
                # Must move either string OR fret
                if ds == 0 and df == 0:
                    continue

                # If changing strings, limit fret movement (realistic constraint)
                if ds != 0 and abs(df) > 1:
                    continue

                new_string = current_string + ds
                new_fret = current_fret + df

                # Check bounds
                if not (0 <= new_string <= 5 and new_fret >= 0):
                    continue

                # Check if we have samples for this position
                pos = (new_string, new_fret)
                if pos not in self._samples_by_position:
                    continue

                # Skip already visited positions in this sequence
                if pos in visited:
                    continue

                valid.append(pos)

        return valid

    def generate_sequence(self) -> list[tuple[Path, int, int]] | None:
        """
        Generate a valid sequence of notes following movement constraints.

        Returns:
            List of (path, string, fret) tuples, or None if generation failed
        """
        # Start from a random sample
        start_idx = self._rng.integers(0, len(self.samples))
        path, string, fret = self.samples[start_idx]

        sequence = [(path, string, fret)]
        visited = {(string, fret)}

        sequence_length = self._rng.integers(
            self.sequence_length_min,
            self.sequence_length_max + 1
        )

        for _ in range(sequence_length - 1):
            valid_next = self.get_valid_next_positions(string, fret, visited)
            if not valid_next:
                break

            # Pick random next position
            next_string, next_fret = valid_next[self._rng.integers(0, len(valid_next))]

            # Pick random sample from that position
            available = self._samples_by_position[(next_string, next_fret)]
            next_path = available[self._rng.integers(0, len(available))]

            sequence.append((next_path, next_string, next_fret))
            visited.add((next_string, next_fret))
            string, fret = next_string, next_fret

        if len(sequence) >= self.sequence_length_min:
            return sequence
        return None

    def create_sequential_audio(
        self,
        sequence: list[tuple[Path, int, int]],
        sequence_idx: int,
    ) -> SequentialAudioResult | None:
        """
        Create audio from a sequence of notes with small gaps between them.

        Each note is trimmed to note_duration_ms from its attack, simulating
        fast playing where notes don't ring out fully.

        Args:
            sequence: List of (path, string, fret) tuples
            sequence_idx: Index for naming the sequence

        Returns:
            SequentialAudioResult with combined audio and note regions
        """
        audio_segments = []
        note_regions = []
        current_position = 0

        for i, (path, string, fret) in enumerate(sequence):
            try:
                y, sr = librosa.load(str(path), sr=self.target_sr)
            except Exception as e:
                print(f"Warning: Failed to load {path}: {e}")
                return None

            # Trim silence from start
            y_trimmed, trim_indices = librosa.effects.trim(y, top_db=20)
            if len(y_trimmed) > sr * 0.05:
                y = y_trimmed

            # Limit note duration to simulate fast playing
            max_samples = min(len(y), self.note_duration_samples)
            y = y[:max_samples]

            # Apply quick fade out to avoid clicks
            fade_len = min(100, len(y) // 4)
            if fade_len > 0:
                fade = np.linspace(1.0, 0.0, fade_len)
                y[-fade_len:] *= fade

            # Record note region
            note_start = current_position
            note_end = current_position + len(y)
            note_regions.append(NoteRegion(
                start_sample=note_start,
                end_sample=note_end,
                string=string,
                fret=fret,
            ))

            audio_segments.append(y)
            current_position = note_end

            # Add gap (except after last note)
            if i < len(sequence) - 1:
                gap_samples = self._rng.integers(
                    self.gap_min_samples,
                    self.gap_max_samples + 1
                )
                gap = np.zeros(gap_samples)
                audio_segments.append(gap)
                current_position += gap_samples

        combined_audio = np.concatenate(audio_segments)

        # Generate sequence ID from components
        seq_parts = [f"s{s}f{f}" for _, s, f in sequence]
        sequence_id = f"seq{sequence_idx}_{'_'.join(seq_parts)}"

        return SequentialAudioResult(
            audio=combined_audio,
            note_regions=note_regions,
            sequence_id=sequence_id,
        )

    def get_window_label(
        self,
        window_start: int,
        window_end: int,
        note_regions: list[NoteRegion],
    ) -> tuple[int, int]:
        """
        Determine the label for a window based on which note is dominant.

        The dominant note is the one with the most samples overlapping
        the window. This teaches the model to identify the "main" note
        even when there are remnants of previous notes.

        Args:
            window_start: Start sample index of the window
            window_end: End sample index of the window
            note_regions: List of NoteRegion objects

        Returns:
            (string, fret) of the dominant note
        """
        max_overlap = 0
        dominant_string = note_regions[0].string
        dominant_fret = note_regions[0].fret

        for region in note_regions:
            # Calculate overlap between window and note
            overlap_start = max(window_start, region.start_sample)
            overlap_end = min(window_end, region.end_sample)
            overlap = max(0, overlap_end - overlap_start)

            if overlap > max_overlap:
                max_overlap = overlap
                dominant_string = region.string
                dominant_fret = region.fret

        return dominant_string, dominant_fret

    def generate_samples(
        self,
        num_sequences: int,
        max_attempts: int = 3,
    ) -> list[SequentialAudioResult]:
        """
        Generate multiple sequential audio samples.

        Args:
            num_sequences: Target number of sequences to generate
            max_attempts: Max attempts per sequence before giving up

        Returns:
            List of SequentialAudioResult objects
        """
        results = []
        attempts = 0
        max_total_attempts = num_sequences * max_attempts * 2

        while len(results) < num_sequences and attempts < max_total_attempts:
            attempts += 1

            sequence = self.generate_sequence()
            if sequence is None:
                continue

            result = self.create_sequential_audio(sequence, len(results))
            if result is not None:
                results.append(result)

        print(f"Generated {len(results)} sequential samples from {attempts} attempts")
        return results
