"""
Spectrogram-based guitar string classification - Feature extraction pipeline.

This module extracts mel-spectrograms from guitar audio samples for training
a CNN classifier. Unlike the string-nn approach that uses hand-crafted features,
this uses raw spectrograms as input to let the model learn relevant patterns.

Spectrogram parameters are chosen for real-time browser inference:
- Window size: 4096 samples (~93ms at 44.1kHz) - matches production inference
- n_fft: 1024 - good frequency resolution for guitar fundamentals
- hop_length: 256 - gives 16 time frames per window
- n_mels: 64 - covers guitar frequency range (80Hz-2kHz)
- Output: 64x16 mel-spectrogram per window
"""

import argparse
import json
import numpy as np
import librosa
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass
import time

# Audio parameters - match string-nn for consistency
SAMPLE_RATE = 48000
WINDOW_SIZE = 4096  # ~93ms at 44.1kHz

# Spectrogram parameters
N_FFT = 1024
HOP_LENGTH = 256
N_MELS = 64
FMIN = 60.0    # Below low E (82Hz) to capture fundamental
FMAX = 2000.0  # Captures harmonics up to ~6th for high strings

# Amplitude normalization
TARGET_RMS = 0.035  # Match browser inference


@dataclass
class SpectrogramSample:
    """A single spectrogram sample with metadata."""
    spectrogram: np.ndarray  # Shape: (n_mels, time_frames)
    string: int
    fret: int
    sample_id: str
    window_index: int


def calculate_rms(samples: np.ndarray) -> float:
    """Calculate RMS energy of audio samples."""
    return float(np.sqrt(np.mean(samples ** 2)))


def normalize_audio_amplitude(samples: np.ndarray, target_rms: float = TARGET_RMS) -> np.ndarray:
    """Normalize audio amplitude to target RMS level."""
    current_rms = calculate_rms(samples)
    if current_rms < 1e-10:
        return samples
    gain = target_rms / current_rms
    return samples * gain


def audio_to_mel_spectrogram(
    audio: np.ndarray,
    sr: int = SAMPLE_RATE,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
    n_mels: int = N_MELS,
    fmin: float = FMIN,
    fmax: float = FMAX,
) -> np.ndarray:
    """
    Convert audio window to mel-spectrogram.

    Args:
        audio: Audio samples (should be WINDOW_SIZE samples)
        sr: Sample rate
        n_fft: FFT size
        hop_length: Hop length between frames
        n_mels: Number of mel bands
        fmin: Minimum frequency
        fmax: Maximum frequency

    Returns:
        Mel-spectrogram in dB scale, shape (n_mels, time_frames)
    """
    mel_spec = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        n_mels=n_mels,
        fmin=fmin,
        fmax=fmax,
        power=2.0,
    )

    # Convert to dB scale (log scale more suitable for neural networks)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

    return mel_spec_db


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
    """
    Load an audio file and extract mel-spectrograms from windows.

    Returns list of SpectrogramSample objects.
    """
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

    # Extract windows
    windows = extract_windows(y, WINDOW_SIZE)

    for win_idx, window in enumerate(windows):
        # Normalize amplitude
        window = normalize_audio_amplitude(window, TARGET_RMS)

        # Convert to mel-spectrogram
        mel_spec = audio_to_mel_spectrogram(window)

        samples.append(SpectrogramSample(
            spectrogram=mel_spec,
            string=string_num,
            fret=fret_num,
            sample_id=sample_id,
            window_index=win_idx,
        ))

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


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract mel-spectrograms from guitar audio samples."
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
        help="Directory to save spectrograms (default: ./data/spectrograms)"
    )
    parser.add_argument(
        "--include-finetune",
        action="store_true",
        help="Include finetune samples from ../frontend/finetune_samples"
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
        output_dir = script_dir / "data" / "spectrograms"

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Looking for samples in: {samples_dir}")
    all_audio_files = find_samples(samples_dir)
    print(f"Found {len(all_audio_files)} base audio files")

    if args.include_finetune:
        finetune_dir = script_dir.parent / "frontend" / "finetune_samples"
        if finetune_dir.exists():
            finetune_files = find_samples(finetune_dir)
            print(f"Found {len(finetune_files)} finetune audio files")
            all_audio_files.extend(finetune_files)

    if not all_audio_files:
        print("No samples found!")
        return

    print(f"\nProcessing {len(all_audio_files)} total audio files...")
    print(f"Spectrogram config: {N_MELS} mels, {N_FFT} FFT, {HOP_LENGTH} hop")

    all_samples: list[SpectrogramSample] = []

    start_time = time.time()

    for i, (path, string_num, fret_num) in enumerate(all_audio_files):
        if i % 50 == 0:
            print(f"Processing [{i+1}/{len(all_audio_files)}]")

        samples = process_audio_file(path, string_num, fret_num)
        all_samples.extend(samples)

    elapsed = time.time() - start_time
    print(f"\nProcessed {len(all_samples)} windows in {elapsed:.1f}s")

    # Compute normalization stats
    stats = compute_spectrogram_stats(all_samples)
    print(f"Spectrogram stats: mean={stats['mean']:.2f}, std={stats['std']:.2f}")
    print(f"                   min={stats['min']:.2f}, max={stats['max']:.2f}")

    # Get expected shape from first sample
    expected_shape = all_samples[0].spectrogram.shape
    print(f"Spectrogram shape: {expected_shape} (n_mels x time_frames)")

    # Convert to serializable format
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

    # Print class distribution
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

    # Also save a compact numpy format for faster loading
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


if __name__ == "__main__":
    main()
