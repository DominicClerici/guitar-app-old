"""
Feature extraction pipeline for guitar string classification.

Extracts mel-spectrograms from guitar audio samples, saving them
in both JSON and compressed NPZ formats for training.
"""

USE_LABELED_SEQUENCES = True

MAX_SAMPLE_LENGTH_MS = 450 # end of samples longer is trimmed
MAX_SAMPLE_LENGTH_SEQUENCE_MS = 650 # for each note interval in a sequence

ENABLE_ZERO_PADDING = False # If samples arent the full window size, pad with zeros
MAX_ZERO_PAD = 25  # Max percentage of window that can be zero-padded

import json
import time
import numpy as np
import librosa
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass

from .spectrogram import (
    SAMPLE_RATE,
    WINDOW_SIZE,
    N_FFT,
    HOP_LENGTH,
    N_MELS,
    FMIN,
    FMAX,
    TARGET_RMS,
    normalize_audio_amplitude,
    audio_to_mel_spectrogram,
)


@dataclass
class SpectrogramSample:
    spectrogram: np.ndarray  # Shape: (n_mels, time_frames)
    string: int
    fret: int
    sample_id: str
    window_index: int


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


def extract_windows(audio: np.ndarray, window_size: int = WINDOW_SIZE) -> list[np.ndarray]:
    """Extract overlapping windows from audio signal with 50% overlap."""
    hop_size = window_size // 2
    windows = []
    for start in range(0, len(audio) - window_size + 1, hop_size):
        windows.append(audio[start:start + window_size])
    return windows


def process_audio_file(
    path: Path,
    string_num: int,
    fret_num: int,
    target_sr: int = SAMPLE_RATE,
) -> list[SpectrogramSample]:
    """Load an audio file and extract mel-spectrograms from windows."""
    samples = []
    sample_id = path.stem

    try:
        y, sr = librosa.load(str(path), sr=target_sr)
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return samples

    # Trim silence from start
    y_trimmed, _ = librosa.effects.trim(y, top_db=20)
    if len(y_trimmed) > sr * 0.1:
        y = y_trimmed

    # Trim end to max sample length
    max_samples = int(MAX_SAMPLE_LENGTH_MS / 1000.0 * target_sr)
    if len(y) > max_samples:
        y = y[:max_samples]

    windows = extract_windows(y, WINDOW_SIZE)

    for win_idx, window in enumerate(windows):
        window = normalize_audio_amplitude(window, TARGET_RMS)
        mel_spec = audio_to_mel_spectrogram(window)

        samples.append(SpectrogramSample(
            spectrogram=mel_spec,
            string=string_num,
            fret=fret_num,
            sample_id=sample_id,
            window_index=win_idx,
        ))

    return samples


def find_label_sessions(label_dir: Path) -> list[Path]:
    """Find all label session directories containing audio.wav and labels.json."""
    sessions = []
    if not label_dir.exists():
        return sessions
    for session_dir in sorted(label_dir.iterdir()):
        if not session_dir.is_dir():
            continue
        if (session_dir / "audio.wav").exists() and (session_dir / "labels.json").exists():
            sessions.append(session_dir)
    return sessions


def process_label_session(
    session_dir: Path,
    target_sr: int = SAMPLE_RATE,
) -> list[SpectrogramSample]:
    """
    Load a labeled audio session and extract spectrograms from each interval.

    Each interval defines a time range and its string label. We extract the audio
    for that range, then apply the same windowing as individual samples.
    """
    samples = []
    session_id = session_dir.name

    labels_path = session_dir / "labels.json"
    audio_path = session_dir / "audio.wav"

    with open(labels_path) as f:
        label_data = json.load(f)

    try:
        y, sr = librosa.load(str(audio_path), sr=target_sr)
    except Exception as e:
        print(f"Error loading {audio_path}: {e}")
        return samples

    padded_sample_count = 0

    for interval_idx, interval in enumerate(label_data["intervals"]):
        start_sample = int(interval["startMs"] / 1000.0 * target_sr)
        end_sample = int(interval["endMs"] / 1000.0 * target_sr)
        string_num = interval["string"]

        segment = y[start_sample:end_sample]

        # Trim end to max sample length
        max_samples = int(MAX_SAMPLE_LENGTH_SEQUENCE_MS / 1000.0 * target_sr)
        if len(segment) > max_samples:
            segment = segment[:max_samples]

        min_real_samples = int(WINDOW_SIZE * (1 - MAX_ZERO_PAD / 100.0))

        if len(segment) < WINDOW_SIZE:
            if ENABLE_ZERO_PADDING and len(segment) >= min_real_samples:
                padded = np.zeros(WINDOW_SIZE, dtype=segment.dtype)
                padded[:len(segment)] = segment
                segment = padded
                padded_sample_count += 1
            else:
                padded_sample_count += 1
                continue

        windows = extract_windows(segment, WINDOW_SIZE)
        if not windows and ENABLE_ZERO_PADDING and len(segment) >= min_real_samples:
            padded = np.zeros(WINDOW_SIZE, dtype=segment.dtype)
            padded[:len(segment)] = segment
            windows = [padded]
            padded_sample_count += 1

        for win_idx, window in enumerate(windows):
            window = normalize_audio_amplitude(window, TARGET_RMS)
            mel_spec = audio_to_mel_spectrogram(window)

            samples.append(SpectrogramSample(
                spectrogram=mel_spec,
                string=string_num,
                fret=0,
                sample_id=f"{session_id}_i{interval_idx}",
                window_index=win_idx,
            ))

    if (ENABLE_ZERO_PADDING):
        print(f"Zero-padded {padded_sample_count} samples")
    else:
        print(f"Removed {padded_sample_count} samples because zero-padding is disabled")
    return samples


def compute_spectrogram_stats(samples: list[SpectrogramSample]) -> dict:
    """Compute mean and std of spectrograms for normalization."""
    all_specs = np.stack([s.spectrogram for s in samples])
    return {
        "mean": float(np.mean(all_specs)),
        "std": float(np.std(all_specs)),
        "min": float(np.min(all_specs)),
        "max": float(np.max(all_specs)),
    }


def extract_features(
    samples_dir: Path | None = None,
    output_dir: Path | None = None,
    include_finetune: bool = False,
):
    """
    Main feature extraction entry point.

    Finds audio samples, extracts mel-spectrograms, and saves
    to JSON and compressed NPZ formats.
    """
    script_dir = Path(__file__).parent.parent

    if samples_dir is None:
        samples_dir = script_dir.parent / "frontend" / "samples"
    if output_dir is None:
        output_dir = script_dir / "data" / "spectrograms"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Looking for samples in: {samples_dir}")
    all_audio_files = find_samples(samples_dir)
    print(f"Found {len(all_audio_files)} base audio files")

    if include_finetune:
        finetune_dir = script_dir.parent / "frontend" / "finetune_samples"
        if finetune_dir.exists():
            finetune_files = find_samples(finetune_dir)
            print(f"Found {len(finetune_files)} finetune audio files")
            all_audio_files.extend(finetune_files)

    if not all_audio_files and not USE_LABELED_SEQUENCES:
        print("No samples found!")
        return

    print(f"\nSpectrogram config: {N_MELS} mels, {N_FFT} FFT, {HOP_LENGTH} hop")

    all_samples: list[SpectrogramSample] = []

    start_time = time.time()

    if all_audio_files:
        print(f"\nProcessing {len(all_audio_files)} individual audio files...")
        for i, (path, string_num, fret_num) in enumerate(all_audio_files):
            if i % 50 == 0:
                print(f"Processing [{i+1}/{len(all_audio_files)}]")

            samples = process_audio_file(path, string_num, fret_num)
            all_samples.extend(samples)

    if USE_LABELED_SEQUENCES:
        label_dir = script_dir.parent / "frontend" / "label_sessions"
        sessions = find_label_sessions(label_dir)
        print(f"\nFound {len(sessions)} labeled sequence sessions")

        for session_dir in sessions:
            session_samples = process_label_session(session_dir)
            print(f"  {session_dir.name}: {len(session_samples)} windows")
            all_samples.extend(session_samples)

    if not all_samples:
        print("No samples found!")
        return

    elapsed = time.time() - start_time
    print(f"\nProcessed {len(all_samples)} total windows in {elapsed:.1f}s")

    stats = compute_spectrogram_stats(all_samples)
    print(f"Spectrogram stats: mean={stats['mean']:.2f}, std={stats['std']:.2f}")
    print(f"                   min={stats['min']:.2f}, max={stats['max']:.2f}")

    expected_shape = all_samples[0].spectrogram.shape
    print(f"Spectrogram shape: {expected_shape} (n_mels x time_frames)")

    output_data = {
        "extracted_at": datetime.now().isoformat(),
        "config": {
            "sample_rate": SAMPLE_RATE,
            "window_size": WINDOW_SIZE,
            "n_fft": N_FFT,
            "hop_length": HOP_LENGTH,
            "n_mels": N_MELS,
            "fmin": FMIN,
            "fmax": FMAX,
            "target_rms": TARGET_RMS,
        },
        "stats": stats,
        "spectrogram_shape": list(expected_shape),
        "total_samples": len(all_samples),
        "total_audio_files": len(all_audio_files),
        "samples": [
            {
                "spectrogram": s.spectrogram.tolist(),
                "string": s.string,
                "fret": s.fret,
                "sample_id": s.sample_id,
                "window_index": s.window_index,
            }
            for s in all_samples
        ],
    }

    print("\n--- Class Distribution ---")
    for string_num in range(6):
        count = sum(1 for s in all_samples if s.string == string_num)
        print(f"String {string_num}: {count} windows")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"{timestamp}_spectrograms.json"

    print(f"\nSaving to: {output_path}")
    with open(output_path, "w") as f:
        json.dump(output_data, f)

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Saved {file_size_mb:.1f} MB")

    npz_path = output_dir / f"{timestamp}_spectrograms.npz"
    np.savez_compressed(
        npz_path,
        spectrograms=np.stack([s.spectrogram for s in all_samples]),
        strings=np.array([s.string for s in all_samples]),
        frets=np.array([s.fret for s in all_samples]),
        config=output_data["config"],
        stats=output_data["stats"],
    )
    npz_size_mb = npz_path.stat().st_size / (1024 * 1024)
    print(f"Saved compressed: {npz_path} ({npz_size_mb:.1f} MB)")
