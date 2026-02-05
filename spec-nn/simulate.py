"""
Browser simulation test for the guitar string classifier.

Loads labeled audio sessions and simulates real-time browser inference
by sliding a window across the audio with the same parameters as the
frontend's useSpectrogramClassifier hook. Reports accuracy metrics
to estimate real-world browser performance.
"""

import json
import time
import numpy as np
import librosa
import torch
from pathlib import Path

from model import SpectrogramClassifier, SpectrogramClassifierLarge
from features.spectrogram import (
    SAMPLE_RATE,
    WINDOW_SIZE,
    N_FFT,
    HOP_LENGTH,
    N_MELS,
    FMIN,
    FMAX,
    TARGET_RMS,
    calculate_rms,
    normalize_audio_amplitude,
    audio_to_mel_spectrogram,
)

# Match browser constants from useSpectrogramClassifier.ts
INFERENCE_HOP = 2048
MIN_RMS_THRESHOLD = 0.0015

# --- Window filtering thresholds ---

# Maximum fraction of the window that can be unlabeled (silent/no label).
# 0.0 = no silence allowed (every frame must be labeled)
# 1.0 = any amount of silence is fine (effectively disables this check)
MAX_SILENCE_THRESHOLD = 0.75

# Minimum fraction of the window that must be covered by labels (any labels combined).
# 1.0 = the entire window must be labeled
# 0.0 = no coverage required (effectively disables this check)
LABEL_COVERAGE_REQUIREMENT = 0.8

# Minimum fraction of the window the dominant label must cover.
# When a window contains multiple labels, this requires one label to be
# clearly dominant. The dominant label becomes the ground truth.
# 1.0 = window must be 100% one label (no other labels allowed)
# 0.0 = any dominant fraction is fine (effectively disables this check)
MULTIPLE_LABEL_THRESHOLD = 0.75

STRING_NAMES = ["E2(6)", "A2(5)", "D3(4)", "G3(3)", "B3(2)", "E4(1)"]


def load_model(model_path: Path):
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)

    model_type = checkpoint.get("model_type", "small")
    n_mels = checkpoint["n_mels"]
    time_frames = checkpoint["time_frames"]
    num_classes = checkpoint["num_classes"]
    dropout = checkpoint.get("dropout", 0.3)
    config = checkpoint["config"]
    stats = checkpoint["stats"]

    if model_type == "large":
        model = SpectrogramClassifierLarge(
            n_mels=n_mels, time_frames=time_frames,
            num_classes=num_classes, dropout=dropout,
        )
    else:
        model = SpectrogramClassifier(
            n_mels=n_mels, time_frames=time_frames,
            num_classes=num_classes, dropout=dropout,
        )

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    return model, config, stats


def find_label_sessions(label_dir: Path) -> list[Path]:
    sessions = []
    if not label_dir.exists():
        return sessions
    for session_dir in sorted(label_dir.iterdir()):
        if not session_dir.is_dir():
            continue
        if (session_dir / "audio.wav").exists() and (session_dir / "labels.json").exists():
            sessions.append(session_dir)
    return sessions


def analyze_window_labels(
    intervals: list[dict], window_start_ms: float, window_end_ms: float,
) -> tuple[float, int | None, float]:
    """
    Analyze label coverage within a window.

    Returns (label_coverage, dominant_label, dominant_fraction) where:
    - label_coverage: fraction of window covered by any labels combined (0-1)
    - dominant_label: the string label covering the most of the window (None if no labels)
    - dominant_fraction: fraction of the total window covered by the dominant label (0-1)
    """
    window_duration = window_end_ms - window_start_ms

    label_durations: dict[int, float] = {}
    total_covered = 0.0

    for interval in intervals:
        overlap_start = max(window_start_ms, interval["startMs"])
        overlap_end = min(window_end_ms, interval["endMs"])

        if overlap_start < overlap_end:
            overlap = overlap_end - overlap_start
            string_label = interval["string"]
            label_durations[string_label] = label_durations.get(string_label, 0) + overlap
            total_covered += overlap

    label_coverage = total_covered / window_duration

    if not label_durations:
        return 0.0, None, 0.0

    dominant_label = max(label_durations, key=label_durations.get)
    dominant_fraction = label_durations[dominant_label] / window_duration

    return label_coverage, dominant_label, dominant_fraction


def simulate_session(
    session_dir: Path,
    model: torch.nn.Module,
    stats: dict,
    device: torch.device,
) -> tuple[list[int], list[int], int, int, int, int]:
    """
    Simulate browser inference on a single label session.

    Returns (predictions, labels, total_windows, skipped_silence, skipped_coverage, skipped_dominant).
    """
    audio_path = session_dir / "audio.wav"
    labels_path = session_dir / "labels.json"

    with open(labels_path) as f:
        label_data = json.load(f)
    intervals = label_data["intervals"]

    y, _ = librosa.load(str(audio_path), sr=SAMPLE_RATE)

    mean = stats["mean"]
    std = stats["std"]

    predictions = []
    labels = []
    total_windows = 0
    skipped_silence = 0
    skipped_coverage = 0
    skipped_dominant = 0

    for window_end in range(WINDOW_SIZE, len(y) + 1, INFERENCE_HOP):
        window_start = window_end - WINDOW_SIZE
        window = y[window_start:window_end]

        # RMS gate (matching browser MIN_RMS_THRESHOLD)
        rms = calculate_rms(window)
        if rms <= MIN_RMS_THRESHOLD:
            continue

        total_windows += 1

        window_start_ms = window_start / SAMPLE_RATE * 1000.0
        window_end_ms = window_end / SAMPLE_RATE * 1000.0

        label_coverage, dominant_label, dominant_fraction = analyze_window_labels(
            intervals, window_start_ms, window_end_ms,
        )

        # 1. MAX_SILENCE_THRESHOLD: skip if too much of the window is unlabeled
        unlabeled_fraction = 1.0 - label_coverage
        if unlabeled_fraction > MAX_SILENCE_THRESHOLD:
            skipped_silence += 1
            continue

        # 2. LABEL_COVERAGE_REQUIREMENT: skip if not enough label coverage
        if label_coverage < LABEL_COVERAGE_REQUIREMENT:
            skipped_coverage += 1
            continue

        # 3. MULTIPLE_LABEL_THRESHOLD: skip if dominant label isn't dominant enough
        if dominant_fraction < MULTIPLE_LABEL_THRESHOLD:
            skipped_dominant += 1
            continue

        # Normalize amplitude (matching browser)
        normalized = normalize_audio_amplitude(window, TARGET_RMS)

        # Compute mel spectrogram
        mel_spec = audio_to_mel_spectrogram(normalized)

        # Normalize with training stats (matching browser)
        mel_spec = (mel_spec - mean) / (std + 1e-8)

        # Run inference
        input_tensor = torch.FloatTensor(mel_spec).unsqueeze(0).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(input_tensor)
            predicted = logits.argmax(dim=1).item()

        predictions.append(predicted)
        labels.append(dominant_label)

    print(
        f"  {session_dir.name}: "
        f"{len(predictions)} evaluated, "
        f"{total_windows} passed RMS, "
        f"{skipped_silence} failed silence, "
        f"{skipped_coverage} failed coverage, "
        f"{skipped_dominant} failed dominant"
    )

    return predictions, labels, total_windows, skipped_silence, skipped_coverage, skipped_dominant


def print_simulation_report(
    all_labels: list[int],
    all_predictions: list[int],
    num_classes: int = 6,
):
    labels = np.array(all_labels)
    predictions = np.array(all_predictions)

    correct = int(np.sum(predictions == labels))
    total = len(labels)
    overall_acc = correct / total

    print(f"\nOverall Accuracy: {overall_acc:.4f} ({correct}/{total})")

    # Confusion matrix
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for true, pred in zip(labels, predictions):
        cm[true][pred] += 1

    print("\nConfusion Matrix (rows=actual, cols=predicted):")
    header = "        " + " ".join(f"{name:>6}" for name in STRING_NAMES)
    print(header)
    for i, name in enumerate(STRING_NAMES):
        row = " ".join(f"{cm[i][j]:>6}" for j in range(num_classes))
        print(f"{name:>7} {row}")

    # Per-class metrics
    print(f"\n{'String':>7} {'Prec':>7} {'Recall':>7} {'F1':>7} {'Support':>7}")
    print("-" * 39)

    macro_p, macro_r, macro_f1 = 0.0, 0.0, 0.0
    total_support = 0
    classes_with_support = 0

    for i, name in enumerate(STRING_NAMES):
        tp = cm[i][i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        support = cm[i, :].sum()

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        print(f"{name:>7} {precision:>7.4f} {recall:>7.4f} {f1:>7.4f} {support:>7}")

        if support > 0:
            macro_p += precision
            macro_r += recall
            macro_f1 += f1
            classes_with_support += 1
        total_support += support

    print("-" * 39)
    if classes_with_support > 0:
        print(
            f"{'Macro':>7} "
            f"{macro_p / classes_with_support:>7.4f} "
            f"{macro_r / classes_with_support:>7.4f} "
            f"{macro_f1 / classes_with_support:>7.4f} "
            f"{total_support:>7}"
        )

    # Top confused pairs
    confused_pairs = []
    for i in range(num_classes):
        for j in range(num_classes):
            if i != j and cm[i][j] > 0:
                confused_pairs.append((cm[i][j], i, j))
    confused_pairs.sort(reverse=True)

    if confused_pairs:
        print("\nTop confused pairs:")
        for count, true, pred in confused_pairs[:5]:
            total_for_class = cm[true, :].sum()
            pct = count / total_for_class * 100 if total_for_class > 0 else 0
            print(f"  {STRING_NAMES[true]} -> {STRING_NAMES[pred]}: {count} ({pct:.1f}% of {STRING_NAMES[true]})")


def simulate(
    model_path: Path | None = None,
    label_dir: Path | None = None,
):
    print("\n====== Browser Simulation ======\n")

    script_dir = Path(__file__).parent

    if model_path is None:
        model_path = script_dir / "data" / "models" / "spec_classifier.pt"
    if label_dir is None:
        label_dir = script_dir.parent / "frontend" / "label_sessions"

    if not model_path.exists():
        print(f"Model not found: {model_path}")
        print("Train the model first with: python main.py -t")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    print(f"Window: {WINDOW_SIZE} samples ({WINDOW_SIZE / SAMPLE_RATE * 1000:.1f}ms)")
    print(f"Inference hop: {INFERENCE_HOP} samples ({INFERENCE_HOP / SAMPLE_RATE * 1000:.1f}ms)")
    print(f"RMS threshold: {MIN_RMS_THRESHOLD}")
    print(f"Max silence: {MAX_SILENCE_THRESHOLD:.0%}")
    print(f"Label coverage required: {LABEL_COVERAGE_REQUIREMENT:.0%}")
    print(f"Dominant label threshold: {MULTIPLE_LABEL_THRESHOLD:.0%}")

    model, config, stats = load_model(model_path)
    model = model.to(device)
    print(f"Model loaded: {model_path.name}")
    print(f"Normalization: mean={stats['mean']:.4f}, std={stats['std']:.4f}")

    sessions = find_label_sessions(label_dir)
    if not sessions:
        print(f"\nNo label sessions found in: {label_dir}")
        return

    print(f"\nFound {len(sessions)} label sessions\n")

    all_predictions = []
    all_labels = []
    total_windows = 0
    total_skipped_silence = 0
    total_skipped_coverage = 0
    total_skipped_dominant = 0

    start_time = time.time()

    for session_dir in sessions:
        preds, labs, windows, s_silence, s_coverage, s_dominant = simulate_session(
            session_dir, model, stats, device,
        )
        all_predictions.extend(preds)
        all_labels.extend(labs)
        total_windows += windows
        total_skipped_silence += s_silence
        total_skipped_coverage += s_coverage
        total_skipped_dominant += s_dominant

    elapsed = time.time() - start_time

    if not all_predictions:
        print("\nNo eligible predictions were made.")
        return

    print(f"\n--- Summary ---")
    print(f"Sessions: {len(sessions)}")
    print(f"Windows passed RMS: {total_windows}")
    print(f"Skipped (too much silence): {total_skipped_silence}")
    print(f"Skipped (low label coverage): {total_skipped_coverage}")
    print(f"Skipped (no dominant label): {total_skipped_dominant}")
    print(f"Evaluated predictions: {len(all_predictions)}")
    print(f"Time: {elapsed:.2f}s")

    print_simulation_report(all_labels, all_predictions)


if __name__ == "__main__":
    simulate()
