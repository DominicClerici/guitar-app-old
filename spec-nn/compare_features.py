"""
Compare browser-generated spectrograms with Python-generated spectrograms.

This script loads debug data captured from the browser and compares it
with spectrograms generated using the same parameters in Python (librosa).
This helps identify discrepancies between the TypeScript and Python
spectrogram implementations.

Usage:
    python compare_features.py path/to/spectrogram_debug_*.json
"""

import argparse
import json
import numpy as np
import librosa
import matplotlib.pyplot as plt
from pathlib import Path


def load_debug_data(json_path: str) -> dict:
    """Load the debug JSON file captured from the browser."""
    with open(json_path, "r") as f:
        return json.load(f)


def compute_python_spectrogram(
    audio: np.ndarray,
    sr: int,
    n_fft: int,
    hop_length: int,
    n_mels: int,
    fmin: float,
    fmax: float,
) -> np.ndarray:
    """
    Compute mel-spectrogram using librosa with the same parameters as main.py.
    This should match the Python training pipeline exactly.
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

    # Convert to dB scale with ref=np.max (matching main.py)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)

    return mel_spec_db


def compare_spectrograms(
    browser_spec: np.ndarray,
    python_spec: np.ndarray,
) -> dict:
    """
    Compare two spectrograms and return detailed statistics.
    """
    # Ensure same shape for comparison
    min_time = min(browser_spec.shape[1], python_spec.shape[1])
    browser_trimmed = browser_spec[:, :min_time]
    python_trimmed = python_spec[:, :min_time]

    diff = browser_trimmed - python_trimmed
    abs_diff = np.abs(diff)

    return {
        "browser_shape": browser_spec.shape,
        "python_shape": python_spec.shape,
        "compared_shape": (browser_spec.shape[0], min_time),
        "mean_absolute_error": float(np.mean(abs_diff)),
        "max_absolute_error": float(np.max(abs_diff)),
        "std_error": float(np.std(diff)),
        "mean_diff": float(np.mean(diff)),
        "browser_mean": float(np.mean(browser_trimmed)),
        "browser_std": float(np.std(browser_trimmed)),
        "browser_min": float(np.min(browser_trimmed)),
        "browser_max": float(np.max(browser_trimmed)),
        "python_mean": float(np.mean(python_trimmed)),
        "python_std": float(np.std(python_trimmed)),
        "python_min": float(np.min(python_trimmed)),
        "python_max": float(np.max(python_trimmed)),
        "correlation": float(np.corrcoef(browser_trimmed.flatten(), python_trimmed.flatten())[0, 1]),
        "rmse": float(np.sqrt(np.mean(diff ** 2))),
    }


def compare_per_mel_band(
    browser_spec: np.ndarray,
    python_spec: np.ndarray,
) -> list[dict]:
    """Compare spectrograms per mel band to identify frequency-specific issues."""
    min_time = min(browser_spec.shape[1], python_spec.shape[1])
    browser_trimmed = browser_spec[:, :min_time]
    python_trimmed = python_spec[:, :min_time]

    results = []
    for mel_idx in range(browser_trimmed.shape[0]):
        browser_band = browser_trimmed[mel_idx, :]
        python_band = python_trimmed[mel_idx, :]
        diff = browser_band - python_band

        results.append({
            "mel_band": mel_idx,
            "mean_abs_error": float(np.mean(np.abs(diff))),
            "max_abs_error": float(np.max(np.abs(diff))),
            "browser_mean": float(np.mean(browser_band)),
            "python_mean": float(np.mean(python_band)),
            "correlation": float(np.corrcoef(browser_band, python_band)[0, 1]) if np.std(browser_band) > 0 and np.std(python_band) > 0 else 0.0,
        })

    return results


def compare_per_time_frame(
    browser_spec: np.ndarray,
    python_spec: np.ndarray,
) -> list[dict]:
    """Compare spectrograms per time frame to identify temporal issues."""
    min_time = min(browser_spec.shape[1], python_spec.shape[1])
    browser_trimmed = browser_spec[:, :min_time]
    python_trimmed = python_spec[:, :min_time]

    results = []
    for t_idx in range(min_time):
        browser_frame = browser_trimmed[:, t_idx]
        python_frame = python_trimmed[:, t_idx]
        diff = browser_frame - python_frame

        results.append({
            "time_frame": t_idx,
            "mean_abs_error": float(np.mean(np.abs(diff))),
            "max_abs_error": float(np.max(np.abs(diff))),
            "browser_mean": float(np.mean(browser_frame)),
            "python_mean": float(np.mean(python_frame)),
            "correlation": float(np.corrcoef(browser_frame, python_frame)[0, 1]) if np.std(browser_frame) > 0 and np.std(python_frame) > 0 else 0.0,
        })

    return results


def plot_comparison(
    browser_spec: np.ndarray,
    python_spec: np.ndarray,
    output_path: Path,
):
    """Generate visualization comparing the two spectrograms."""
    min_time = min(browser_spec.shape[1], python_spec.shape[1])
    browser_trimmed = browser_spec[:, :min_time]
    python_trimmed = python_spec[:, :min_time]
    diff = browser_trimmed - python_trimmed

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Browser spectrogram
    im1 = axes[0, 0].imshow(browser_trimmed, aspect="auto", origin="lower", cmap="viridis")
    axes[0, 0].set_title("Browser Spectrogram (TypeScript)")
    axes[0, 0].set_xlabel("Time Frame")
    axes[0, 0].set_ylabel("Mel Band")
    plt.colorbar(im1, ax=axes[0, 0], label="dB")

    # Python spectrogram
    im2 = axes[0, 1].imshow(python_trimmed, aspect="auto", origin="lower", cmap="viridis")
    axes[0, 1].set_title("Python Spectrogram (librosa)")
    axes[0, 1].set_xlabel("Time Frame")
    axes[0, 1].set_ylabel("Mel Band")
    plt.colorbar(im2, ax=axes[0, 1], label="dB")

    # Difference
    max_diff = max(abs(np.min(diff)), abs(np.max(diff)))
    im3 = axes[1, 0].imshow(diff, aspect="auto", origin="lower", cmap="RdBu_r", vmin=-max_diff, vmax=max_diff)
    axes[1, 0].set_title("Difference (Browser - Python)")
    axes[1, 0].set_xlabel("Time Frame")
    axes[1, 0].set_ylabel("Mel Band")
    plt.colorbar(im3, ax=axes[1, 0], label="dB Difference")

    # Histogram of differences
    axes[1, 1].hist(diff.flatten(), bins=50, edgecolor="black", alpha=0.7)
    axes[1, 1].set_title(f"Distribution of Differences (MAE: {np.mean(np.abs(diff)):.2f} dB)")
    axes[1, 1].set_xlabel("Difference (dB)")
    axes[1, 1].set_ylabel("Count")
    axes[1, 1].axvline(x=0, color="red", linestyle="--", linewidth=1)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()

    print(f"Saved comparison plot to: {output_path}")


def plot_mel_band_comparison(
    browser_spec: np.ndarray,
    python_spec: np.ndarray,
    output_path: Path,
    num_bands: int = 8,
):
    """Plot a few mel bands side by side for detailed inspection."""
    min_time = min(browser_spec.shape[1], python_spec.shape[1])
    browser_trimmed = browser_spec[:, :min_time]
    python_trimmed = python_spec[:, :min_time]

    n_mels = browser_trimmed.shape[0]
    band_indices = np.linspace(0, n_mels - 1, num_bands, dtype=int)

    fig, axes = plt.subplots(num_bands, 1, figsize=(12, 2 * num_bands))

    for i, band_idx in enumerate(band_indices):
        ax = axes[i]
        time_axis = np.arange(min_time)

        ax.plot(time_axis, browser_trimmed[band_idx, :], label="Browser", alpha=0.8, linewidth=1.5)
        ax.plot(time_axis, python_trimmed[band_idx, :], label="Python", alpha=0.8, linewidth=1.5, linestyle="--")

        corr = np.corrcoef(browser_trimmed[band_idx, :], python_trimmed[band_idx, :])[0, 1]
        ax.set_title(f"Mel Band {band_idx} (r={corr:.3f})")
        ax.set_xlabel("Time Frame")
        ax.set_ylabel("dB")
        ax.legend(loc="upper right")
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close()

    print(f"Saved mel band comparison to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Compare browser and Python spectrograms for debugging."
    )
    parser.add_argument(
        "debug_file",
        type=str,
        help="Path to the debug JSON file captured from the browser"
    )
    parser.add_argument(
        "--no-plots",
        action="store_true",
        help="Skip generating visualization plots"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory to save comparison plots (default: same as debug file)"
    )

    args = parser.parse_args()

    debug_path = Path(args.debug_file)
    if not debug_path.exists():
        print(f"Error: Debug file not found: {debug_path}")
        return

    output_dir = Path(args.output_dir) if args.output_dir else debug_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading debug data from: {debug_path}")
    debug_data = load_debug_data(debug_path)

    # Extract config
    config = debug_data["config"]
    print("\n=== Configuration ===")
    print(f"  Sample Rate: {debug_data['sampleRate']} Hz")
    print(f"  Window Size: {config['windowSize']} samples")
    print(f"  N_FFT: {config['nFft']}")
    print(f"  Hop Length: {config['hopLength']}")
    print(f"  N_Mels: {config['nMels']}")
    print(f"  Fmin: {config['fmin']} Hz")
    print(f"  Fmax: {config['fmax']} Hz")
    print(f"  Target RMS: {config['targetRms']}")

    # Extract audio samples
    audio_samples = np.array(debug_data["audioSamples"], dtype=np.float32)
    print(f"\n=== Audio Data ===")
    print(f"  Samples: {len(audio_samples)}")
    print(f"  Duration: {len(audio_samples) / debug_data['sampleRate'] * 1000:.1f} ms")
    print(f"  RMS: {np.sqrt(np.mean(audio_samples ** 2)):.6f}")
    print(f"  Min: {np.min(audio_samples):.6f}")
    print(f"  Max: {np.max(audio_samples):.6f}")

    # Extract browser spectrogram (before normalization - this is what we compare)
    browser_spec = np.array(debug_data["spectrogramBeforeNorm"], dtype=np.float32)
    print(f"\n=== Browser Spectrogram ===")
    print(f"  Shape: {browser_spec.shape} (n_mels x time_frames)")
    print(f"  Mean: {np.mean(browser_spec):.2f} dB")
    print(f"  Std: {np.std(browser_spec):.2f} dB")
    print(f"  Min: {np.min(browser_spec):.2f} dB")
    print(f"  Max: {np.max(browser_spec):.2f} dB")

    # Generate Python spectrogram with same parameters
    print(f"\n=== Generating Python Spectrogram ===")
    python_spec = compute_python_spectrogram(
        audio=audio_samples,
        sr=debug_data["sampleRate"],
        n_fft=config["nFft"],
        hop_length=config["hopLength"],
        n_mels=config["nMels"],
        fmin=config["fmin"],
        fmax=config["fmax"],
    )
    print(f"  Shape: {python_spec.shape} (n_mels x time_frames)")
    print(f"  Mean: {np.mean(python_spec):.2f} dB")
    print(f"  Std: {np.std(python_spec):.2f} dB")
    print(f"  Min: {np.min(python_spec):.2f} dB")
    print(f"  Max: {np.max(python_spec):.2f} dB")

    # Compare spectrograms
    print(f"\n=== Comparison Results ===")
    comparison = compare_spectrograms(browser_spec, python_spec)

    print(f"\nShapes:")
    print(f"  Browser: {comparison['browser_shape']}")
    print(f"  Python: {comparison['python_shape']}")
    print(f"  Compared: {comparison['compared_shape']}")

    print(f"\nError Metrics:")
    print(f"  Mean Absolute Error: {comparison['mean_absolute_error']:.4f} dB")
    print(f"  Max Absolute Error: {comparison['max_absolute_error']:.4f} dB")
    print(f"  RMSE: {comparison['rmse']:.4f} dB")
    print(f"  Mean Difference: {comparison['mean_diff']:.4f} dB (positive = browser > python)")
    print(f"  Std of Difference: {comparison['std_error']:.4f} dB")

    print(f"\nCorrelation:")
    print(f"  Pearson r: {comparison['correlation']:.6f}")

    # Interpret results
    print(f"\n=== Interpretation ===")
    mae = comparison["mean_absolute_error"]
    corr = comparison["correlation"]

    if mae < 0.5 and corr > 0.99:
        print("✓ Spectrograms are VERY SIMILAR. Minor numerical differences only.")
    elif mae < 2.0 and corr > 0.95:
        print("⚠ Spectrograms are SIMILAR but have noticeable differences.")
        print("  This may cause minor model performance degradation.")
    elif mae < 5.0 and corr > 0.8:
        print("⚠ Spectrograms have MODERATE differences.")
        print("  This could significantly affect model accuracy.")
    else:
        print("✗ Spectrograms are SIGNIFICANTLY DIFFERENT.")
        print("  This is likely causing poor model performance.")

    # Per-mel-band analysis for worst offenders
    print(f"\n=== Per-Mel-Band Analysis (Top 5 worst) ===")
    mel_band_stats = compare_per_mel_band(browser_spec, python_spec)
    mel_band_stats_sorted = sorted(mel_band_stats, key=lambda x: x["mean_abs_error"], reverse=True)

    for stat in mel_band_stats_sorted[:5]:
        print(f"  Mel {stat['mel_band']:2d}: MAE={stat['mean_abs_error']:.2f} dB, "
              f"r={stat['correlation']:.3f}, "
              f"browser_mean={stat['browser_mean']:.1f}, python_mean={stat['python_mean']:.1f}")

    # Per-time-frame analysis
    print(f"\n=== Per-Time-Frame Analysis (Top 5 worst) ===")
    time_frame_stats = compare_per_time_frame(browser_spec, python_spec)
    time_frame_stats_sorted = sorted(time_frame_stats, key=lambda x: x["mean_abs_error"], reverse=True)

    for stat in time_frame_stats_sorted[:5]:
        print(f"  Frame {stat['time_frame']:2d}: MAE={stat['mean_abs_error']:.2f} dB, "
              f"r={stat['correlation']:.3f}")

    # Generate plots
    if not args.no_plots:
        print(f"\n=== Generating Plots ===")

        base_name = debug_path.stem

        plot_comparison(
            browser_spec,
            python_spec,
            output_dir / f"{base_name}_comparison.png"
        )

        plot_mel_band_comparison(
            browser_spec,
            python_spec,
            output_dir / f"{base_name}_mel_bands.png"
        )

    print(f"\n=== Done ===")


if __name__ == "__main__":
    main()
