"""
Audit all training samples to verify their fundamental frequencies match expected values.
"""

import json
from pathlib import Path

import librosa
import numpy as np

from main import FeatureExtractor, find_samples

# Standard tuning frequencies for each string (open)
OPEN_STRING_FREQS = {
    0: 82.41,   # E2
    1: 110.00,  # A2
    2: 146.83,  # D3
    3: 196.00,  # G3
    4: 246.94,  # B3
    5: 329.63,  # E4
}

# Semitone ratio
SEMITONE_RATIO = 2 ** (1/12)


def expected_frequency(string: int, fret: int) -> float:
    """Calculate expected frequency for a given string and fret."""
    open_freq = OPEN_STRING_FREQS[string]
    return open_freq * (SEMITONE_RATIO ** fret)


def main():
    script_dir = Path(__file__).parent
    samples_dir = script_dir.parent / "frontend" / "samples"

    print(f"Auditing samples in: {samples_dir}\n")
    samples = find_samples(samples_dir)

    if not samples:
        print("No samples found!")
        return

    print(f"Found {len(samples)} samples\n")

    extractor = FeatureExtractor(n_harmonics=12)

    issues = []
    good_samples = []

    print(f"{'Path':<50} {'String':>6} {'Fret':>4} {'Expected':>10} {'Detected':>10} {'Error%':>8} {'Status':>8}")
    print("-" * 110)

    for path, string_num, fret_num in sorted(samples, key=lambda x: (x[1], x[2])):
        try:
            y, sr = librosa.load(str(path), sr=None)

            # Trim silence
            y_trimmed, _ = librosa.effects.trim(y, top_db=20)
            if len(y_trimmed) > sr * 0.1:
                y = y_trimmed

            # Take first window
            window_size = 4096
            window = y[:window_size] if len(y) >= window_size else y

            detected_freq = extractor.extract_fundamental(window, sr)
            expected_freq = expected_frequency(string_num, fret_num)

            if expected_freq > 0 and detected_freq > 0:
                error_pct = abs(detected_freq - expected_freq) / expected_freq * 100
            else:
                error_pct = 100.0

            # Check if error is within acceptable range (10% tolerance for pitch detection)
            status = "OK" if error_pct < 15 else "BAD"

            rel_path = str(path.relative_to(samples_dir))
            print(f"{rel_path:<50} {string_num:>6} {fret_num:>4} {expected_freq:>10.2f} {detected_freq:>10.2f} {error_pct:>7.1f}% {status:>8}")

            if status == "BAD":
                issues.append({
                    "path": str(path),
                    "string": string_num,
                    "fret": fret_num,
                    "expected_freq": expected_freq,
                    "detected_freq": detected_freq,
                    "error_pct": error_pct,
                })
            else:
                good_samples.append({
                    "path": str(path),
                    "string": string_num,
                    "fret": fret_num,
                    "expected_freq": expected_freq,
                    "detected_freq": detected_freq,
                })

        except Exception as e:
            print(f"{path.name:<50} {string_num:>6} {fret_num:>4} {'ERROR':>10} {str(e)[:30]}")
            issues.append({
                "path": str(path),
                "string": string_num,
                "fret": fret_num,
                "error": str(e),
            })

    print("\n" + "=" * 110)
    print("SUMMARY")
    print("=" * 110)
    print(f"\nTotal samples: {len(samples)}")
    print(f"Good samples: {len(good_samples)}")
    print(f"Problematic samples: {len(issues)}")

    if issues:
        print("\n--- PROBLEMATIC SAMPLES ---")
        for issue in issues:
            if "error" in issue:
                print(f"  {issue['path']}: {issue['error']}")
            else:
                print(f"  String {issue['string']}, Fret {issue['fret']}: "
                      f"Expected {issue['expected_freq']:.1f}Hz, Got {issue['detected_freq']:.1f}Hz "
                      f"({issue['error_pct']:.1f}% off)")

    # Distribution by string
    print("\n--- SAMPLES PER STRING ---")
    string_counts = {}
    good_string_counts = {}
    for s in range(6):
        string_counts[s] = len([x for x in samples if x[1] == s])
        good_string_counts[s] = len([x for x in good_samples if x["string"] == s])

    for s in range(6):
        status = "OK" if good_string_counts[s] > 0 else "MISSING GOOD DATA"
        print(f"  String {s}: {good_string_counts[s]}/{string_counts[s]} good samples - {status}")

    # Save report
    report = {
        "total_samples": len(samples),
        "good_samples": len(good_samples),
        "problematic_samples": len(issues),
        "issues": issues,
        "good": good_samples,
    }

    report_path = script_dir / "data" / "audit_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report saved to: {report_path}")


if __name__ == "__main__":
    main()
