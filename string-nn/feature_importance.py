"""
Feature importance analysis for guitar string classifier.

Analyzes which features contribute most to model predictions using:
1. Permutation importance - shuffles each feature and measures accuracy drop
2. Feature group analysis - evaluates importance of feature categories
3. Correlation analysis - identifies redundant features
"""

import json
import pickle
import warnings
from pathlib import Path
from collections import defaultdict
import time

import numpy as np
import torch
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler

from model import StringClassifier
from train import load_features_with_file_split, sample_to_feature_vector
from features_config import (
    get_enabled_feature_names,
    get_enabled_feature_groups,
    print_feature_summary,
)


# Feature names and groups are dynamically loaded based on ENABLED_FEATURES in features_config.py
FEATURE_NAMES = get_enabled_feature_names()
FEATURE_GROUPS = get_enabled_feature_groups()


def load_model_and_data(models_dir: Path, features_dir: Path):
    """Load trained model, scaler, and validation data."""
    model_path = models_dir / "string_classifier.pt"
    scaler_path = models_dir / "scaler.pkl"

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not scaler_path.exists():
        raise FileNotFoundError(f"Scaler not found: {scaler_path}")

    # Load model
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
    model = StringClassifier(
        input_size=checkpoint["input_size"],
        num_classes=checkpoint["num_classes"]
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Load scaler
    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)

    # Load validation data
    X_train, X_val, y_train, y_val = load_features_with_file_split(features_dir)

    # Scale the data
    X_val_scaled = scaler.transform(X_val)

    return model, scaler, X_val_scaled, y_val


def evaluate_accuracy(model: StringClassifier, X: np.ndarray, y: np.ndarray) -> float:
    """Evaluate model accuracy on given data."""
    model.eval()
    with torch.no_grad():
        X_tensor = torch.FloatTensor(X)
        outputs = model(X_tensor)
        _, predicted = outputs.max(1)
        accuracy = (predicted.numpy() == y).mean()
    return accuracy


def permutation_importance(
    model: StringClassifier,
    X: np.ndarray,
    y: np.ndarray,
    n_repeats: int = 50,
    random_state: int = 42
) -> dict:
    """
    Calculate permutation importance for each feature.

    Shuffles each feature independently and measures the drop in accuracy.
    Higher drop = more important feature.
    """
    rng = np.random.default_rng(random_state)
    baseline_acc = evaluate_accuracy(model, X, y)

    n_features = X.shape[1]
    importance_scores = np.zeros((n_features, n_repeats))

    print(f"\nBaseline accuracy: {baseline_acc:.4f}")
    print(f"Running permutation importance ({n_repeats} repeats per feature)...")

    for feat_idx in range(n_features):
        for repeat in range(n_repeats):
            X_permuted = X.copy()
            X_permuted[:, feat_idx] = rng.permutation(X_permuted[:, feat_idx])
            permuted_acc = evaluate_accuracy(model, X_permuted, y)
            importance_scores[feat_idx, repeat] = baseline_acc - permuted_acc

        if (feat_idx + 1) % 10 == 0:
            print(f"  Processed {feat_idx + 1}/{n_features} features")

    return {
        "baseline_accuracy": baseline_acc,
        "mean_importance": importance_scores.mean(axis=1),
        "std_importance": importance_scores.std(axis=1),
        "raw_scores": importance_scores,
    }


def group_importance(
    model: StringClassifier,
    X: np.ndarray,
    y: np.ndarray,
    n_repeats: int = 10,
    random_state: int = 42
) -> dict:
    """
    Calculate importance of feature groups by permuting all features in a group together.
    """
    rng = np.random.default_rng(random_state)
    baseline_acc = evaluate_accuracy(model, X, y)

    group_scores = {}

    print("\nCalculating feature group importance...")

    for group_name, feature_indices in FEATURE_GROUPS.items():
        scores = []
        for _ in range(n_repeats):
            X_permuted = X.copy()
            for feat_idx in feature_indices:
                X_permuted[:, feat_idx] = rng.permutation(X_permuted[:, feat_idx])
            permuted_acc = evaluate_accuracy(model, X_permuted, y)
            scores.append(baseline_acc - permuted_acc)

        group_scores[group_name] = {
            "mean": np.mean(scores),
            "std": np.std(scores),
            "n_features": len(feature_indices),
        }
        print(f"  {group_name}: {group_scores[group_name]['mean']:.4f} ± {group_scores[group_name]['std']:.4f}")

    return group_scores


def feature_correlation_analysis(X: np.ndarray) -> np.ndarray:
    """Calculate correlation matrix between features."""
    std = np.std(X, axis=0)
    constant_features = std == 0
    if np.any(constant_features):
        constant_names = [FEATURE_NAMES[i] for i in np.where(constant_features)[0]]
        print(f"  Note: {len(constant_names)} feature(s) have zero variance: {constant_names}")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        corr_matrix = np.corrcoef(X.T)

    corr_matrix = np.nan_to_num(corr_matrix, nan=0.0)
    return corr_matrix


def find_redundant_features(corr_matrix: np.ndarray, threshold: float = 0.95) -> list:
    """Find pairs of features with very high correlation (potentially redundant)."""
    n_features = corr_matrix.shape[0]
    redundant_pairs = []

    for i in range(n_features):
        for j in range(i + 1, n_features):
            if abs(corr_matrix[i, j]) >= threshold:
                redundant_pairs.append({
                    "feature_1": FEATURE_NAMES[i],
                    "feature_2": FEATURE_NAMES[j],
                    "correlation": corr_matrix[i, j],
                })

    return redundant_pairs


def ablation_study(
    model: StringClassifier,
    X: np.ndarray,
    y: np.ndarray,
    scaler: StandardScaler,
) -> dict:
    """
    Test model performance when each feature group is completely zeroed out.
    This shows which groups the model relies on most.
    """
    baseline_acc = evaluate_accuracy(model, X, y)

    print("\nRunning feature group ablation study...")

    ablation_results = {}

    for group_name, feature_indices in FEATURE_GROUPS.items():
        X_ablated = X.copy()
        # Zero out the features (after scaling, 0 is the mean)
        X_ablated[:, feature_indices] = 0
        ablated_acc = evaluate_accuracy(model, X_ablated, y)

        ablation_results[group_name] = {
            "accuracy_with_ablation": ablated_acc,
            "accuracy_drop": baseline_acc - ablated_acc,
            "relative_drop": (baseline_acc - ablated_acc) / baseline_acc if baseline_acc > 0 else 0,
        }
        print(f"  Without {group_name}: {ablated_acc:.4f} (drop: {ablation_results[group_name]['accuracy_drop']:.4f})")

    return ablation_results


def plot_importance(importance_results: dict, output_path: Path):
    """Create visualization of feature importance."""
    mean_imp = importance_results["mean_importance"]
    std_imp = importance_results["std_importance"]

    # Sort by importance
    sorted_indices = np.argsort(mean_imp)[::-1]

    fig, axes = plt.subplots(2, 2, figsize=(14, 12))

    # Top features bar plot
    ax1 = axes[0, 0]
    top_n = 15
    top_indices = sorted_indices[:top_n]
    ax1.barh(
        range(top_n),
        mean_imp[top_indices],
        xerr=std_imp[top_indices],
        capsize=3
    )
    ax1.set_yticks(range(top_n))
    ax1.set_yticklabels([FEATURE_NAMES[i] for i in top_indices])
    ax1.set_xlabel("Importance (accuracy drop when permuted)")
    ax1.set_title(f"Top {top_n} Most Important Features")
    ax1.invert_yaxis()

    # Bottom features bar plot
    ax2 = axes[0, 1]
    bottom_indices = sorted_indices[-top_n:][::-1]
    ax2.barh(
        range(top_n),
        mean_imp[bottom_indices],
        xerr=std_imp[bottom_indices],
        capsize=3,
        color="orange"
    )
    ax2.set_yticks(range(top_n))
    ax2.set_yticklabels([FEATURE_NAMES[i] for i in bottom_indices])
    ax2.set_xlabel("Importance (accuracy drop when permuted)")
    ax2.set_title(f"Top {top_n} Least Important Features")
    ax2.invert_yaxis()

    # Feature group importance
    ax3 = axes[1, 0]
    group_means = []
    group_names = []
    for group_name, indices in FEATURE_GROUPS.items():
        group_means.append(mean_imp[indices].sum())
        group_names.append(f"{group_name}\n({len(indices)} features)")

    colors = plt.cm.Set2(np.linspace(0, 1, len(group_names)))
    bars = ax3.bar(group_names, group_means, color=colors)
    ax3.set_ylabel("Total importance (sum)")
    ax3.set_title("Feature Group Total Importance")
    ax3.tick_params(axis='x', rotation=15)

    # All features sorted
    ax4 = axes[1, 1]
    ax4.bar(range(len(mean_imp)), mean_imp[sorted_indices], width=1.0)
    ax4.set_xlabel("Feature rank")
    ax4.set_ylabel("Importance")
    ax4.set_title("All Features Ranked by Importance")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\nPlot saved to: {output_path}")


def generate_report(
    importance_results: dict,
    group_results: dict,
    ablation_results: dict,
    redundant_pairs: list,
    output_path: Path
):
    """Generate a text report of the analysis."""
    mean_imp = importance_results["mean_importance"]
    std_imp = importance_results["std_importance"]
    sorted_indices = np.argsort(mean_imp)[::-1]

    lines = [
        "=" * 60,
        "FEATURE IMPORTANCE ANALYSIS REPORT",
        "=" * 60,
        "",
        f"Baseline model accuracy: {importance_results['baseline_accuracy']:.4f}",
        "",
        "-" * 60,
        "TOP 10 MOST IMPORTANT FEATURES",
        "-" * 60,
    ]

    for i, idx in enumerate(sorted_indices[:10]):
        lines.append(f"  {i+1:2d}. {FEATURE_NAMES[idx]:25s} {mean_imp[idx]:+.4f} ± {std_imp[idx]:.4f}")

    lines.extend([
        "",
        "-" * 60,
        "TOP 10 LEAST IMPORTANT FEATURES (candidates for removal)",
        "-" * 60,
    ])

    for i, idx in enumerate(sorted_indices[-10:][::-1]):
        lines.append(f"  {i+1:2d}. {FEATURE_NAMES[idx]:25s} {mean_imp[idx]:+.4f} ± {std_imp[idx]:.4f}")

    lines.extend([
        "",
        "-" * 60,
        "FEATURE GROUP ANALYSIS",
        "-" * 60,
    ])

    for group_name, results in sorted(group_results.items(), key=lambda x: -x[1]["mean"]):
        lines.append(
            f"  {group_name:20s} ({results['n_features']:2d} features): "
            f"{results['mean']:.4f} ± {results['std']:.4f}"
        )

    lines.extend([
        "",
        "-" * 60,
        "ABLATION STUDY (accuracy when feature group is zeroed)",
        "-" * 60,
    ])

    for group_name, results in sorted(ablation_results.items(), key=lambda x: -x[1]["accuracy_drop"]):
        lines.append(
            f"  Without {group_name:20s}: {results['accuracy_with_ablation']:.4f} "
            f"(drop: {results['accuracy_drop']:+.4f}, {results['relative_drop']*100:.1f}%)"
        )

    if redundant_pairs:
        lines.extend([
            "",
            "-" * 60,
            f"HIGHLY CORRELATED FEATURE PAIRS (|r| >= 0.95)",
            "-" * 60,
        ])
        for pair in redundant_pairs:
            lines.append(
                f"  {pair['feature_1']:25s} <-> {pair['feature_2']:25s} "
                f"(r = {pair['correlation']:.3f})"
            )
    else:
        lines.extend([
            "",
            "No highly correlated feature pairs found (threshold: |r| >= 0.95)",
        ])

    # Recommendations
    lines.extend([
        "",
        "=" * 60,
        "RECOMMENDATIONS",
        "=" * 60,
        "",
    ])

    # Find features with near-zero or negative importance
    low_importance_threshold = 0.001
    low_importance_features = [
        FEATURE_NAMES[idx] for idx in sorted_indices
        if mean_imp[idx] < low_importance_threshold
    ]

    if low_importance_features:
        lines.append(f"Features with negligible importance (<{low_importance_threshold}):")
        for feat in low_importance_features:
            lines.append(f"  - {feat}")
        lines.append("")
        lines.append(f"Consider removing these {len(low_importance_features)} features to simplify the model.")
    else:
        lines.append("All features show meaningful importance. No clear candidates for removal.")

    lines.append("")

    report_text = "\n".join(lines)

    with open(output_path, "w") as f:
        f.write(report_text)

    print(report_text)
    print(f"\nReport saved to: {output_path}")


def main():
    script_dir = Path(__file__).parent
    features_dir = script_dir / "data" / "features"
    models_dir = script_dir / "data" / "models"
    output_dir = script_dir / "data" / "analysis"
    output_dir.mkdir(parents=True, exist_ok=True)

    print_feature_summary()
    print("\nLoading model and data...")
    model, scaler, X_val, y_val = load_model_and_data(models_dir, features_dir)
    print(f"Validation set: {X_val.shape[0]} samples, {X_val.shape[1]} features")

    random_state = int(time.time())

    # Run permutation importance
    importance_results = permutation_importance(model, X_val, y_val, n_repeats=50, random_state=random_state)

    # Run feature group analysis
    group_results = group_importance(model, X_val, y_val, n_repeats=50, random_state=random_state)

    # Run ablation study
    ablation_results = ablation_study(model, X_val, y_val, scaler)

    # Correlation analysis
    print("\nAnalyzing feature correlations...")
    corr_matrix = feature_correlation_analysis(X_val)
    redundant_pairs = find_redundant_features(corr_matrix, threshold=0.95)

    # Generate outputs
    plot_importance(importance_results, output_dir / "feature_importance.png")
    generate_report(
        importance_results,
        group_results,
        ablation_results,
        redundant_pairs,
        output_dir / "feature_importance_report.txt"
    )

    # Save raw results
    results_path = output_dir / "importance_data.json"
    with open(results_path, "w") as f:
        json.dump({
            "feature_names": list(FEATURE_NAMES),
            "baseline_accuracy": importance_results["baseline_accuracy"],
            "mean_importance": importance_results["mean_importance"].tolist(),
            "std_importance": importance_results["std_importance"].tolist(),
            "group_results": group_results,
            "ablation_results": ablation_results,
            "redundant_pairs": redundant_pairs,
        }, f, indent=2)
    print(f"Raw data saved to: {results_path}")


if __name__ == "__main__":
    main()
