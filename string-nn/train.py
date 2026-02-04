import argparse
import json
import pickle
import re
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset
import time

from model import StringClassifier, count_parameters
from features_config import get_enabled_indices, get_enabled_feature_names, print_feature_summary


class GuitarStringDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.FloatTensor(features)
        self.labels = torch.LongTensor(labels)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


def get_base_sample_id(sample_id: str) -> str:
    """Extract base sample ID by removing _augN suffix."""
    return re.sub(r"_aug\d+$", "", sample_id)


def _sample_to_full_feature_vector(sample: dict) -> list:
    """Convert a sample dict to the full feature vector (all 36 features)."""
    feature_vec = []
    # Harmonic features (12 values)
    feature_vec.extend(sample["harmonic_ratios"])
    # Spectral features (2 values)
    feature_vec.append(sample["spectral_centroid"])
    feature_vec.append(sample["spectral_rolloff"])
    # Timbral features (5 values)
    feature_vec.append(sample["inharmonicity"])
    feature_vec.append(sample["rms_energy"])
    feature_vec.append(sample["energy_slope"])
    feature_vec.append(sample["zcr"])
    feature_vec.append(sample["odd_even_harmonic_ratio"])
    # Frequency-relative features (3 values)
    feature_vec.append(sample["log_frequency"])
    feature_vec.append(sample["semitones_from_e2"])
    feature_vec.append(sample["octave_number"])
    # MFCCs (13 values)
    feature_vec.extend(sample["mfcc"])
    # Transition detection (1 value) - defaults to 0.0 for backward compatibility
    feature_vec.append(sample.get("transition_likelihood", 0.0))
    return feature_vec


# Cache enabled indices for performance
_ENABLED_INDICES = None


def sample_to_feature_vector(sample: dict) -> list:
    """Convert a sample dict to a feature vector with only enabled features."""
    global _ENABLED_INDICES
    if _ENABLED_INDICES is None:
        _ENABLED_INDICES = get_enabled_indices()

    full_vector = _sample_to_full_feature_vector(sample)
    return [full_vector[i] for i in _ENABLED_INDICES]


def load_features_with_file_split(
    features_dir: Path, test_size: float = 0.2, random_state: int = 42
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Load features and split by audio file (not by window) to prevent data leakage.

    Windows from the same audio file (including augmented versions) are kept together
    in either train or validation set, never split across both.
    """
    json_files = sorted(features_dir.glob("*.json"))
    if not json_files:
        raise FileNotFoundError(f"No feature files found in {features_dir}")

    latest_file = json_files[-1]
    print(f"Loading features from: {latest_file}")

    with open(latest_file) as f:
        data = json.load(f)

    samples = data["samples"]

    # Group samples by base audio file (original recording, ignoring augmentations)
    file_to_samples: dict[str, list[dict]] = {}
    for sample in samples:
        base_id = get_base_sample_id(sample["sample_id"])
        # Create a unique key combining string, fret, and base sample ID
        file_key = f"{sample['string']}_{sample['fret']}_{base_id}"
        if file_key not in file_to_samples:
            file_to_samples[file_key] = []
        file_to_samples[file_key].append(sample)

    # Get unique file keys and their string labels for stratification
    file_keys = list(file_to_samples.keys())
    file_labels = [file_to_samples[k][0]["string"] for k in file_keys]

    # Split at the file level
    unique_labels = set(file_labels)
    if len(unique_labels) < 2:
        print(f"\nWarning: Only {len(unique_labels)} class(es) found.")
        print("Using all data for both train and validation.")
        train_keys = file_keys
        val_keys = file_keys
    elif len(file_keys) < 10:
        print("\nWarning: Very few audio files. Using all data for both train and validation.")
        train_keys = file_keys
        val_keys = file_keys
    else:
        train_keys, val_keys = train_test_split(
            file_keys,
            test_size=test_size,
            stratify=file_labels,
            random_state=random_state,
        )


    # Collect windows for train and validation sets
    train_features, train_labels = [], []
    val_features, val_labels = [], []

    for file_key in train_keys:
        for sample in file_to_samples[file_key]:
            train_features.append(sample_to_feature_vector(sample))
            train_labels.append(sample["string"])

    for file_key in val_keys:
        for sample in file_to_samples[file_key]:
            val_features.append(sample_to_feature_vector(sample))
            val_labels.append(sample["string"])
    print(f"\nLoaded (files, windows): ({len(train_keys)}, {len(train_features)}) Train / ({len(val_keys)}, {len(val_features)}) Validation")

    return (
        np.array(train_features),
        np.array(val_features),
        np.array(train_labels),
        np.array(val_labels),
    )


def load_sliding_window_features(
    features_dir: Path,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray] | None:
    """
    Load sliding window features from pre-split train/val files.

    These files are generated by main.py with --sliding-window-only or when
    sliding window generation is enabled. They contain features extracted from
    sequences with a 512-sample hop size to match production inference.

    Returns:
        Tuple of (X_train, X_val, y_train, y_val) or None if no sliding window files found
    """
    # Find the most recent sliding window files
    train_files = sorted(features_dir.glob("*_sliding_train.json"))
    val_files = sorted(features_dir.glob("*_sliding_val.json"))

    if not train_files or not val_files:
        return None

    # Use the most recent files
    train_file = train_files[-1]
    val_file = val_files[-1]

    # Check they have matching timestamps
    train_timestamp = train_file.stem.replace("_sliding_train", "")
    val_timestamp = val_file.stem.replace("_sliding_val", "")

    if train_timestamp != val_timestamp:
        print(f"Warning: Train and val files have different timestamps")
        print(f"  Train: {train_file.name}")
        print(f"  Val: {val_file.name}")

    print(f"Loading sliding window features:")
    print(f"  Train: {train_file.name}")
    print(f"  Val: {val_file.name}")

    with open(train_file) as f:
        train_data = json.load(f)

    with open(val_file) as f:
        val_data = json.load(f)

    train_samples = train_data["samples"]
    val_samples = val_data["samples"]

    train_features = [sample_to_feature_vector(s) for s in train_samples]
    train_labels = [s["string"] for s in train_samples]

    val_features = [sample_to_feature_vector(s) for s in val_samples]
    val_labels = [s["string"] for s in val_samples]

    print(f"Loaded sliding window features: {len(train_features)} train, {len(val_features)} val")

    # Print metadata
    if "sliding_window_hop_size" in train_data:
        print(f"  Hop size: {train_data['sliding_window_hop_size']}")
    if "sliding_window_notes_per_sequence" in train_data:
        print(f"  Notes per sequence: {train_data['sliding_window_notes_per_sequence']}")

    return (
        np.array(train_features),
        np.array(val_features),
        np.array(train_labels),
        np.array(val_labels),
    )


def compute_class_weights(labels: np.ndarray, num_classes: int = 6) -> torch.Tensor:
    """Compute class weights for imbalanced data."""
    class_counts = np.bincount(labels, minlength=num_classes)
    class_counts = np.maximum(class_counts, 1)  # Avoid division by zero
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
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for features, labels in dataloader:
        features, labels = features.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(features)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * features.size(0)
        _, predicted = outputs.max(1)
        correct += predicted.eq(labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float]:
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for features, labels in dataloader:
            features, labels = features.to(device), labels.to(device)
            outputs = model(features)
            loss = criterion(outputs, labels)

            total_loss += loss.item() * features.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

    return total_loss / total, correct / total


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train guitar string classifier with optional sliding window mode."
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=500,
        help="Number of training epochs (default: 500)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for training (default: 32)"
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
        default=100,
        help="Early stopping patience (default: 100)"
    )
    parser.add_argument(
        "--sliding-window-only",
        action="store_true",
        help="Train ONLY on sliding window sequences (ignores standard features)"
    )
    parser.add_argument(
        "--combine-sliding",
        action="store_true",
        help="Combine standard features with sliding window features for training"
    )

    return parser.parse_args()


def train(
    epochs: int = 500,
    batch_size: int = 64,
    learning_rate: float = 0.00175,
    patience: int = 25,
    sliding_window_only: bool = False,
    combine_sliding: bool = False,
):
    print("\n ------ Training ------")
    print_feature_summary()

    if sliding_window_only:
        print("\n*** SLIDING WINDOW ONLY MODE ***")
        print("Training exclusively on sliding window sequences to match production inference")

    script_dir = Path(__file__).parent
    features_dir = script_dir / "data" / "features"
    output_dir = script_dir / "data" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    start_time = time.time()

    # lol 9950x is faster than a 4060 for training
    # device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    device = 'cpu'
    print(f"Using device: {device}")

    # Load features based on mode
    if sliding_window_only:
        # Load only sliding window features
        sliding_data = load_sliding_window_features(features_dir)
        if sliding_data is None:
            print("\nError: No sliding window feature files found!")
            print("Run main.py with --sliding-window-only or enable sliding window generation first.")
            return
        X_train_raw, X_val_raw, y_train, y_val = sliding_data
    elif combine_sliding:
        # Load both standard and sliding window features, combine them
        X_train_raw, X_val_raw, y_train, y_val = load_features_with_file_split(features_dir)
        sliding_data = load_sliding_window_features(features_dir)
        if sliding_data is not None:
            sw_X_train, sw_X_val, sw_y_train, sw_y_val = sliding_data
            print(f"\nCombining standard features with sliding window features...")
            X_train_raw = np.vstack([X_train_raw, sw_X_train])
            X_val_raw = np.vstack([X_val_raw, sw_X_val])
            y_train = np.concatenate([y_train, sw_y_train])
            y_val = np.concatenate([y_val, sw_y_val])
            print(f"Combined: {len(y_train)} train, {len(y_val)} val samples")
        else:
            print("Note: No sliding window features found, using standard features only")
    else:
        # Standard mode - load regular features with file-level split
        X_train_raw, X_val_raw, y_train, y_val = load_features_with_file_split(features_dir)

    print(f"\nTrain shape: {X_train_raw.shape} / Val shape: {X_val_raw.shape}")
    print(f"Train dist: {np.bincount(y_train, minlength=6)} / Val dist: {np.bincount(y_val, minlength=6)}")

    all_labels = np.concatenate([y_train, y_val])
    num_unique_labels = len(np.unique(all_labels))
    if num_unique_labels < 2:
        print(f"\nWarning: Only {num_unique_labels} class(es) found in data.")
        print("Need samples from at least 2 different strings to train a classifier.")
        print("Collect more samples and run feature extraction first.")
        return

    # Fit scaler on training data only, then transform both sets
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train_raw)
    X_val = scaler.transform(X_val_raw)

    train_dataset = GuitarStringDataset(X_train, y_train)
    val_dataset = GuitarStringDataset(X_val, y_val)

    actual_batch_size = min(batch_size, len(train_dataset))
    train_loader = DataLoader(train_dataset, batch_size=actual_batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=actual_batch_size)

    input_size = X_train.shape[1]
    model = StringClassifier(input_size=input_size, num_classes=6).to(device)
    print(f"\nModel parameters: {count_parameters(model):,}")

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

    for epoch in range(epochs):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)

        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if epoch % 10 == 0 or epoch == epochs - 1:
            print(
                f"Epoch {epoch+1:3d}/{epochs} | "
                f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
                f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}"
            )

        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping at epoch {epoch+1} with patience {patience}")
            break


    print("\n----- Training complete -----\n")
    print(f"Best validation loss: {best_val_loss:.4f} / Best validation accuracy: {best_val_acc:.4f}")

    if best_model_state:
        model.load_state_dict(best_model_state)

    model_path = output_dir / "string_classifier.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_size": input_size,
            "num_classes": 6,
            "enabled_features": get_enabled_feature_names(),
        },
        model_path,
    )
    print(f"\nModel saved to: {model_path}")

    end_time = time.time()
    print(f"Training time: {end_time - start_time:.2f} seconds")

    scaler_path = output_dir / "scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"Scaler saved to: {scaler_path}")


if __name__ == "__main__":
    args = parse_args()
    train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        patience=args.patience,
        sliding_window_only=args.sliding_window_only,
        combine_sliding=args.combine_sliding,
    )
