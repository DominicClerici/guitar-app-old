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


WINDOW_SIZE = 4096  # ~93ms at 44.1kHz, matches browser inference

# Amplitude normalization to match browser inference exactly
# See: frontend/hooks/useStringClassifier.ts
TARGET_RMS = 0.026

USE_AUGMENTATION = True
NUM_AUGMENTATIONS = 2
AUGMENTATION_PRESET = "moderate"

USE_FINETUNE_SAMPLES = False

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


def validate_fundamental_frequencies(
    features: list["WindowFeatures"],
    tolerance: float = 0.05
) -> tuple[list["WindowFeatures"], list[DiscardedSample]]:
    """
    Validate that detected fundamental frequencies are within tolerance of expected values.

    Args:
        features: List of extracted window features
        tolerance: Allowed deviation from expected frequency (0.05 = ±5%)

    Returns:
        Tuple of (valid_features, discarded_samples)
    """
    valid_features = []
    discarded: dict[str, DiscardedSample] = {}

    for feature in features:
        string = feature["string"]
        fret = feature["fret"]
        detected_freq = feature["fundamental_freq"]
        sample_id = feature["sample_id"]

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

    return valid_features, sorted(discarded.values(), key=lambda x: x["sample_id"])


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
        self, window: np.ndarray, sr: int, string: int, fret: int, sample_id: str, window_index: int
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

    Returns:
        List of WindowFeatures from original and augmented audio
    """
    all_features = []

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
    samples = find_samples(samples_dir)

    if USE_FINETUNE_SAMPLES:
        finetune_samples_dir = script_dir.parent / "frontend" / "finetune_samples"
        print(f"Looking for finetune samples in: {finetune_samples_dir}")
        finetune_samples = find_samples(finetune_samples_dir)
        print(f"Found {len(finetune_samples)} finetune audio files")
        samples.extend(finetune_samples)

    if not samples:
        print("No samples found!")
        return

    print(f"Found {len(samples)} total audio files")

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

        random_seed = int(time.time())
        augmenter.config.random_seed = random_seed
        augmenter._rng = np.random.default_rng(random_seed)

    extractor = FeatureExtractor(n_harmonics=12)
    all_features: list[WindowFeatures] = []
    augmentation_stats = {"total_augmented": 0, "effects_applied": defaultdict(int)}

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
            )
            all_features.extend(features)

        except Exception as e:
            print(f"  Error processing {path}: {e}")
    print(f"Processed {len(all_features)} windows from {len(samples)} samples with {augmentation_stats['total_augmented']} augmented samples")

    # Validate fundamental frequencies
    print("\n--- Frequency Validation ---")
    original_count = len(all_features)
    all_features, discarded_samples = validate_fundamental_frequencies(all_features, tolerance=0.05)
    discarded_count = original_count - len(all_features)

    if discarded_samples:
        print(f"Discarded {discarded_count} windows from {len(discarded_samples)} samples with invalid fundamental frequencies (>5% deviation):")
        for sample in discarded_samples:
            print(f"  - {sample['sample_id']} (string {sample['string']}, fret {sample['fret']}): "
                  f"detected {sample['detected_freq']:.1f} Hz, expected {sample['expected_freq']:.1f} Hz")
    else:
        print("All samples passed frequency validation (within ±5% of expected)")

    # Create output with metadata
    output_data = {
        "extracted_at": datetime.now().isoformat(),
        "window_size": WINDOW_SIZE,
        "target_rms": TARGET_RMS,
        "total_windows": len(all_features),
        "total_audio_files": len(samples),
        "strings_covered": sorted(list(set(f["string"] for f in all_features))),
        "augmentation_enabled": use_augmentation and args.augment,
        "augmentation_preset": args.augment_preset if (use_augmentation and args.augment) else None,
        "n_augmentations_per_sample": NUM_AUGMENTATIONS,
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
        ],
        "samples": all_features,
    }

    # Save with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = "_augmented" if args.augment else ""
    output_path = output_dir / f"{timestamp}{suffix}.json"

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

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2, cls=NumpyEncoder)

    print(f"\nFeatures saved to: {output_path}")
    if use_augmentation and args.augment:
        original_count = sum(1 for f in all_features if "_aug" not in f["sample_id"])
        augmented_count = len(all_features) - original_count
        print(f"  Original windows: {original_count}")
        print(f"  Augmented windows: {augmented_count}")

    # Print summary statistics
    if all_features:
        print("\n--- Feature Summary ---")
        for string_num in sorted(set(f["string"] for f in all_features)):
            string_windows = [f for f in all_features if f["string"] == string_num]
            fundamentals = [f["fundamental_freq"] for f in string_windows]
            slopes = [f["energy_slope"] for f in string_windows]
            print(f"String {string_num}: {len(string_windows)} windows, "
                  f"avg fundamental: {np.mean(fundamentals):.1f} Hz, "
                  f"avg energy_slope: {np.mean(slopes):.3f}")


if __name__ == "__main__":
    main()
