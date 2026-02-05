import os
import json
import argparse
import numpy as np
import librosa
from datetime import datetime
from pathlib import Path
from typing import TypedDict
import time

from collections import defaultdict
from utils.freq_estimation import (
    freq_from_autocorr,
    freq_from_hps,
)
from augment import AudioAugmenter, AugmentationConfig, create_augmenter
from dataclasses import dataclass
from sequential_notes import SequentialNoteGenerator, SequentialAudioResult, NoteRegion


# WINDOW_SIZE = 4096  # ~93ms at 44.1kHz, matches browser inference
WINDOW_SIZE = 4096  # ~69ms at 44.1kHz, matches browser inference

# Amplitude normalization to match browser inference exactly
# See: frontend/hooks/useStringClassifier.ts
TARGET_RMS = 0.035

USE_AUGMENTATION = True
NUM_AUGMENTATIONS = 2
AUGMENTATION_PRESET = "moderate"

USE_FINETUNE_SAMPLES = True

# String layering configuration - simulates adjacent string interference
USE_STRING_LAYERING = True
STRING_LAYER_PROBABILITY = 0.25  # 25% of samples get layered (1 in 4)
STRING_LAYER_VOLUME_MIN = 0.15   # Minimum volume ratio for layer (relative to main)
STRING_LAYER_VOLUME_MAX = 0.35   # Maximum volume ratio for layer

# Adjacent strings that can interfere (indexed 0-5: low E, A, D, G, B, high E)
ADJACENT_STRINGS = {
    0: [1],        # Low E -> A
    1: [0, 2],     # A -> Low E, D
    2: [1, 3],     # D -> A, G
    3: [2, 4],     # G -> D, B
    4: [3, 5],     # B -> G, High E
    5: [4],        # High E -> B
}

# Sequential note generation - simulates fast playing with note transitions
USE_SEQUENTIAL_NOTES = False
SEQUENTIAL_RATIO = 0.25  # Generate 20% of sample count as sequential clips
SEQUENTIAL_GAP_MIN_MS = 0.0  # Minimum gap between notes
SEQUENTIAL_GAP_MAX_MS = 15.0  # Maximum gap between notes
SEQUENTIAL_LENGTH_MIN = 3  # Minimum notes per sequence
SEQUENTIAL_LENGTH_MAX = 5  # Maximum notes per sequence
SEQUENTIAL_NOTE_DURATION_MS = 100.0  # How much of each note to include

# Sliding window sequence generation - simulates production rolling window environment
# This creates long sequences of notes and extracts windows with a hop size matching production
USE_SLIDING_WINDOW_SEQUENCES = True
SLIDING_WINDOW_HOP_SIZE = 512  # Hop size in samples (matches production inference)
SLIDING_WINDOW_GAP_MIN_MS = 0.0  # Minimum gap between notes in ms
SLIDING_WINDOW_GAP_MAX_MS = 50.0  # Maximum gap between notes in ms
SLIDING_WINDOW_NUM_TRAIN_SEQUENCES = 200  # Number of training sequences to generate
SLIDING_WINDOW_NUM_VAL_SEQUENCES = 50  # Number of validation sequences to generate
SLIDING_WINDOW_NOTES_PER_SEQUENCE = 25  # Number of notes per sequence
SLIDING_WINDOW_NOTE_DURATION_MS = 400.0  # Duration of each note in sequence (longer for realism)
SLIDING_WINDOW_ONLY_MODE = False  # If True, train ONLY on sliding window sequences

# Open string frequencies by string number (0-5, matching sample directory structure)
# String 0 = low E (thickest), String 5 = high E (thinnest)
OPEN_STRING_FREQS_BY_NUMBER = {
    0: 82.41,   # low E
    1: 110.00,  # A
    2: 146.83,  # D
    3: 196.00,  # G
    4: 246.94,  # B
    5: 329.63,  # high E
}


class StringLayerMixer:
    """
    Loads and mixes open string layer samples to simulate adjacent string interference.

    This helps train the model to be robust when a player accidentally bumps
    or doesn't fully mute adjacent strings while playing.
    """

    def __init__(
        self,
        layer_samples_dir: Path,
        target_sr: int = 44100,
        volume_min: float = STRING_LAYER_VOLUME_MIN,
        volume_max: float = STRING_LAYER_VOLUME_MAX,
        seed: int | None = None,
    ):
        self.layer_samples_dir = layer_samples_dir
        self.target_sr = target_sr
        self.volume_min = volume_min
        self.volume_max = volume_max
        self._rng = np.random.default_rng(seed)

        # Cache of loaded layer samples: {string_num: [audio_arrays]}
        self._layer_cache: dict[int, list[np.ndarray]] = {}
        self._load_layer_samples()

    def _load_layer_samples(self):
        """Load all layer samples from disk into memory."""
        if not self.layer_samples_dir.exists():
            print(f"Warning: Layer samples directory not found: {self.layer_samples_dir}")
            return

        total_loaded = 0
        for string_num in range(6):
            string_dir = self.layer_samples_dir / str(string_num)
            if not string_dir.exists():
                continue

            self._layer_cache[string_num] = []
            for wav_file in string_dir.glob("*.wav"):
                try:
                    y, sr = librosa.load(str(wav_file), sr=self.target_sr)
                    # Normalize the layer sample
                    rms = np.sqrt(np.mean(y ** 2))
                    if rms > 1e-10:
                        y = y / rms  # Normalize to unit RMS for easier mixing
                    self._layer_cache[string_num].append(y)
                    total_loaded += 1
                except Exception as e:
                    print(f"Warning: Failed to load layer sample {wav_file}: {e}")

        print(f"Loaded {total_loaded} layer samples for {len(self._layer_cache)} strings")

    def has_samples(self) -> bool:
        """Check if any layer samples were loaded."""
        return len(self._layer_cache) > 0

    def get_adjacent_strings(self, string_num: int) -> list[int]:
        """Get list of adjacent strings that have loaded layer samples."""
        adjacent = ADJACENT_STRINGS.get(string_num, [])
        return [s for s in adjacent if s in self._layer_cache and self._layer_cache[s]]

    def get_random_layer(self, string_num: int) -> np.ndarray | None:
        """Get a random layer sample for the specified string."""
        if string_num not in self._layer_cache or not self._layer_cache[string_num]:
            return None
        return self._rng.choice(self._layer_cache[string_num])

    def mix_with_layer(
        self,
        main_audio: np.ndarray,
        main_string: int,
        layer_string: int | None = None,
    ) -> tuple[np.ndarray, int | None]:
        """
        Mix the main audio with a layer sample from an adjacent string.

        Args:
            main_audio: The primary audio sample
            main_string: String number of the main audio (0-5)
            layer_string: Specific string to layer (None = random adjacent)

        Returns:
            Tuple of (mixed_audio, layer_string_used) or (main_audio, None) if no layer applied
        """
        # Get available adjacent strings
        available_adjacent = self.get_adjacent_strings(main_string)
        if not available_adjacent:
            return main_audio, None

        # Select which adjacent string to use
        if layer_string is not None and layer_string in available_adjacent:
            selected_string = layer_string
        else:
            selected_string = self._rng.choice(available_adjacent)

        # Get a random layer sample
        layer_audio = self.get_random_layer(selected_string)
        if layer_audio is None:
            return main_audio, None

        # Calculate random volume ratio
        volume_ratio = self._rng.uniform(self.volume_min, self.volume_max)

        # Calculate the RMS of the main audio to scale the layer appropriately
        main_rms = np.sqrt(np.mean(main_audio ** 2))
        if main_rms < 1e-10:
            return main_audio, None

        # Scale layer to target volume relative to main
        scaled_layer = layer_audio * (main_rms * volume_ratio)

        # Handle length differences
        main_len = len(main_audio)
        layer_len = len(scaled_layer)

        if layer_len >= main_len:
            # Layer is longer or equal - randomly select starting position
            max_start = layer_len - main_len
            start_pos = self._rng.integers(0, max_start + 1)
            layer_segment = scaled_layer[start_pos:start_pos + main_len]
        else:
            # Layer is shorter - pad with zeros or loop
            # Use random start position within main audio
            layer_segment = np.zeros(main_len)
            max_start = main_len - layer_len
            start_pos = self._rng.integers(0, max_start + 1)
            layer_segment[start_pos:start_pos + layer_len] = scaled_layer

        # Mix the audio
        mixed = main_audio + layer_segment

        # Soft clip to prevent harsh distortion while preserving dynamics
        max_val = np.max(np.abs(mixed))
        if max_val > 1.0:
            mixed = np.tanh(mixed / max_val) * 0.99

        return mixed, selected_string


@dataclass
class SlidingWindowNoteRegion:
    """Represents a note's position in a sliding window sequence."""
    start_sample: int
    end_sample: int
    string: int
    fret: int
    source_path: Path


@dataclass
class SlidingWindowSequenceResult:
    """Result of generating a sliding window sequence."""
    audio: np.ndarray
    note_regions: list[SlidingWindowNoteRegion]
    sequence_id: str
    is_validation: bool


class SlidingWindowSequenceGenerator:
    """
    Generates long audio sequences from individual note samples, then extracts
    overlapping windows with a fixed hop size to simulate production inference.

    This better replicates the production environment where the model processes
    a rolling window of audio with significant overlap between consecutive windows.

    Key differences from SequentialNoteGenerator:
    - Uses configurable hop size (default 512 samples) instead of 50% overlap
    - Labels transition windows with the INCOMING note (not dominant overlap)
    - Designed for longer sequences with more notes
    - Augmentation is applied to entire sequences, not individual notes
    """

    def __init__(
        self,
        samples: list[tuple[Path, int, int]],
        target_sr: int = 44100,
        window_size: int = WINDOW_SIZE,
        hop_size: int = SLIDING_WINDOW_HOP_SIZE,
        gap_min_ms: float = SLIDING_WINDOW_GAP_MIN_MS,
        gap_max_ms: float = SLIDING_WINDOW_GAP_MAX_MS,
        notes_per_sequence: int = SLIDING_WINDOW_NOTES_PER_SEQUENCE,
        note_duration_ms: float = SLIDING_WINDOW_NOTE_DURATION_MS,
        seed: int | None = None,
    ):
        """
        Args:
            samples: List of (path, string, fret) tuples for available samples
            target_sr: Target sample rate
            window_size: Window size in samples (default 4096)
            hop_size: Hop size in samples (default 512, matching production)
            gap_min_ms: Minimum gap between notes in milliseconds (0-50ms)
            gap_max_ms: Maximum gap between notes in milliseconds (0-50ms)
            notes_per_sequence: Number of notes per sequence
            note_duration_ms: Duration of each note in the sequence
            seed: Random seed for reproducibility
        """
        self.samples = samples
        self.target_sr = target_sr
        self.window_size = window_size
        self.hop_size = hop_size
        self.gap_min_samples = int(gap_min_ms * target_sr / 1000)
        self.gap_max_samples = int(gap_max_ms * target_sr / 1000)
        self.notes_per_sequence = notes_per_sequence
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
        print(f"SlidingWindowSequenceGenerator: {len(samples)} samples, "
              f"{len(self._positions)} positions, hop={hop_size}")

    def _load_and_prepare_note(self, path: Path) -> np.ndarray | None:
        """Load a note sample and prepare it for sequencing."""
        try:
            y, sr = librosa.load(str(path), sr=self.target_sr)
        except Exception as e:
            print(f"Warning: Failed to load {path}: {e}")
            return None

        # Trim silence from start
        y_trimmed, _ = librosa.effects.trim(y, top_db=20)
        if len(y_trimmed) > self.target_sr * 0.05:
            y = y_trimmed

        # Limit note duration
        max_samples = min(len(y), self.note_duration_samples)
        y = y[:max_samples]

        # Apply fade out to avoid clicks
        fade_len = min(200, len(y) // 4)
        if fade_len > 0:
            fade = np.linspace(1.0, 0.0, fade_len)
            y[-fade_len:] *= fade

        return y

    def generate_sequence(self, sequence_idx: int, is_validation: bool = False) -> SlidingWindowSequenceResult | None:
        """
        Generate a single sequence by concatenating random notes with gaps.

        Args:
            sequence_idx: Index for naming the sequence
            is_validation: Whether this is for the validation set

        Returns:
            SlidingWindowSequenceResult with audio and note regions
        """
        audio_segments = []
        note_regions = []
        current_position = 0

        # Pick random notes for the sequence
        for note_idx in range(self.notes_per_sequence):
            # Pick random position
            pos_idx = self._rng.integers(0, len(self._positions))
            string, fret = self._positions[pos_idx]

            # Pick random sample from that position
            available = self._samples_by_position[(string, fret)]
            path = available[self._rng.integers(0, len(available))]

            # Load and prepare the note
            y = self._load_and_prepare_note(path)
            if y is None:
                continue

            # Record note region
            note_start = current_position
            note_end = current_position + len(y)
            note_regions.append(SlidingWindowNoteRegion(
                start_sample=note_start,
                end_sample=note_end,
                string=string,
                fret=fret,
                source_path=path,
            ))

            audio_segments.append(y)
            current_position = note_end

            # Add gap (except after last note)
            if note_idx < self.notes_per_sequence - 1:
                gap_samples = self._rng.integers(
                    self.gap_min_samples,
                    max(self.gap_min_samples + 1, self.gap_max_samples + 1)
                )
                if gap_samples > 0:
                    gap = np.zeros(gap_samples)
                    audio_segments.append(gap)
                    current_position += gap_samples

        if len(note_regions) < 2:
            return None

        combined_audio = np.concatenate(audio_segments)

        # Generate sequence ID
        prefix = "swval" if is_validation else "swtrain"
        sequence_id = f"{prefix}_{sequence_idx}"

        return SlidingWindowSequenceResult(
            audio=combined_audio,
            note_regions=note_regions,
            sequence_id=sequence_id,
            is_validation=is_validation,
        )

    def get_window_label(
        self,
        window_start: int,
        window_end: int,
        note_regions: list[SlidingWindowNoteRegion],
    ) -> tuple[int, int]:
        """
        Determine the label for a window.

        Labeling strategy:
        - If only one note overlaps the window, use that note's label
        - If two notes overlap (transition), use the INCOMING (later) note's label
          This teaches the model to quickly recognize new notes as they start

        Args:
            window_start: Start sample index of the window
            window_end: End sample index of the window
            note_regions: List of SlidingWindowNoteRegion objects

        Returns:
            (string, fret) of the note to use as label
        """
        overlapping_notes = []

        for region in note_regions:
            # Calculate overlap
            overlap_start = max(window_start, region.start_sample)
            overlap_end = min(window_end, region.end_sample)
            overlap = max(0, overlap_end - overlap_start)

            if overlap > 0:
                overlapping_notes.append((region, overlap))

        if not overlapping_notes:
            # No overlap - find nearest note
            min_dist = float('inf')
            nearest_region = note_regions[0]
            for region in note_regions:
                dist_start = abs(window_start - region.end_sample)
                dist_end = abs(window_end - region.start_sample)
                dist = min(dist_start, dist_end)
                if dist < min_dist:
                    min_dist = dist
                    nearest_region = region
            return nearest_region.string, nearest_region.fret

        if len(overlapping_notes) == 1:
            # Single note - use it
            region, _ = overlapping_notes[0]
            return region.string, region.fret

        # Multiple notes (transition) - use the one that starts later (incoming note)
        overlapping_notes.sort(key=lambda x: x[0].start_sample)
        incoming_region = overlapping_notes[-1][0]
        return incoming_region.string, incoming_region.fret

    def extract_sliding_windows(
        self,
        sequence_result: SlidingWindowSequenceResult,
    ) -> list[tuple[np.ndarray, int, int, int, float]]:
        """
        Extract sliding windows from a sequence with proper labels.

        Args:
            sequence_result: The sequence to extract windows from

        Returns:
            List of (window_audio, string, fret, window_idx, transition_likelihood)
        """
        audio = sequence_result.audio
        note_regions = sequence_result.note_regions
        windows = []

        for win_idx, start in enumerate(range(0, len(audio) - self.window_size + 1, self.hop_size)):
            window = audio[start:start + self.window_size]
            window_end = start + self.window_size

            # Get label for this window
            string, fret = self.get_window_label(start, window_end, note_regions)

            # Check if this is a transition window (overlaps multiple notes)
            overlapping_count = 0
            for region in note_regions:
                overlap_start = max(start, region.start_sample)
                overlap_end = min(window_end, region.end_sample)
                if overlap_end > overlap_start:
                    overlapping_count += 1

            transition_likelihood = 1.0 if overlapping_count > 1 else 0.0

            windows.append((window, string, fret, win_idx, transition_likelihood))

        return windows

    def generate_sequences(
        self,
        num_train: int,
        num_val: int,
        max_attempts_per_sequence: int = 3,
    ) -> tuple[list[SlidingWindowSequenceResult], list[SlidingWindowSequenceResult]]:
        """
        Generate training and validation sequences.

        Args:
            num_train: Number of training sequences
            num_val: Number of validation sequences
            max_attempts_per_sequence: Max attempts per sequence before giving up

        Returns:
            Tuple of (train_sequences, val_sequences)
        """
        train_sequences = []
        val_sequences = []

        # Generate training sequences
        attempts = 0
        max_attempts = num_train * max_attempts_per_sequence
        while len(train_sequences) < num_train and attempts < max_attempts:
            attempts += 1
            result = self.generate_sequence(len(train_sequences), is_validation=False)
            if result is not None:
                train_sequences.append(result)

        # Generate validation sequences
        attempts = 0
        max_attempts = num_val * max_attempts_per_sequence
        while len(val_sequences) < num_val and attempts < max_attempts:
            attempts += 1
            result = self.generate_sequence(len(val_sequences), is_validation=True)
            if result is not None:
                val_sequences.append(result)

        print(f"Generated {len(train_sequences)} train / {len(val_sequences)} val sliding window sequences")
        return train_sequences, val_sequences


def calculate_expected_frequency(string: int, fret: int) -> float:
    """Calculate the expected fundamental frequency for a given string and fret."""
    if string not in OPEN_STRING_FREQS_BY_NUMBER:
        return 0.0
    open_freq = OPEN_STRING_FREQS_BY_NUMBER[string]
    return open_freq * (2 ** (fret / 12))


class DiscardedSample(TypedDict):
    sample_id: str
    string: int
    fret: int
    detected_freq: float
    expected_freq: float


def should_skip_frequency_validation(sample_id: str) -> bool:
    """
    Check if a sample should skip frequency validation.

    Excluded samples:
    - Layered samples: have adjacent string interference that affects frequency detection
    - Sequential samples (seq*): may contain multiple notes, detected frequency won't match label
    - Sliding window samples (swtrain*, swval*): windows may span note transitions
    """
    return (
        "_layer" in sample_id or
        sample_id.startswith("seq") or
        sample_id.startswith("swtrain") or
        sample_id.startswith("swval")
    )


def validate_fundamental_frequencies(
    features: list["WindowFeatures"],
    tolerance: float = 0.05
) -> tuple[list["WindowFeatures"], list[DiscardedSample], int]:
    """
    Validate that detected fundamental frequencies are within tolerance of expected values.

    Layered and sequential samples are automatically passed through without validation
    since their frequency detection is expected to be unreliable.

    Args:
        features: List of extracted window features
        tolerance: Allowed deviation from expected frequency (0.05 = ±5%)

    Returns:
        Tuple of (valid_features, discarded_samples)
    """
    valid_features = []
    discarded: dict[str, DiscardedSample] = {}
    skipped_count = 0

    for feature in features:
        string = feature["string"]
        fret = feature["fret"]
        detected_freq = feature["fundamental_freq"]
        sample_id = feature["sample_id"]

        # Skip validation for layered and sequential samples
        if should_skip_frequency_validation(sample_id):
            valid_features.append(feature)
            skipped_count += 1
            continue

        expected_freq = calculate_expected_frequency(string, fret)

        if expected_freq <= 0 or detected_freq <= 0:
            if sample_id not in discarded:
                discarded[sample_id] = DiscardedSample(
                    sample_id=sample_id,
                    string=string,
                    fret=fret,
                    detected_freq=detected_freq,
                    expected_freq=expected_freq,
                )
            continue

        deviation = abs(detected_freq - expected_freq) / expected_freq
        if deviation <= tolerance:
            valid_features.append(feature)
        elif sample_id not in discarded:
            discarded[sample_id] = DiscardedSample(
                sample_id=sample_id,
                string=string,
                fret=fret,
                detected_freq=detected_freq,
                expected_freq=expected_freq,
            )

    return valid_features, sorted(discarded.values(), key=lambda x: x["sample_id"]), skipped_count


def calculate_rms(samples: np.ndarray) -> float:
    """Calculate RMS energy of audio samples. Matches browser's calculateRMS."""
    return float(np.sqrt(np.mean(samples ** 2)))


def normalize_audio_amplitude(samples: np.ndarray, target_rms: float = TARGET_RMS) -> np.ndarray:
    """
    Normalize audio amplitude to target RMS level.
    Matches browser's normalizeAudioAmplitude exactly.
    """
    current_rms = calculate_rms(samples)
    if current_rms < 1e-10:
        return samples

    gain = target_rms / current_rms
    return samples * gain


class WindowFeatures(TypedDict):
    string: int
    fret: int
    sample_id: str
    window_index: int
    fundamental_freq: float
    harmonic_ratios: list[float]
    spectral_centroid: float
    spectral_rolloff: float
    inharmonicity: float
    rms_energy: float
    energy_slope: float  # positive=onset, negative=decay, ~0=sustain
    zcr: float  # zero crossing rate - captures brightness/noisiness
    odd_even_harmonic_ratio: float  # ratio of odd to even harmonic energy
    # Frequency-relative features
    log_frequency: float
    semitones_from_e2: float
    octave_number: int
    # MFCCs (single frame for short window)
    mfcc: list[float]  # 13 MFCCs for the window
    # Transition detection
    transition_likelihood: float  # 0=clean single note, 1=note transition detected


class FeatureExtractor:
    # Standard tuning open string frequencies (Hz)
    OPEN_STRING_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]
    E2_FREQ = 82.41  # Lowest note on standard guitar

    def __init__(self, n_harmonics: int = 12, rolloff_threshold: float = 0.85, n_mfcc: int = 13):
        self.n_harmonics = n_harmonics
        self.rolloff_threshold = rolloff_threshold
        self.n_mfcc = n_mfcc

    def extract_fundamental(self, y: np.ndarray, sr: int) -> float:
        """Extract fundamental frequency using pYIN with autocorrelation fallback."""
        # For now, we are using autocorrelation, but I am leaving pYIN and hps if we need them
        return freq_from_autocorr(y, sr)
        
        # slow but works
        # f0, voiced_flag, voiced_probs = librosa.pyin(
        #     y,
        #     sr=sr,
        #     fmin=50,
        #     fmax=1200,
        #     frame_length=4096,  # Longer frame for better low-freq resolution
        #     fill_na=0.0,
        # )
        # valid_pitches = f0[(voiced_flag) & (voiced_probs > 0.3) & (f0 > 0)]
        # if len(valid_pitches) > 0:
        #     return float(np.median(valid_pitches))

        # Harmonic product spectrum - robust to missing fundamental
        # return freq_from_hps(y, sr)

    def extract_harmonic_ratios(self, y: np.ndarray, sr: int, fundamental: float) -> list[float]:
        """Extract relative amplitudes of harmonics normalized to fundamental."""
        if fundamental <= 0:
            return [0.0] * self.n_harmonics

        # Compute FFT
        n_fft = WINDOW_SIZE
        fft = np.abs(np.fft.rfft(y, n=n_fft))
        freqs = np.fft.rfftfreq(n_fft, 1/sr)

        harmonic_amplitudes = []
        fundamental_amp = 0.0

        for h in range(1, self.n_harmonics + 1):
            target_freq = fundamental * h
            # Find the bin closest to the harmonic frequency
            tolerance_hz = fundamental * 0.05  # 5% tolerance
            mask = np.abs(freqs - target_freq) < tolerance_hz

            if np.any(mask):
                amp = np.max(fft[mask])
            else:
                # Find nearest bin if no exact match
                idx = np.argmin(np.abs(freqs - target_freq))
                amp = fft[idx]

            if h == 1:
                fundamental_amp = amp
            harmonic_amplitudes.append(float(amp))

        # Normalize to fundamental
        if fundamental_amp > 0:
            harmonic_ratios = [amp / fundamental_amp for amp in harmonic_amplitudes]
        else:
            harmonic_ratios = harmonic_amplitudes

        return harmonic_ratios

    def extract_spectral_centroid(self, y: np.ndarray, sr: int) -> float:
        """Extract spectral centroid - center of mass of spectrum."""
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        return float(np.mean(centroid))

    def extract_spectral_rolloff(self, y: np.ndarray, sr: int) -> float:
        """Extract spectral rolloff - frequency below which threshold% of energy sits."""
        rolloff = librosa.feature.spectral_rolloff(
            y=y, sr=sr, roll_percent=self.rolloff_threshold
        )
        return float(np.mean(rolloff))

    def extract_energy_slope(self, y: np.ndarray) -> float:
        """
        Extract the normalized energy slope of the window.
        Positive values indicate energy is increasing (onset/attack present).
        Near-zero values indicate steady state (sustain).
        Negative values indicate energy is decreasing (decay).
        """
        n_segments = 8
        segment_len = len(y) // n_segments

        if segment_len == 0:
            return 0.0

        energies = []
        for i in range(n_segments):
            start = i * segment_len
            end = start + segment_len
            segment_energy = np.sqrt(np.mean(y[start:end] ** 2))
            energies.append(segment_energy)

        energies = np.array(energies)
        mean_energy = np.mean(energies)

        if mean_energy < 1e-10:
            return 0.0

        x = np.arange(n_segments)
        slope = np.polyfit(x, energies, 1)[0]

        return float(slope / mean_energy)

    def extract_rms_energy(self, y: np.ndarray) -> float:
        """Extract RMS energy of the signal."""
        return float(np.sqrt(np.mean(y ** 2)))

    def extract_inharmonicity(self, y: np.ndarray, sr: int, fundamental: float) -> float:
        """
        Extract inharmonicity coefficient.
        Measures how much harmonics deviate from perfect integer multiples.
        Thicker strings (low E) have higher inharmonicity.
        """
        if fundamental <= 0:
            return 0.0

        # Compute high-resolution FFT
        n_fft = 8192
        fft = np.abs(np.fft.rfft(y, n=n_fft))
        freqs = np.fft.rfftfreq(n_fft, 1/sr)

        deviations = []

        for h in range(2, min(self.n_harmonics + 1, 9)):  # Harmonics 2-8
            ideal_freq = fundamental * h

            # Search window around ideal frequency
            search_range = fundamental * 0.15
            mask = (freqs > ideal_freq - search_range) & (freqs < ideal_freq + search_range)

            if not np.any(mask):
                continue

            # Find actual peak in this range
            local_fft = fft.copy()
            local_fft[~mask] = 0
            peak_idx = np.argmax(local_fft)
            actual_freq = freqs[peak_idx]

            if local_fft[peak_idx] > np.mean(fft) * 2:  # Only if peak is significant
                # Inharmonicity causes partials to be sharp (higher than ideal)
                deviation = (actual_freq - ideal_freq) / ideal_freq
                deviations.append(deviation)

        if not deviations:
            return 0.0

        # Return mean absolute deviation as inharmonicity coefficient
        return float(np.mean(np.abs(deviations)))

    def extract_zcr(self, y: np.ndarray) -> float:
        """Extract zero crossing rate - captures brightness/noisiness of signal."""
        if len(y) < 2:
            return 0.0
        signs = np.sign(y)
        signs[signs == 0] = 1  # Treat zeros as positive
        crossings = np.sum(signs[1:] != signs[:-1])
        return float(crossings / (len(y) - 1))

    def extract_odd_even_harmonic_ratio(self, y: np.ndarray, sr: int, fundamental: float) -> float:
        """
        Extract ratio of odd to even harmonic energy.
        Captures harmonic character that differs between strings.
        """
        if fundamental <= 0:
            return 0.0

        n_fft = WINDOW_SIZE
        fft = np.abs(np.fft.rfft(y, n=n_fft))
        freqs = np.fft.rfftfreq(n_fft, 1/sr)

        odd_energy = 0.0
        even_energy = 0.0

        for h in range(1, self.n_harmonics + 1):
            target_freq = fundamental * h
            tolerance_hz = fundamental * 0.05

            mask = np.abs(freqs - target_freq) < tolerance_hz
            if np.any(mask):
                amp = np.max(fft[mask])
            else:
                idx = np.argmin(np.abs(freqs - target_freq))
                amp = fft[idx]

            if h % 2 == 1:  # Odd harmonic (1, 3, 5, ...)
                odd_energy += amp
            else:  # Even harmonic (2, 4, 6, ...)
                even_energy += amp

        if even_energy < 1e-10:
            return 0.0

        return float(odd_energy / even_energy)

    def extract_frequency_relative_features(
        self, fundamental: float
    ) -> tuple[float, float, int]:
        """
        Extract frequency-relative features that provide pitch context
        while remaining useful for string classification.

        Returns:
            log_frequency: log2(f0) - pitch on an octave scale where each +1.0 = one octave
            semitones_from_e2: number of semitones above E2 (lowest guitar note)
            octave_number: which octave the note falls in (0-3 for typical guitar)
        """
        if fundamental <= 0:
            return 0.0, 0.0, 0

        # Log frequency: each octave is +1.0, musically meaningful scale
        log_frequency = float(np.log2(fundamental))

        # Semitones from E2: gives absolute position on fretboard
        # Formula: 12 * log2(f / f_ref) gives semitones between two frequencies
        semitones_from_e2 = float(12.0 * np.log2(fundamental / self.E2_FREQ))

        # Octave number: which octave range (0 = E2-E3, 1 = E3-E4, etc.)
        octave_number = int(np.floor(np.log2(fundamental / self.E2_FREQ)))
        octave_number = max(0, min(octave_number, 3))  # Clamp to 0-3

        return log_frequency, semitones_from_e2, octave_number

    def extract_mfccs(
        self, y: np.ndarray, sr: int
    ) -> tuple[list[float], list[float]]:
        """
        Extract Mel-Frequency Cepstral Coefficients (MFCCs).
        For full audio samples, returns mean and std across frames.
        """
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=self.n_mfcc)
        mfcc_mean = [float(np.mean(mfcc)) for mfcc in mfccs]
        mfcc_std = [float(np.std(mfcc)) for mfcc in mfccs]
        return mfcc_mean, mfcc_std

    def extract_mfcc_single(self, y: np.ndarray, sr: int) -> list[float]:
        """
        Extract MFCCs for a short window.
        Returns mean across the few frames in the window.
        """
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=self.n_mfcc, n_fft=min(2048, len(y)))
        return [float(np.mean(mfcc)) for mfcc in mfccs]

    def extract_window_features(
        self,
        window: np.ndarray,
        sr: int,
        string: int,
        fret: int,
        sample_id: str,
        window_index: int,
        transition_likelihood: float = 0.0,
    ) -> WindowFeatures:
        """Extract features from a single 4096-sample window."""
        # Normalize amplitude to match browser inference exactly
        window = normalize_audio_amplitude(window, TARGET_RMS)

        fundamental = self.extract_fundamental(window, sr)
        harmonic_ratios = self.extract_harmonic_ratios(window, sr, fundamental)
        spectral_centroid = self.extract_spectral_centroid(window, sr)
        spectral_rolloff = self.extract_spectral_rolloff(window, sr)
        inharmonicity = self.extract_inharmonicity(window, sr, fundamental)
        rms_energy = self.extract_rms_energy(window)
        energy_slope = self.extract_energy_slope(window)
        zcr = self.extract_zcr(window)
        odd_even_harmonic_ratio = self.extract_odd_even_harmonic_ratio(window, sr, fundamental)
        log_frequency, semitones_from_e2, octave_number = self.extract_frequency_relative_features(fundamental)
        mfcc = self.extract_mfcc_single(window, sr)

        return WindowFeatures(
            string=string,
            fret=fret,
            sample_id=sample_id,
            window_index=window_index,
            fundamental_freq=fundamental,
            harmonic_ratios=harmonic_ratios,
            spectral_centroid=spectral_centroid,
            spectral_rolloff=spectral_rolloff,
            inharmonicity=inharmonicity,
            rms_energy=rms_energy,
            energy_slope=energy_slope,
            zcr=zcr,
            odd_even_harmonic_ratio=odd_even_harmonic_ratio,
            log_frequency=log_frequency,
            semitones_from_e2=semitones_from_e2,
            octave_number=octave_number,
            mfcc=mfcc,
            transition_likelihood=transition_likelihood,
        )


def find_samples(samples_dir: Path) -> list[tuple[Path, int, int]]:
    """
    Find all .wav samples and parse their string/fret from path.
    Returns list of (path, string, fret) tuples.
    """
    samples = []

    if not samples_dir.exists():
        print(f"Samples directory not found: {samples_dir}")
        return samples

    for string_dir in samples_dir.iterdir():
        if not string_dir.is_dir():
            continue

        try:
            string_num = int(string_dir.name)
        except ValueError:
            continue

        for fret_dir in string_dir.iterdir():
            if not fret_dir.is_dir():
                continue

            try:
                fret_num = int(fret_dir.name)
            except ValueError:
                continue

            for wav_file in fret_dir.glob("*.wav"):
                samples.append((wav_file, string_num, fret_num))

    return samples

def extract_windows(y: np.ndarray, window_size: int = WINDOW_SIZE, hop_size: int = None) -> list[np.ndarray]:
    """Extract overlapping windows from audio signal."""
    if hop_size is None:
        hop_size = window_size // 2  # 50% overlap

    windows = []
    for start in range(0, len(y) - window_size + 1, hop_size):
        windows.append(y[start:start + window_size])
    return windows


def process_audio_with_augmentation(
    y: np.ndarray,
    sr: int,
    string_num: int,
    fret_num: int,
    sample_id: str,
    extractor: FeatureExtractor,
    augmenter: AudioAugmenter | None = None,
    layer_mixer: StringLayerMixer | None = None,
    layer_probability: float = STRING_LAYER_PROBABILITY,
    rng: np.random.Generator | None = None,
) -> list[WindowFeatures]:
    """
    Process audio and optionally generate augmented versions.

    Args:
        y: Audio signal
        sr: Sample rate
        string_num: Guitar string number
        fret_num: Fret number
        sample_id: Unique sample identifier
        extractor: Feature extractor instance
        augmenter: Optional augmenter for data augmentation
        layer_mixer: Optional mixer for adjacent string interference
        layer_probability: Probability of applying string layering (0.0-1.0)
        rng: Random number generator for layering decisions

    Returns:
        List of WindowFeatures from original and augmented audio
    """
    all_features = []
    if rng is None:
        rng = np.random.default_rng()

    # Process original audio
    y_trimmed, _ = librosa.effects.trim(y, top_db=20)
    if len(y_trimmed) > sr * 0.1:
        y = y_trimmed

    windows = extract_windows(y, WINDOW_SIZE)

    for win_idx, window in enumerate(windows):
        features = extractor.extract_window_features(
            window, sr, string_num, fret_num, sample_id, win_idx
        )
        all_features.append(features)

    # Generate string-layered version (simulates adjacent string interference)
    if layer_mixer is not None and layer_mixer.has_samples():
        if rng.random() < layer_probability:
            layered_audio, layer_string = layer_mixer.mix_with_layer(y, string_num)
            if layer_string is not None:
                # Trim layered audio
                layered_trimmed, _ = librosa.effects.trim(layered_audio, top_db=20)
                if len(layered_trimmed) > sr * 0.1:
                    layered_audio = layered_trimmed

                layer_windows = extract_windows(layered_audio, WINDOW_SIZE)
                layer_sample_id = f"{sample_id}_layer{layer_string}"

                for win_idx, window in enumerate(layer_windows):
                    features = extractor.extract_window_features(
                        window, sr, string_num, fret_num, layer_sample_id, win_idx
                    )
                    all_features.append(features)

    # Generate augmented versions
    if augmenter is not None:
        for aug_idx in range(NUM_AUGMENTATIONS):
            augmented_audio, applied = augmenter.augment(y)

            # Trim augmented audio
            aug_trimmed, _ = librosa.effects.trim(augmented_audio, top_db=20)
            if len(aug_trimmed) > sr * 0.1:
                augmented_audio = aug_trimmed

            aug_windows = extract_windows(augmented_audio, WINDOW_SIZE)
            aug_sample_id = f"{sample_id}_aug{aug_idx}"

            for win_idx, window in enumerate(aug_windows):
                features = extractor.extract_window_features(
                    window, sr, string_num, fret_num, aug_sample_id, win_idx
                )
                all_features.append(features)

    return all_features


def is_transition_window(
    window_start: int,
    window_end: int,
    note_regions: list[NoteRegion],
) -> bool:
    """
    Check if a window overlaps with more than one note region.

    Used to set transition_likelihood=1.0 for windows that span multiple notes,
    teaching the model to recognize and handle note transitions.
    """
    overlapping_notes = 0
    for region in note_regions:
        overlap_start = max(window_start, region.start_sample)
        overlap_end = min(window_end, region.end_sample)
        if overlap_end > overlap_start:
            overlapping_notes += 1
            if overlapping_notes > 1:
                return True
    return False


def process_sequential_audio(
    seq_result: SequentialAudioResult,
    sr: int,
    extractor: FeatureExtractor,
    generator: SequentialNoteGenerator,
    window_size: int = WINDOW_SIZE,
) -> list[WindowFeatures]:
    """
    Process sequential audio and extract features with proper labeling.

    Each window is labeled based on which note is dominant (has most overlap
    with the window). This teaches the model to identify the main note even
    when there are remnants of previous/next notes in the window.

    Windows that span multiple notes have transition_likelihood=1.0 to teach
    the model to recognize these ambiguous situations.

    Args:
        seq_result: Sequential audio result with audio and note regions
        sr: Sample rate
        extractor: Feature extractor instance
        generator: Sequential note generator (for label calculation)
        window_size: Size of extraction window

    Returns:
        List of WindowFeatures with labels based on dominant note per window
    """
    features = []
    audio = seq_result.audio
    note_regions = seq_result.note_regions

    # Normalize the combined audio
    audio = normalize_audio_amplitude(audio, TARGET_RMS)

    # Extract windows with 50% overlap
    hop_size = window_size // 2

    for win_idx, start in enumerate(range(0, len(audio) - window_size + 1, hop_size)):
        window = audio[start:start + window_size]
        window_end = start + window_size

        # Determine dominant note for this window
        string, fret = generator.get_window_label(start, window_end, note_regions)

        # Check if this window spans multiple notes (is a transition)
        transition = is_transition_window(start, window_end, note_regions)
        transition_likelihood = 1.0 if transition else 0.0

        # Extract features with the dominant note's label
        window_features = extractor.extract_window_features(
            window=window,
            sr=sr,
            string=string,
            fret=fret,
            sample_id=seq_result.sequence_id,
            window_index=win_idx,
            transition_likelihood=transition_likelihood,
        )
        features.append(window_features)

    return features


def process_sliding_window_sequence(
    sequence_result: SlidingWindowSequenceResult,
    generator: SlidingWindowSequenceGenerator,
    extractor: FeatureExtractor,
    augmenter: AudioAugmenter | None = None,
    num_augmentations: int = 2,
) -> list[WindowFeatures]:
    """
    Process a sliding window sequence and extract features.

    Augmentation is applied to the entire sequence BEFORE window extraction,
    ensuring consistent augmentation across all windows in the sequence.

    Args:
        sequence_result: The sequence to process
        generator: The generator instance (for label calculation)
        extractor: Feature extractor instance
        augmenter: Optional augmenter for data augmentation
        num_augmentations: Number of augmented versions to generate

    Returns:
        List of WindowFeatures for all windows (original + augmented)
    """
    all_features = []
    audio = sequence_result.audio
    note_regions = sequence_result.note_regions
    sr = generator.target_sr

    # Normalize the sequence audio
    normalized_audio = normalize_audio_amplitude(audio, TARGET_RMS)

    # Process original sequence
    def extract_features_from_audio(audio_data: np.ndarray, suffix: str = "") -> list[WindowFeatures]:
        """Extract features from windows of the given audio."""
        features = []
        windows = generator.extract_sliding_windows(SlidingWindowSequenceResult(
            audio=audio_data,
            note_regions=note_regions,
            sequence_id=sequence_result.sequence_id + suffix,
            is_validation=sequence_result.is_validation,
        ))

        for window, string, fret, win_idx, transition_likelihood in windows:
            # Normalize each window individually (matches production inference)
            window = normalize_audio_amplitude(window, TARGET_RMS)

            window_features = extractor.extract_window_features(
                window=window,
                sr=sr,
                string=string,
                fret=fret,
                sample_id=sequence_result.sequence_id + suffix,
                window_index=win_idx,
                transition_likelihood=transition_likelihood,
            )
            features.append(window_features)

        return features

    # Extract features from original audio
    all_features.extend(extract_features_from_audio(normalized_audio))

    # Generate and process augmented versions
    if augmenter is not None and num_augmentations > 0:
        for aug_idx in range(num_augmentations):
            # Apply augmentation to entire sequence
            augmented_audio, _ = augmenter.augment(normalized_audio)
            all_features.extend(extract_features_from_audio(augmented_audio, f"_aug{aug_idx}"))

    return all_features


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract features from guitar audio samples with optional augmentation."
    )

    parser.add_argument(
        "--samples-dir",
        type=str,
        default=None,
        help="Directory containing samples (default: ../frontend/samples)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory to save features (default: ./data/features)"
    )
    parser.add_argument(
        "--augment",
        action="store_true",
        help="Enable data augmentation"
    )
    parser.add_argument(
        "--no-augment",
        action="store_true",
        help="Disable data augmentation (overrides USE_AUGMENTATION)"
    )
    parser.add_argument(
        "--augment-preset",
        type=str,
        choices=["subtle", "moderate", "aggressive"],
        default="moderate",
        help="Augmentation preset (default: moderate)"
    )
    parser.add_argument(
        "--n-augmentations",
        type=int,
        default=2,
        help="Number of augmented versions per sample (default: 2)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible augmentations"
    )

    # Individual augmentation toggles
    parser.add_argument("--no-reverb", action="store_true", help="Disable reverb augmentation")
    parser.add_argument("--no-chorus", action="store_true", help="Disable chorus augmentation")
    parser.add_argument("--no-eq", action="store_true", help="Disable EQ augmentation")
    parser.add_argument("--no-noise", action="store_true", help="Disable noise augmentation")
    parser.add_argument("--no-pitch-drift", action="store_true", help="Disable pitch drift augmentation")

    # String layering options
    parser.add_argument(
        "--no-layer",
        action="store_true",
        help="Disable adjacent string layering augmentation"
    )
    parser.add_argument(
        "--layer-probability",
        type=float,
        default=STRING_LAYER_PROBABILITY,
        help=f"Probability of applying string layering (default: {STRING_LAYER_PROBABILITY})"
    )
    parser.add_argument(
        "--layer-volume-min",
        type=float,
        default=STRING_LAYER_VOLUME_MIN,
        help=f"Minimum layer volume ratio (default: {STRING_LAYER_VOLUME_MIN})"
    )
    parser.add_argument(
        "--layer-volume-max",
        type=float,
        default=STRING_LAYER_VOLUME_MAX,
        help=f"Maximum layer volume ratio (default: {STRING_LAYER_VOLUME_MAX})"
    )
    parser.add_argument(
        "--layer-samples-dir",
        type=str,
        default=None,
        help="Directory containing layer samples (default: ../frontend/layer_samples)"
    )

    # Sequential note generation options
    parser.add_argument(
        "--no-sequential",
        action="store_true",
        help="Disable sequential note generation for fast-playing training"
    )
    parser.add_argument(
        "--sequential-ratio",
        type=float,
        default=SEQUENTIAL_RATIO,
        help=f"Ratio of sequential samples to generate (default: {SEQUENTIAL_RATIO})"
    )
    parser.add_argument(
        "--sequential-gap-min",
        type=float,
        default=SEQUENTIAL_GAP_MIN_MS,
        help=f"Minimum gap between notes in ms (default: {SEQUENTIAL_GAP_MIN_MS})"
    )
    parser.add_argument(
        "--sequential-gap-max",
        type=float,
        default=SEQUENTIAL_GAP_MAX_MS,
        help=f"Maximum gap between notes in ms (default: {SEQUENTIAL_GAP_MAX_MS})"
    )
    parser.add_argument(
        "--sequential-length-min",
        type=int,
        default=SEQUENTIAL_LENGTH_MIN,
        help=f"Minimum notes per sequence (default: {SEQUENTIAL_LENGTH_MIN})"
    )
    parser.add_argument(
        "--sequential-length-max",
        type=int,
        default=SEQUENTIAL_LENGTH_MAX,
        help=f"Maximum notes per sequence (default: {SEQUENTIAL_LENGTH_MAX})"
    )
    parser.add_argument(
        "--sequential-note-duration",
        type=float,
        default=SEQUENTIAL_NOTE_DURATION_MS,
        help=f"Duration of each note in sequence in ms (default: {SEQUENTIAL_NOTE_DURATION_MS})"
    )

    # Sliding window sequence options (simulates production rolling window)
    parser.add_argument(
        "--no-sliding-window",
        action="store_true",
        help="Disable sliding window sequence generation"
    )
    parser.add_argument(
        "--sliding-window-only",
        action="store_true",
        help="Generate ONLY sliding window sequences (for special training mode)"
    )
    parser.add_argument(
        "--sliding-window-num-train",
        type=int,
        default=SLIDING_WINDOW_NUM_TRAIN_SEQUENCES,
        help=f"Number of training sequences (default: {SLIDING_WINDOW_NUM_TRAIN_SEQUENCES})"
    )
    parser.add_argument(
        "--sliding-window-num-val",
        type=int,
        default=SLIDING_WINDOW_NUM_VAL_SEQUENCES,
        help=f"Number of validation sequences (default: {SLIDING_WINDOW_NUM_VAL_SEQUENCES})"
    )
    parser.add_argument(
        "--sliding-window-hop-size",
        type=int,
        default=SLIDING_WINDOW_HOP_SIZE,
        help=f"Hop size in samples (default: {SLIDING_WINDOW_HOP_SIZE})"
    )
    parser.add_argument(
        "--sliding-window-gap-min",
        type=float,
        default=SLIDING_WINDOW_GAP_MIN_MS,
        help=f"Minimum gap between notes in ms (default: {SLIDING_WINDOW_GAP_MIN_MS})"
    )
    parser.add_argument(
        "--sliding-window-gap-max",
        type=float,
        default=SLIDING_WINDOW_GAP_MAX_MS,
        help=f"Maximum gap between notes in ms (default: {SLIDING_WINDOW_GAP_MAX_MS})"
    )
    parser.add_argument(
        "--sliding-window-notes-per-seq",
        type=int,
        default=SLIDING_WINDOW_NOTES_PER_SEQUENCE,
        help=f"Notes per sequence (default: {SLIDING_WINDOW_NOTES_PER_SEQUENCE})"
    )
    parser.add_argument(
        "--sliding-window-note-duration",
        type=float,
        default=SLIDING_WINDOW_NOTE_DURATION_MS,
        help=f"Duration of each note in ms (default: {SLIDING_WINDOW_NOTE_DURATION_MS})"
    )
    parser.add_argument(
        "--sliding-window-augmentations",
        type=int,
        default=2,
        help="Number of augmented versions per sliding window sequence (default: 2)"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    script_dir = Path(__file__).parent

    if args.samples_dir:
        samples_dir = Path(args.samples_dir)
    else:
        samples_dir = script_dir.parent / "frontend" / "samples"

    if args.output_dir:
        output_dir = Path(args.output_dir)
    else:
        output_dir = script_dir / "data" / "features"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Looking for samples in: {samples_dir}")
    base_samples = find_samples(samples_dir)
    print(f"Found {len(base_samples)} base audio files")

    finetune_samples: list[tuple[Path, int, int]] = []
    if USE_FINETUNE_SAMPLES:
        finetune_samples_dir = script_dir.parent / "frontend" / "finetune_samples"
        print(f"Looking for finetune samples in: {finetune_samples_dir}")
        finetune_samples = find_samples(finetune_samples_dir)
        print(f"Found {len(finetune_samples)} finetune audio files")

    samples = base_samples + finetune_samples

    if not samples:
        print("No samples found!")
        return

    print(f"Found {len(samples)} total audio files")

    # Set up random seed for reproducibility
    random_seed = args.seed if args.seed is not None else int(time.time())
    main_rng = np.random.default_rng(random_seed)

    augmenter = None
    use_augmentation = USE_AUGMENTATION and not args.no_augment

    if use_augmentation:
        print(f"\nAugmentation enabled, creating {NUM_AUGMENTATIONS} augmented versions per sample")

        augmenter = create_augmenter(
            preset=AUGMENTATION_PRESET,
            reverb_enabled=True,
            chorus_enabled=True,
            eq_enabled=True,
            noise_enabled=True,
            pitch_drift_enabled=True,
        )

        augmenter.config.random_seed = random_seed
        augmenter._rng = np.random.default_rng(random_seed)

    # Set up string layer mixer for adjacent string interference simulation
    layer_mixer = None
    use_layering = USE_STRING_LAYERING and not args.no_layer

    if use_layering:
        if args.layer_samples_dir:
            layer_samples_dir = Path(args.layer_samples_dir)
        else:
            layer_samples_dir = script_dir.parent / "frontend" / "layer_samples"

        print(f"\nString layering enabled (probability: {args.layer_probability:.0%})")
        print(f"Looking for layer samples in: {layer_samples_dir}")

        layer_mixer = StringLayerMixer(
            layer_samples_dir=layer_samples_dir,
            volume_min=args.layer_volume_min,
            volume_max=args.layer_volume_max,
            seed=random_seed,
        )

        if not layer_mixer.has_samples():
            print("Warning: No layer samples found. String layering will be skipped.")
            print("To record layer samples, create .wav files of open strings ringing (sustain only, no attack)")
            print(f"Save them in: {layer_samples_dir}/{{string_num}}/{{sample_name}}.wav")
            layer_mixer = None

    # Set up sequential note generators for fast-playing training
    # We create separate generators for base and finetune samples to ensure
    # sequences don't mix samples from different categories
    base_sequential_generator = None
    finetune_sequential_generator = None
    use_sequential = USE_SEQUENTIAL_NOTES and not args.no_sequential

    if use_sequential:
        print(f"\nSequential note generation enabled")
        print(f"  Sequence length: {args.sequential_length_min}-{args.sequential_length_max} notes")
        print(f"  Gap between notes: {args.sequential_gap_min}-{args.sequential_gap_max}ms")
        print(f"  Note duration: {args.sequential_note_duration}ms")

        if base_samples:
            num_base_sequential = max(1, int(len(base_samples) * args.sequential_ratio))
            print(f"  Base samples: generating {num_base_sequential} sequential clips ({args.sequential_ratio:.0%} of {len(base_samples)} samples)")
            base_sequential_generator = SequentialNoteGenerator(
                samples=base_samples,
                target_sr=44100,
                gap_min_ms=args.sequential_gap_min,
                gap_max_ms=args.sequential_gap_max,
                sequence_length_min=args.sequential_length_min,
                sequence_length_max=args.sequential_length_max,
                note_duration_ms=args.sequential_note_duration,
                seed=random_seed,
            )

        if finetune_samples:
            num_finetune_sequential = max(1, int(len(finetune_samples) * args.sequential_ratio))
            print(f"  Finetune samples: generating {num_finetune_sequential} sequential clips ({args.sequential_ratio:.0%} of {len(finetune_samples)} samples)")
            finetune_sequential_generator = SequentialNoteGenerator(
                samples=finetune_samples,
                target_sr=44100,
                gap_min_ms=args.sequential_gap_min,
                gap_max_ms=args.sequential_gap_max,
                sequence_length_min=args.sequential_length_min,
                sequence_length_max=args.sequential_length_max,
                note_duration_ms=args.sequential_note_duration + 1,
                seed=random_seed + 1,
            )

    # Set up sliding window sequence generators (simulates production rolling window)
    # Separate generators for base and finetune samples to avoid mixing categories
    base_sliding_generator = None
    finetune_sliding_generator = None
    use_sliding_window = USE_SLIDING_WINDOW_SEQUENCES and not args.no_sliding_window

    if use_sliding_window or args.sliding_window_only:
        print(f"\nSliding window sequence generation enabled")
        print(f"  Window size: {WINDOW_SIZE}, Hop size: {args.sliding_window_hop_size}")
        print(f"  Gap between notes: {args.sliding_window_gap_min}-{args.sliding_window_gap_max}ms")
        print(f"  Notes per sequence: {args.sliding_window_notes_per_seq}")
        print(f"  Note duration: {args.sliding_window_note_duration}ms")
        print(f"  Train sequences: {args.sliding_window_num_train}, Val sequences: {args.sliding_window_num_val}")
        if args.sliding_window_only:
            print(f"  MODE: Sliding window sequences ONLY (no individual samples)")

        if base_samples:
            base_sliding_generator = SlidingWindowSequenceGenerator(
                samples=base_samples,
                target_sr=44100,
                window_size=WINDOW_SIZE,
                hop_size=args.sliding_window_hop_size,
                gap_min_ms=args.sliding_window_gap_min,
                gap_max_ms=args.sliding_window_gap_max,
                notes_per_sequence=args.sliding_window_notes_per_seq,
                note_duration_ms=args.sliding_window_note_duration,
                seed=random_seed + 2,
            )

        if finetune_samples:
            finetune_sliding_generator = SlidingWindowSequenceGenerator(
                samples=finetune_samples,
                target_sr=44100,
                window_size=WINDOW_SIZE,
                hop_size=args.sliding_window_hop_size,
                gap_min_ms=args.sliding_window_gap_min,
                gap_max_ms=args.sliding_window_gap_max,
                notes_per_sequence=args.sliding_window_notes_per_seq,
                note_duration_ms=args.sliding_window_note_duration,
                seed=random_seed + 3,
            )

    extractor = FeatureExtractor(n_harmonics=12)
    all_features: list[WindowFeatures] = []
    sliding_train_features: list[WindowFeatures] = []
    sliding_val_features: list[WindowFeatures] = []
    augmentation_stats = {"total_augmented": 0, "effects_applied": defaultdict(int)}

    # Process individual samples (skip if sliding-window-only mode)
    if not args.sliding_window_only:
        for i, (path, string_num, fret_num) in enumerate(samples):
            if i % 25 == 0:
                print(f"Processing [{i+1}/{len(samples)}]")

            try:
                y, sr = librosa.load(str(path), sr=None)
                sample_id = path.stem

                features = process_audio_with_augmentation(
                    y=y,
                    sr=sr,
                    string_num=string_num,
                    fret_num=fret_num,
                    sample_id=sample_id,
                    extractor=extractor,
                    augmenter=augmenter,
                    layer_mixer=layer_mixer,
                    layer_probability=args.layer_probability,
                    rng=main_rng,
                )
                all_features.extend(features)

            except Exception as e:
                print(f"  Error processing {path}: {e}")
        print(f"Processed {len(all_features)} windows from {len(samples)} samples")
    else:
        print("\nSliding-window-only mode: skipping individual sample processing")

    # Generate and process sequential note samples (skip if sliding-window-only mode)
    # Process base and finetune sequences separately to avoid mixing categories
    sequential_count = 0
    total_sequential_results = 0

    if not args.sliding_window_only:
        if base_sequential_generator is not None:
            num_base_sequential = max(1, int(len(base_samples) * args.sequential_ratio))
            print(f"\nGenerating {num_base_sequential} sequential note samples from base samples...")

            base_sequential_results = base_sequential_generator.generate_samples(num_base_sequential)
            total_sequential_results += len(base_sequential_results)

            for seq_result in base_sequential_results:
                try:
                    seq_features = process_sequential_audio(
                        seq_result=seq_result,
                        sr=44100,
                        extractor=extractor,
                        generator=base_sequential_generator,
                        window_size=WINDOW_SIZE,
                    )
                    all_features.extend(seq_features)
                    sequential_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sequence {seq_result.sequence_id}: {e}")

        if finetune_sequential_generator is not None:
            num_finetune_sequential = max(1, int(len(finetune_samples) * args.sequential_ratio))
            print(f"\nGenerating {num_finetune_sequential} sequential note samples from finetune samples...")

            finetune_sequential_results = finetune_sequential_generator.generate_samples(num_finetune_sequential)
            total_sequential_results += len(finetune_sequential_results)

            for seq_result in finetune_sequential_results:
                try:
                    seq_features = process_sequential_audio(
                        seq_result=seq_result,
                        sr=44100,
                        extractor=extractor,
                        generator=finetune_sequential_generator,
                        window_size=WINDOW_SIZE,
                    )
                    all_features.extend(seq_features)
                    sequential_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sequence {seq_result.sequence_id}: {e}")

        if sequential_count > 0:
            print(f"Added {sequential_count} windows from {total_sequential_results} sequential samples")

    # Generate and process sliding window sequences
    # These simulate the production rolling window environment with 512-sample hop
    sliding_window_count = 0
    total_sliding_sequences = 0

    if base_sliding_generator is not None or finetune_sliding_generator is not None:
        # Create augmenter for sliding window sequences if augmentation is enabled
        sliding_augmenter = None
        if use_augmentation:
            sliding_augmenter = create_augmenter(
                preset=AUGMENTATION_PRESET,
                reverb_enabled=True,
                chorus_enabled=True,
                eq_enabled=True,
                noise_enabled=True,
                pitch_drift_enabled=True,
            )
            sliding_augmenter.config.random_seed = random_seed + 100
            sliding_augmenter._rng = np.random.default_rng(random_seed + 100)

        if base_sliding_generator is not None:
            print(f"\nGenerating sliding window sequences from base samples...")
            base_train_seqs, base_val_seqs = base_sliding_generator.generate_sequences(
                num_train=args.sliding_window_num_train,
                num_val=args.sliding_window_num_val,
            )
            total_sliding_sequences += len(base_train_seqs) + len(base_val_seqs)

            for i, seq_result in enumerate(base_train_seqs):
                try:
                    seq_features = process_sliding_window_sequence(
                        sequence_result=seq_result,
                        generator=base_sliding_generator,
                        extractor=extractor,
                        augmenter=sliding_augmenter,
                        num_augmentations=args.sliding_window_augmentations,
                    )
                    sliding_train_features.extend(seq_features)
                    sliding_window_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sliding sequence {seq_result.sequence_id}: {e}")
                if (i + 1) % 5 == 0 or (i + 1) == len(base_train_seqs):
                    print(f"    Processed {i + 1} / {len(base_train_seqs)} base training sliding sequences")

            for i, seq_result in enumerate(base_val_seqs):
                try:
                    seq_features = process_sliding_window_sequence(
                        sequence_result=seq_result,
                        generator=base_sliding_generator,
                        extractor=extractor,
                        augmenter=sliding_augmenter,
                        num_augmentations=args.sliding_window_augmentations,
                    )
                    sliding_val_features.extend(seq_features)
                    sliding_window_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sliding sequence {seq_result.sequence_id}: {e}")
                if (i + 1) % 5 == 0 or (i + 1) == len(base_val_seqs):
                    print(f"    Processed {i + 1} / {len(base_val_seqs)} base validation sliding sequences")

        if finetune_sliding_generator is not None:
            print(f"\nGenerating sliding window sequences from finetune samples...")
            finetune_train_seqs, finetune_val_seqs = finetune_sliding_generator.generate_sequences(
                num_train=args.sliding_window_num_train,
                num_val=args.sliding_window_num_val,
            )
            total_sliding_sequences += len(finetune_train_seqs) + len(finetune_val_seqs)

            for seq_result in finetune_train_seqs:
                try:
                    seq_features = process_sliding_window_sequence(
                        sequence_result=seq_result,
                        generator=finetune_sliding_generator,
                        extractor=extractor,
                        augmenter=sliding_augmenter,
                        num_augmentations=args.sliding_window_augmentations,
                    )
                    sliding_train_features.extend(seq_features)
                    sliding_window_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sliding sequence {seq_result.sequence_id}: {e}")

            for seq_result in finetune_val_seqs:
                try:
                    seq_features = process_sliding_window_sequence(
                        sequence_result=seq_result,
                        generator=finetune_sliding_generator,
                        extractor=extractor,
                        augmenter=sliding_augmenter,
                        num_augmentations=args.sliding_window_augmentations,
                    )
                    sliding_val_features.extend(seq_features)
                    sliding_window_count += len(seq_features)
                except Exception as e:
                    print(f"  Error processing sliding sequence {seq_result.sequence_id}: {e}")

        if sliding_window_count > 0:
            print(f"Added {sliding_window_count} windows from {total_sliding_sequences} sliding sequences")
            print(f"  Training: {len(sliding_train_features)} windows, Validation: {len(sliding_val_features)} windows")

    # Validate fundamental frequencies for standard features
    print("\n--- Frequency Validation ---")
    original_count = len(all_features)
    all_features, discarded_samples, skipped_validation_count = validate_fundamental_frequencies(all_features, tolerance=0.05)
    discarded_count = original_count - len(all_features)

    # Also validate sliding window features
    sliding_train_original = len(sliding_train_features)
    sliding_val_original = len(sliding_val_features)
    sliding_train_features, _, train_skipped = validate_fundamental_frequencies(sliding_train_features, tolerance=0.05)
    sliding_val_features, _, val_skipped = validate_fundamental_frequencies(sliding_val_features, tolerance=0.05)
    skipped_validation_count += train_skipped + val_skipped

    if skipped_validation_count > 0:
        print(f"Skipped validation for {skipped_validation_count} windows (layered/sequential/sliding samples)")

    if discarded_samples:
        print(f"Discarded {discarded_count} windows from {len(discarded_samples)} samples with invalid fundamental frequencies (>5% deviation):")
        for sample in discarded_samples[:10]:  # Limit output
            print(f"  - {sample['sample_id']} (string {sample['string']}, fret {sample['fret']}): "
                  f"detected {sample['detected_freq']:.1f} Hz, expected {sample['expected_freq']:.1f} Hz")
        if len(discarded_samples) > 10:
            print(f"  ... and {len(discarded_samples) - 10} more")
    else:
        print("All samples passed frequency validation (within ±5% of expected)")

    # Custom encoder to handle numpy types
    class NumpyEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.integer):
                return int(obj)
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            return super().default(obj)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    use_sliding = base_sliding_generator is not None or finetune_sliding_generator is not None

    # Create common metadata
    common_metadata = {
        "extracted_at": datetime.now().isoformat(),
        "window_size": WINDOW_SIZE,
        "target_rms": TARGET_RMS,
        "augmentation_enabled": use_augmentation,
        "augmentation_preset": args.augment_preset if use_augmentation else None,
        "feature_names": [
            "harmonic_ratios",
            "spectral_centroid",
            "spectral_rolloff",
            "inharmonicity",
            "rms_energy",
            "energy_slope",
            "zcr",
            "odd_even_harmonic_ratio",
            "log_frequency",
            "semitones_from_e2",
            "octave_number",
            "mfcc",
            "transition_likelihood",
        ],
    }

    # Save standard features (if not sliding-window-only mode)
    if not args.sliding_window_only and all_features:
        output_data = {
            **common_metadata,
            "total_windows": len(all_features),
            "total_audio_files": len(samples),
            "strings_covered": sorted(list(set(f["string"] for f in all_features))),
            "n_augmentations_per_sample": NUM_AUGMENTATIONS,
            "string_layering_enabled": layer_mixer is not None,
            "string_layering_probability": args.layer_probability if layer_mixer else None,
            "string_layering_volume_range": [args.layer_volume_min, args.layer_volume_max] if layer_mixer else None,
            "sequential_notes_enabled": base_sequential_generator is not None or finetune_sequential_generator is not None,
            "sequential_notes_ratio": args.sequential_ratio if use_sequential else None,
            "sequential_notes_gap_range_ms": [args.sequential_gap_min, args.sequential_gap_max] if use_sequential else None,
            "sequential_notes_length_range": [args.sequential_length_min, args.sequential_length_max] if use_sequential else None,
            "sequential_notes_duration_ms": args.sequential_note_duration if use_sequential else None,
            "samples": all_features,
        }

        suffix = "_augmented" if args.augment else ""
        output_path = output_dir / f"{timestamp}{suffix}.json"

        with open(output_path, "w") as f:
            json.dump(output_data, f, indent=2, cls=NumpyEncoder)

        print(f"\nStandard features saved to: {output_path}")

    # Save sliding window sequences as separate train/val files
    if use_sliding and (sliding_train_features or sliding_val_features):
        sliding_metadata = {
            **common_metadata,
            "sliding_window_enabled": True,
            "sliding_window_hop_size": args.sliding_window_hop_size,
            "sliding_window_gap_range_ms": [args.sliding_window_gap_min, args.sliding_window_gap_max],
            "sliding_window_notes_per_sequence": args.sliding_window_notes_per_seq,
            "sliding_window_note_duration_ms": args.sliding_window_note_duration,
            "sliding_window_augmentations": args.sliding_window_augmentations,
            "sliding_window_only_mode": args.sliding_window_only,
        }

        if sliding_train_features:
            train_data = {
                **sliding_metadata,
                "split": "train",
                "total_windows": len(sliding_train_features),
                "strings_covered": sorted(list(set(f["string"] for f in sliding_train_features))),
                "samples": sliding_train_features,
            }
            train_path = output_dir / f"{timestamp}_sliding_train.json"
            with open(train_path, "w") as f:
                json.dump(train_data, f, indent=2, cls=NumpyEncoder)
            print(f"Sliding window train features saved to: {train_path}")

        if sliding_val_features:
            val_data = {
                **sliding_metadata,
                "split": "validation",
                "total_windows": len(sliding_val_features),
                "strings_covered": sorted(list(set(f["string"] for f in sliding_val_features))),
                "samples": sliding_val_features,
            }
            val_path = output_dir / f"{timestamp}_sliding_val.json"
            with open(val_path, "w") as f:
                json.dump(val_data, f, indent=2, cls=NumpyEncoder)
            print(f"Sliding window val features saved to: {val_path}")

    # Count different sample types
    if not args.sliding_window_only:
        original_count = sum(1 for f in all_features if "_aug" not in f["sample_id"] and "_layer" not in f["sample_id"] and not f["sample_id"].startswith("seq"))
        augmented_count = sum(1 for f in all_features if "_aug" in f["sample_id"])
        layered_count = sum(1 for f in all_features if "_layer" in f["sample_id"])
        sequential_window_count = sum(1 for f in all_features if f["sample_id"].startswith("seq"))

        print(f"\n--- Standard Features Summary ---")
        print(f"  Original windows: {original_count}")
        if augmented_count > 0:
            print(f"  Augmented windows: {augmented_count}")
        if layered_count > 0:
            print(f"  String-layered windows: {layered_count}")
        if sequential_window_count > 0:
            print(f"  Sequential note windows: {sequential_window_count}")

    if use_sliding:
        print(f"\n--- Sliding Window Features Summary ---")
        print(f"  Training windows: {len(sliding_train_features)}")
        print(f"  Validation windows: {len(sliding_val_features)}")

    # Print summary statistics
    combined_features = all_features + sliding_train_features + sliding_val_features
    if combined_features:
        print("\n--- Feature Summary (All) ---")
        for string_num in sorted(set(f["string"] for f in combined_features)):
            string_windows = [f for f in combined_features if f["string"] == string_num]
            fundamentals = [f["fundamental_freq"] for f in string_windows]
            slopes = [f["energy_slope"] for f in string_windows]
            print(f"String {string_num}: {len(string_windows)} windows, "
                  f"avg fundamental: {np.mean(fundamentals):.1f} Hz, "
                  f"avg energy_slope: {np.mean(slopes):.3f}")


if __name__ == "__main__":
    main()
