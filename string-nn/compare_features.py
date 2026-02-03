"""
Compare features extracted in browser (TypeScript) vs Python.

Usage:
  python compare_features.py debug_s1_f0_1234567890.json

This script:
1. Loads the debug JSON exported from the browser
2. Extracts features from the raw audio samples using Python
3. Compares browser vs Python extraction to identify discrepancies
"""

import json
import sys
from pathlib import Path

import numpy as np

from main import FeatureExtractor, WINDOW_SIZE
from features_config import (
    ALL_FEATURE_NAMES,
    get_enabled_feature_names,
    get_enabled_indices,
)

# Target RMS to match browser normalization (from useStringClassifier.ts)
TARGET_RMS = 0.026


def normalize_audio_amplitude(samples: np.ndarray, target_rms: float) -> np.ndarray:
    """Normalize audio to target RMS level (matches browser normalization)."""
    current_rms = np.sqrt(np.mean(samples ** 2))
    if current_rms < 1e-10:
        return samples
    gain = target_rms / current_rms
    return samples * gain


def load_debug_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def extract_python_features(samples: np.ndarray, sample_rate: int) -> dict:
    """Extract features using the Python pipeline (matches train.py feature order)."""
    extractor = FeatureExtractor(n_harmonics=12)

    # Use window size matching training
    window = samples[:WINDOW_SIZE] if len(samples) >= WINDOW_SIZE else samples

    # Extract fundamental
    fundamental = extractor.extract_fundamental(window, sample_rate)

    # Extract all features
    harmonic_ratios = extractor.extract_harmonic_ratios(window, sample_rate, fundamental)
    spectral_centroid = extractor.extract_spectral_centroid(window, sample_rate)
    spectral_rolloff = extractor.extract_spectral_rolloff(window, sample_rate)
    inharmonicity = extractor.extract_inharmonicity(window, sample_rate, fundamental)
    rms_energy = extractor.extract_rms_energy(window)
    energy_slope = extractor.extract_energy_slope(window)
    zcr = extractor.extract_zcr(window)
    odd_even_harmonic_ratio = extractor.extract_odd_even_harmonic_ratio(window, sample_rate, fundamental)

    log_frequency, semitones_from_e2, octave_number = (
        extractor.extract_frequency_relative_features(fundamental)
    )

    mfcc = extractor.extract_mfcc_single(window, sample_rate)

    # Build feature vector in same order as train.py (35 features total)
    feature_vector = []
    feature_vector.extend(harmonic_ratios)  # 12 values
    feature_vector.append(spectral_centroid)
    feature_vector.append(spectral_rolloff)
    feature_vector.append(inharmonicity)
    feature_vector.append(rms_energy)
    feature_vector.append(energy_slope)
    feature_vector.append(zcr)
    feature_vector.append(odd_even_harmonic_ratio)
    feature_vector.append(log_frequency)
    feature_vector.append(semitones_from_e2)
    feature_vector.append(octave_number)
    feature_vector.extend(mfcc)  # 13 values

    return {
        "fundamental": fundamental,
        "feature_vector": feature_vector,
        "details": {
            "harmonic_ratios": harmonic_ratios,
            "spectral_centroid": spectral_centroid,
            "spectral_rolloff": spectral_rolloff,
            "inharmonicity": inharmonicity,
            "rms_energy": rms_energy,
            "energy_slope": energy_slope,
            "zcr": zcr,
            "odd_even_harmonic_ratio": odd_even_harmonic_ratio,
            "log_frequency": log_frequency,
            "semitones_from_e2": semitones_from_e2,
            "octave_number": octave_number,
            "mfcc": mfcc,
        }
    }



STRING_LABELS = ["E2 (Low)", "A2", "D3", "G3", "B3", "E4 (High)"]


def filter_features(features: list, indices: list[int]) -> list:
    """Filter feature vector to only include features at given indices."""
    return [features[i] for i in indices]


def compare_features(
    browser_features: list,
    python_features: list,
) -> list:
    """Compare browser vs Python feature vectors and return significant differences.

    Args:
        browser_features: Feature vector from browser (may be filtered to enabled only)
        python_features: Full feature vector from Python (all 35 features)
    """
    significant_diffs = []

    enabled_indices = get_enabled_indices()
    enabled_names = get_enabled_feature_names()
    num_enabled = len(enabled_names)

    # Browser may send all features or just enabled features - detect by length
    if len(browser_features) == num_enabled:
        # Browser already filtered to enabled features
        browser_filtered = browser_features
        python_filtered = filter_features(python_features, enabled_indices)
        feature_names = enabled_names
        print(f"\nComparing {num_enabled} ENABLED features (browser pre-filtered)")
    elif len(browser_features) == len(ALL_FEATURE_NAMES):
        # Browser sent all features, filter both
        browser_filtered = filter_features(browser_features, enabled_indices)
        python_filtered = filter_features(python_features, enabled_indices)
        feature_names = enabled_names
        print(f"\nComparing {num_enabled} ENABLED features (of {len(ALL_FEATURE_NAMES)} total)")
    else:
        # Unexpected length - compare as-is with warning
        print(f"\nWARNING: Browser has {len(browser_features)} features, expected {num_enabled} or {len(ALL_FEATURE_NAMES)}")
        print("Comparing features up to browser length")
        browser_filtered = browser_features
        python_filtered = python_features[:len(browser_features)]
        feature_names = [f"feature_{i}" for i in range(len(browser_features))]

    print(f"\n{'Feature':<25} {'Browser':>12} {'Python':>12} {'Diff':>12} {'%Diff':>10}")
    print("-" * 80)

    for i, name in enumerate(feature_names):
        browser_val = browser_filtered[i]
        python_val = python_filtered[i]
        diff = browser_val - python_val

        if abs(python_val) > 1e-6:
            pct_diff = (diff / abs(python_val)) * 100
        elif abs(browser_val) > 1e-6:
            pct_diff = float('inf') if diff != 0 else 0
        else:
            pct_diff = 0

        is_significant = abs(pct_diff) > 10 or (abs(diff) > 0.1 and abs(pct_diff) > 5)
        marker = " ***" if is_significant else ""

        if is_significant:
            significant_diffs.append((name, browser_val, python_val, diff, pct_diff))

        pct_str = f"{pct_diff:>9.1f}%" if abs(pct_diff) < 1e6 else "    inf%"
        print(f"{name:<25} {browser_val:>12.4f} {python_val:>12.4f} {diff:>12.4f} {pct_str}{marker}")

    return significant_diffs


def main():
    if len(sys.argv) < 2:
        print("Usage: python compare_features.py <debug_json_file>")
        print("\nExport a debug JSON from the browser model-test page first.")
        sys.exit(1)

    debug_file = Path(sys.argv[1])
    if not debug_file.exists():
        print(f"File not found: {debug_file}")
        sys.exit(1)

    script_dir = Path(__file__).parent

    print(f"Loading debug data from: {debug_file}")
    debug_data = load_debug_json(debug_file)

    # Extract info from debug JSON
    audio_samples = np.array(debug_data["audio"]["samples"], dtype=np.float32)
    sample_rate = debug_data["audio"]["sampleRate"]
    browser_raw_features = debug_data["features"]["raw"]
    browser_normalized_features = debug_data["features"]["normalized"]
    browser_prediction = debug_data["prediction"]
    scaler = debug_data.get("scaler")
    expected = debug_data.get("expected", {})
    expected_string = expected.get("string", 0)
    expected_fret = expected.get("fret", 0)

    print(f"\n{'='*60}")
    print("INPUT DATA")
    print("="*60)
    print(f"Expected note: String {expected_string} ({STRING_LABELS[expected_string]}), Fret {expected_fret}")
    print(f"Browser audio: {len(audio_samples)} samples @ {sample_rate} Hz ({len(audio_samples)/sample_rate*1000:.1f} ms)")
    print(f"Browser prediction: {browser_prediction['stringLabel']} (confidence: {browser_prediction['confidence']*100:.1f}%)")

    correct = browser_prediction['stringIndex'] == expected_string
    print(f"Prediction correct: {'YES' if correct else 'NO'}")

    # Extract Python features from browser audio
    print(f"\n{'='*60}")
    print("EXTRACTING FEATURES")
    print("="*60)

    # Normalize browser audio to match training data levels (same as browser does)
    raw_rms = np.sqrt(np.mean(audio_samples ** 2))
    audio_samples_normalized = normalize_audio_amplitude(audio_samples, TARGET_RMS)
    normalized_rms = np.sqrt(np.mean(audio_samples_normalized ** 2))
    print(f"\nBrowser audio normalization:")
    print(f"  Raw RMS: {raw_rms:.6f}")
    print(f"  Normalized RMS: {normalized_rms:.6f} (target: {TARGET_RMS})")
    print(f"  Gain applied: {normalized_rms/raw_rms:.2f}x")

    print("\nExtracting features from browser audio using Python...")
    python_result = extract_python_features(audio_samples_normalized, sample_rate)
    python_features = python_result["feature_vector"]
    browser_fundamental = debug_data["features"].get("fundamental")
    print(f"  Python fundamental: {python_result['fundamental']:.2f} Hz")
    if browser_fundamental:
        print(f"  Browser fundamental: {browser_fundamental:.2f} Hz")
    else:
        print("  Browser fundamental: N/A")

    # Compare features
    print(f"\n{'='*60}")
    print("FEATURE COMPARISON (Browser vs Python)")
    print("="*60)
    print("\nComparing features extracted by TypeScript in the browser")
    print("vs features extracted by Python from the same audio data.")

    diffs = compare_features(browser_raw_features, python_features)

    # Summary
    print(f"\n{'='*60}")
    print("DIAGNOSIS")
    print("="*60)

    if diffs:
        print(f"\n[EXTRACTION ISSUE] {len(diffs)} features differ between Browser and Python")
        print("  The TypeScript and Python feature extraction algorithms produce different results.")
        print("\n  Features with significant differences:")
        for name, b_val, p_val, diff, pct in diffs:
            pct_str = f"{pct:.1f}%" if abs(pct) < 1e6 else "inf%"
            print(f"    {name}: Browser={b_val:.4f}, Python={p_val:.4f} ({pct_str} diff)")
    else:
        print("\n[OK] Browser and Python extract similar features from the same audio")
        print("  Feature extraction is consistent between implementations.")

    # Run model predictions
    if scaler:
        print(f"\n{'='*60}")
        print("MODEL PREDICTIONS")
        print("="*60)

        try:
            import torch
            from model import StringClassifier

            model_path = script_dir / "data" / "models" / "string_classifier.pt"
            if model_path.exists():
                checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
                model = StringClassifier(
                    input_size=checkpoint["input_size"],
                    num_classes=checkpoint["num_classes"],
                )
                model.load_state_dict(checkpoint["model_state_dict"])
                model.eval()

                string_labels = ["E2", "A2", "D3", "G3", "B3", "E4"]

                # Filter to enabled features only
                enabled_indices = get_enabled_indices()
                enabled_names = get_enabled_feature_names()
                print(f"\n   Using {len(enabled_names)} enabled features for predictions")

                # Predict with browser features (already filtered/normalized by browser)
                print("\n1. Using BROWSER-extracted features:")
                browser_tensor = torch.FloatTensor([browser_normalized_features])
                with torch.no_grad():
                    browser_probs = torch.softmax(model(browser_tensor), dim=1)[0]
                browser_pred = browser_probs.argmax().item()
                print(f"   Prediction: {string_labels[browser_pred]} ({browser_probs[browser_pred]*100:.1f}%)")
                print(f"   All: {[f'{string_labels[i]}:{p*100:.0f}%' for i, p in enumerate(browser_probs.tolist())]}")

                # Filter Python features to enabled only, then normalize
                python_filtered = filter_features(python_features, enabled_indices)
                python_normalized = [
                    (v - scaler["mean"][i]) / scaler["scale"][i]
                    for i, v in enumerate(python_filtered)
                ]
                print("\n2. Using PYTHON-extracted features (from same audio):")
                py_tensor = torch.FloatTensor([python_normalized])
                with torch.no_grad():
                    py_probs = torch.softmax(model(py_tensor), dim=1)[0]
                py_pred = py_probs.argmax().item()
                print(f"   Prediction: {string_labels[py_pred]} ({py_probs[py_pred]*100:.1f}%)")
                print(f"   All: {[f'{string_labels[i]}:{p*100:.0f}%' for i, p in enumerate(py_probs.tolist())]}")

                print(f"\n   Expected: {string_labels[expected_string]}")

                # Prediction comparison
                print(f"\n{'='*60}")
                print("PREDICTION ANALYSIS")
                print("="*60)
                if browser_pred == py_pred:
                    if browser_pred == expected_string:
                        print("\n[OK] Both extractors produce the CORRECT prediction")
                    else:
                        print(f"\n[DATA ISSUE] Both extractors predict {string_labels[browser_pred]}, but expected {string_labels[expected_string]}")
                        print("  Feature extraction is consistent, but the model misclassifies this audio.")
                else:
                    print(f"\n[EXTRACTION ISSUE] Different predictions:")
                    print(f"  Browser features -> {string_labels[browser_pred]}")
                    print(f"  Python features  -> {string_labels[py_pred]}")
                    print(f"  Expected         -> {string_labels[expected_string]}")
                    print("  The extraction differences are significant enough to change the prediction.")

        except Exception as e:
            print(f"Could not load model: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
