import json
import pickle
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset

from model import StringClassifier, count_parameters


class GuitarStringDataset(Dataset):
    def __init__(self, features: np.ndarray, labels: np.ndarray):
        self.features = torch.FloatTensor(features)
        self.labels = torch.LongTensor(labels)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return self.features[idx], self.labels[idx]


def load_features(features_dir: Path) -> tuple[np.ndarray, np.ndarray]:
    """Load features from the latest JSON file."""
    json_files = sorted(features_dir.glob("*.json"))
    if not json_files:
        raise FileNotFoundError(f"No feature files found in {features_dir}")

    latest_file = json_files[-1]
    print(f"Loading features from: {latest_file}")

    with open(latest_file) as f:
        data = json.load(f)

    samples = data["samples"]
    print(f"Loaded {len(samples)} samples")

    features_list = []
    labels_list = []

    for sample in samples:
        feature_vec = []
        # Harmonic features (12 values)
        feature_vec.extend(sample["harmonic_ratios"])
        # Spectral features (2 values)
        feature_vec.append(sample["spectral_centroid"])
        feature_vec.append(sample["spectral_rolloff"])
        # Timbral features (3 values)
        feature_vec.append(sample["inharmonicity"])
        feature_vec.append(sample["rms_energy"])
        feature_vec.append(sample["energy_slope"])
        # Frequency-relative features (3 values)
        feature_vec.append(sample["log_frequency"])
        feature_vec.append(sample["semitones_from_e2"])
        feature_vec.append(sample["octave_number"])
        # MFCCs (13 values)
        feature_vec.extend(sample["mfcc"])

        features_list.append(feature_vec)
        labels_list.append(sample["string"])

    return np.array(features_list), np.array(labels_list)


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


def train(
    epochs: int = 200,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    patience: int = 30,
):
    script_dir = Path(__file__).parent
    features_dir = script_dir / "data" / "features"
    output_dir = script_dir / "data" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    features, labels = load_features(features_dir)
    print(f"Feature shape: {features.shape}")
    print(f"Labels shape: {labels.shape}")
    print(f"Unique labels: {np.unique(labels)}")
    print(f"Label distribution: {np.bincount(labels, minlength=6)}")

    num_unique_labels = len(np.unique(labels))
    if num_unique_labels < 2:
        print(f"\nWarning: Only {num_unique_labels} class(es) found in data.")
        print("Need samples from at least 2 different strings to train a classifier.")
        print("Collect more samples and run feature extraction first.")
        return

    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    if len(features) < 10:
        print("\nWarning: Very few samples. Using all data for training (no validation).")
        X_train, y_train = features_scaled, labels
        X_val, y_val = features_scaled, labels
    else:
        X_train, X_val, y_train, y_val = train_test_split(
            features_scaled, labels, test_size=0.2, stratify=labels, random_state=42
        )

    print(f"\nTraining samples: {len(X_train)}")
    print(f"Validation samples: {len(X_val)}")

    train_dataset = GuitarStringDataset(X_train, y_train)
    val_dataset = GuitarStringDataset(X_val, y_val)

    actual_batch_size = min(batch_size, len(train_dataset))
    train_loader = DataLoader(train_dataset, batch_size=actual_batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=actual_batch_size)

    input_size = features.shape[1]
    model = StringClassifier(input_size=input_size, num_classes=6).to(device)
    print(f"\nModel parameters: {count_parameters(model):,}")

    class_weights = compute_class_weights(labels).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=10
    )

    best_val_loss = float("inf")
    best_val_acc = 0.0
    epochs_without_improvement = 0
    best_model_state = None

    print("\n" + "=" * 60)
    print("Starting training...")
    print("=" * 60)

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
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    print("\n" + "=" * 60)
    print("Training complete!")
    print(f"Best validation loss: {best_val_loss:.4f}")
    print(f"Best validation accuracy: {best_val_acc:.4f}")
    print("=" * 60)

    if best_model_state:
        model.load_state_dict(best_model_state)

    model_path = output_dir / "string_classifier.pt"
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_size": input_size,
            "num_classes": 6,
        },
        model_path,
    )
    print(f"\nModel saved to: {model_path}")

    scaler_path = output_dir / "scaler.pkl"
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    print(f"Scaler saved to: {scaler_path}")


if __name__ == "__main__":
    train()
