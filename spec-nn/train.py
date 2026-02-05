"""
Training script for spectrogram-based guitar string classifier.

Loads pre-extracted spectrograms from main.py and trains a CNN model.
Uses file-level train/val split to prevent data leakage (all windows from
the same audio file stay together).
"""

import argparse
import json
import pickle
import random
import re
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Dataset
import time

from model import SpectrogramClassifier, SpectrogramClassifierLarge, count_parameters


class SpectrogramDataset(Dataset):
    """PyTorch dataset for spectrogram samples."""

    def __init__(self, spectrograms: np.ndarray, labels: np.ndarray, normalize_mean: float, normalize_std: float):
        # Normalize spectrograms
        spectrograms = (spectrograms - normalize_mean) / (normalize_std + 1e-8)

        # Add channel dimension: (N, H, W) -> (N, 1, H, W)
        self.spectrograms = torch.FloatTensor(spectrograms).unsqueeze(1)
        self.labels = torch.LongTensor(labels)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.spectrograms[idx], self.labels[idx]


def get_base_sample_id(sample_id: str) -> str:
    """Extract base sample ID by removing _augN suffix."""
    return re.sub(r"_aug\d+$", "", sample_id)


def load_spectrograms_with_split(
    data_dir: Path,
    test_size: float = 0.2,
    random_state: int = 42,
    use_npz: bool = True,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, dict, dict]:
    """
    Load spectrograms and split by audio file to prevent data leakage.

    Returns:
        X_train, X_val, y_train, y_val, config, stats
    """
    # Try to load from npz (faster) or json
    if use_npz:
        npz_files = sorted(data_dir.glob("*_spectrograms.npz"))
        if npz_files:
            latest_file = npz_files[-1]
            print(f"Loading from: {latest_file}")

            data = np.load(latest_file, allow_pickle=True)
            spectrograms = data["spectrograms"]
            strings = data["strings"]
            config = data["config"].item()
            stats = data["stats"].item()

            # For npz format, we need to load json for sample metadata
            json_file = latest_file.with_suffix(".json")
            if json_file.exists():
                with open(json_file) as f:
                    json_data = json.load(f)
                samples_meta = json_data["samples"]
            else:
                # Create dummy metadata (all unique IDs)
                frets = data["frets"] if "frets" in data else np.zeros(len(strings), dtype=int)
                samples_meta = [{"sample_id": f"sample_{i}", "string": int(strings[i]), "fret": int(frets[i])}
                               for i in range(len(strings))]

            # Group by base sample ID for proper splitting
            file_to_indices: dict[str, list[int]] = {}
            for i, meta in enumerate(samples_meta):
                base_id = get_base_sample_id(meta["sample_id"])
                file_key = f"{meta['string']}_{meta['fret']}_{base_id}"
                if file_key not in file_to_indices:
                    file_to_indices[file_key] = []
                file_to_indices[file_key].append(i)

            # Split at file level
            file_keys = list(file_to_indices.keys())
            file_labels = [samples_meta[file_to_indices[k][0]]["string"] for k in file_keys]

            train_keys, val_keys = train_test_split(
                file_keys,
                test_size=test_size,
                stratify=file_labels,
                random_state=random_state,
            )

            # Gather indices
            train_indices = [i for k in train_keys for i in file_to_indices[k]]
            val_indices = [i for k in val_keys for i in file_to_indices[k]]

            X_train = spectrograms[train_indices]
            X_val = spectrograms[val_indices]
            y_train = strings[train_indices]
            y_val = strings[val_indices]

            print(f"Loaded: {len(train_indices)} train, {len(val_indices)} val samples")
            return X_train, X_val, y_train, y_val, config, stats

    # Fall back to json
    json_files = sorted(data_dir.glob("*_spectrograms.json"))
    if not json_files:
        raise FileNotFoundError(f"No spectrogram files found in {data_dir}")

    latest_file = json_files[-1]
    print(f"Loading from: {latest_file}")

    with open(latest_file) as f:
        data = json.load(f)

    config = data["config"]
    stats = data["stats"]
    samples = data["samples"]

    # Group by base sample ID
    file_to_samples: dict[str, list[dict]] = {}
    for sample in samples:
        base_id = get_base_sample_id(sample["sample_id"])
        file_key = f"{sample['string']}_{sample['fret']}_{base_id}"
        if file_key not in file_to_samples:
            file_to_samples[file_key] = []
        file_to_samples[file_key].append(sample)

    # Split at file level
    file_keys = list(file_to_samples.keys())
    file_labels = [file_to_samples[k][0]["string"] for k in file_keys]

    train_keys, val_keys = train_test_split(
        file_keys,
        test_size=test_size,
        stratify=file_labels,
        random_state=random_state,
    )

    # Collect samples
    train_specs, train_labels = [], []
    val_specs, val_labels = [], []

    for key in train_keys:
        for sample in file_to_samples[key]:
            train_specs.append(sample["spectrogram"])
            train_labels.append(sample["string"])

    for key in val_keys:
        for sample in file_to_samples[key]:
            val_specs.append(sample["spectrogram"])
            val_labels.append(sample["string"])

    print(f"Loaded: {len(train_specs)} train, {len(val_specs)} val samples")

    return (
        np.array(train_specs),
        np.array(val_specs),
        np.array(train_labels),
        np.array(val_labels),
        config,
        stats,
    )


def compute_class_weights(labels: np.ndarray, num_classes: int = 6) -> torch.Tensor:
    """Compute class weights for imbalanced data."""
    class_counts = np.bincount(labels, minlength=num_classes)
    class_counts = np.maximum(class_counts, 1)
    weights = 1.0 / class_counts
    weights = weights / weights.sum() * num_classes
    return torch.FloatTensor(weights)


def train_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> tuple[float, float]:
    """Train for one epoch."""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for specs, labels in dataloader:
        specs, labels = specs.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(specs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * specs.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float, np.ndarray, np.ndarray]:
    """Evaluate the model. Returns (loss, accuracy, all_predictions, all_labels)."""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for specs, labels in dataloader:
            specs, labels = specs.to(device), labels.to(device)
            outputs = model(specs)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * specs.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    return total_loss / total, correct / total, np.array(all_preds), np.array(all_labels)


STRING_NAMES = ["E2(6)", "A2(5)", "D3(4)", "G3(3)", "B3(2)", "E4(1)"]


def print_classification_report(
    labels: np.ndarray,
    predictions: np.ndarray,
    title: str = "Classification Report",
    num_classes: int = 6,
):
    """Print confusion matrix and per-class precision/recall/F1."""
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for true, pred in zip(labels, predictions):
        cm[true][pred] += 1

    print(f"\n--- {title} ---")

    # Confusion matrix
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

    for i, name in enumerate(STRING_NAMES):
        tp = cm[i][i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        support = cm[i, :].sum()

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        print(f"{name:>7} {precision:>7.4f} {recall:>7.4f} {f1:>7.4f} {support:>7}")
        macro_p += precision
        macro_r += recall
        macro_f1 += f1
        total_support += support

    print("-" * 39)
    print(f"{'Macro':>7} {macro_p/num_classes:>7.4f} {macro_r/num_classes:>7.4f} {macro_f1/num_classes:>7.4f} {total_support:>7}")

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


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train spectrogram-based guitar string classifier."
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=200,
        help="Number of training epochs (default: 200)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size (default: 32)"
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=0.001,
        help="Learning rate (default: 0.001)"
    )
    parser.add_argument(
        "--patience",
        type=int,
        default=30,
        help="Early stopping patience (default: 30)"
    )
    parser.add_argument(
        "--large-model",
        action="store_true",
        help="Use larger model variant"
    )
    parser.add_argument(
        "--dropout",
        type=float,
        default=0.3,
        help="Dropout rate (default: 0.3)"
    )
    parser.add_argument(
        "--seed",
        type=str,
        default="42",
        help="Random seed for train/val split (integer or 'random')"
    )

    return parser.parse_args()


def resolve_seed(seed: str) -> int:
    if seed == "random":
        return random.randint(0, 2**31 - 1)
    return int(seed)


def train(
    epochs: int = 200,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    patience: int = 30,
    use_large_model: bool = False,
    dropout: float = 0.3,
    seed: str = "42",
):
    print("\n====== Spectrogram CNN Training ======")

    script_dir = Path(__file__).parent
    data_dir = script_dir / "data" / "spectrograms"
    output_dir = script_dir / "data" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    resolved_seed = resolve_seed(seed)
    if seed == "random":
        print("Using a random seed: ", resolved_seed)
    else:
        print("Using seed: ", resolved_seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Load data
    X_train, X_val, y_train, y_val, config, stats = load_spectrograms_with_split(data_dir, random_state=resolved_seed)

    print(f"\nTrain shape: {X_train.shape} / Val shape: {X_val.shape}")
    print(f"Train dist: {np.bincount(y_train, minlength=6)} / Val dist: {np.bincount(y_val, minlength=6)}")
    print(f"Spectrogram config: {config}")

    # Create datasets with normalization
    train_dataset = SpectrogramDataset(X_train, y_train, stats["mean"], stats["std"])
    val_dataset = SpectrogramDataset(X_val, y_val, stats["mean"], stats["std"])

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # Get dimensions from config
    n_mels = config["n_mels"]
    # Calculate time frames from window size and hop length
    time_frames = (config["window_size"] // config["hop_length"]) + 1

    print(f"\nModel input: ({n_mels}, {time_frames})")

    # Create model
    if use_large_model:
        model = SpectrogramClassifierLarge(n_mels=n_mels, time_frames=time_frames, dropout=dropout)
        print("Using SpectrogramClassifierLarge")
    else:
        model = SpectrogramClassifier(n_mels=n_mels, time_frames=time_frames, dropout=dropout)
        print("Using SpectrogramClassifier")

    model = model.to(device)
    print(f"Model parameters: {count_parameters(model):,}")

    # Training setup
    class_weights = compute_class_weights(y_train).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=10
    )

    best_val_loss = float("inf")
    best_val_acc = 0.0
    epochs_without_improvement = 0
    best_model_state = None

    print("\n----- Starting training -----\n")

    epoch_times = []
    for epoch in range(epochs):
        epoch_start = time.time()
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc, _, _ = evaluate(model, val_loader, criterion, device)
        epoch_times.append(time.time() - epoch_start)

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if epoch % 10 == 0 or epoch == epochs - 1:
            avg_epoch_time = sum(epoch_times) / len(epoch_times)
            print(
                f"Epoch {epoch+1:3d}/{epochs} | "
                f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
                f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f} | "
                f"Avg Time/Epoch: {avg_epoch_time:.2f}s"
            )

        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    print("\n----- Training complete -----\n")
    print(f"Best validation loss: {best_val_loss:.4f} / accuracy: {best_val_acc:.4f}")

    if best_model_state:
        model.load_state_dict(best_model_state)

    # Per-class metrics on best model
    _, _, train_preds, train_labels = evaluate(model, train_loader, criterion, device)
    _, _, val_preds, val_labels = evaluate(model, val_loader, criterion, device)
    print_classification_report(train_labels, train_preds, title="Train Set")
    print_classification_report(val_labels, val_preds, title="Validation Set")

    # Save model
    model_path = output_dir / "spec_classifier.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "model_type": "large" if use_large_model else "small",
            "n_mels": n_mels,
            "time_frames": time_frames,
            "num_classes": 6,
            "dropout": dropout,
            "config": config,
            "stats": stats,
        },
        model_path,
    )
    print(f"\nModel saved to: {model_path}")

    # Save normalization stats separately for inference
    stats_path = output_dir / "spec_stats.pkl"
    with open(stats_path, "wb") as f:
        pickle.dump({"mean": stats["mean"], "std": stats["std"], "config": config}, f)
    print(f"Stats saved to: {stats_path}")

    elapsed = time.time() - start_time
    print(f"Training time: {elapsed:.2f} seconds")


if __name__ == "__main__":
    args = parse_args()
    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        patience=args.patience,
        use_large_model=args.large_model,
        dropout=args.dropout,
        seed=args.seed,
    )
