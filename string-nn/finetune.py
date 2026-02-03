"""
Few-shot fine-tuning for guitar string classifier.

This script fine-tunes a pre-trained model on a small number of user samples
to adapt to their specific guitar/amp setup.

Strategy:
- Freeze backbone (early layers that extract general audio features)
- Fine-tune only the classification head
- Use aggressive regularization to prevent overfitting on few samples
"""

import argparse
import json
import pickle
import uuid
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset

from model import StringClassifier, count_parameters
from train import GuitarStringDataset, sample_to_feature_vector, compute_class_weights
from features_config import get_enabled_feature_names


ADD_NOISE = False
NUM_AUGMENTATIONS = 2

FINETUNE_EPOCHS = 200
FINETUNE_LR = 0.0005  # Lower LR for fine-tuning stability
FINETUNE_BATCH_SIZE = 8
FINETUNE_DROPOUT = 0.4
ADAPTER_DROPOUT = 0.3
WEIGHT_DECAY = 0.03
USE_ADAPTER = True
FINETUNE_PATIENCE = 30
VAL_SPLIT = 0.2  # Hold out 20% for validation


def load_pretrained_model(
    model_path: Path, device: str = "cpu", load_adapter: bool = False
) -> tuple[StringClassifier, dict]:
    """
    Load pre-trained model and return it with checkpoint info.

    Args:
        model_path: Path to the model checkpoint
        device: Device to load model on
        load_adapter: If True and checkpoint has adapter, load it too
    """
    checkpoint = torch.load(model_path, map_location=device, weights_only=True)

    model = StringClassifier(
        input_size=checkpoint["input_size"],
        num_classes=checkpoint["num_classes"],
        dropout=FINETUNE_DROPOUT,
    )

    # Add adapter BEFORE loading state_dict if checkpoint has one and we want to load it
    has_adapter = checkpoint.get("has_adapter", False)
    if load_adapter and has_adapter:
        model.add_adapter(dropout=ADAPTER_DROPOUT)
        print("Loading model with adapter layer")

    # Now load the state_dict (includes adapter weights if adapter was added)
    model.load_state_dict(checkpoint["model_state_dict"])

    model.to(device)

    return model, checkpoint


def load_scaler(scaler_path: Path) -> StandardScaler:
    """Load the pre-trained scaler."""
    with open(scaler_path, "rb") as f:
        return pickle.load(f)


def prepare_finetune_data(
    samples: list[dict],
    scaler: StandardScaler,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert user samples to feature vectors and scale them.

    Args:
        samples: List of sample dicts with features
        scaler: Pre-trained StandardScaler

    Returns:
        Tuple of (features, labels) arrays
    """
    features = []
    labels = []

    for sample in samples:
        feature_vec = sample_to_feature_vector(sample)
        features.append(feature_vec)
        labels.append(sample["string"])

    features = np.array(features)
    labels = np.array(labels)

    features_scaled = scaler.transform(features)

    return features_scaled, labels


def augment_features(
    features: np.ndarray,
    labels: np.ndarray,
    num_augmentations: int = NUM_AUGMENTATIONS,
    noise_std: float = 0.1,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Augment feature vectors with small perturbations.

    This helps prevent overfitting when we have very few samples.
    """
    augmented_features = [features]
    augmented_labels = [labels]

    for _ in range(num_augmentations):
        noise = np.random.randn(*features.shape) * noise_std
        augmented_features.append(features + noise)
        augmented_labels.append(labels)

    return np.vstack(augmented_features), np.hstack(augmented_labels)


def evaluate(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: str,
) -> tuple[float, float]:
    """Evaluate model on a dataset, returning loss and accuracy."""
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


def finetune(
    model: StringClassifier,
    train_features: np.ndarray,
    train_labels: np.ndarray,
    val_features: np.ndarray,
    val_labels: np.ndarray,
    device: str = "cpu",
    epochs: int = FINETUNE_EPOCHS,
    lr: float = FINETUNE_LR,
    batch_size: int = FINETUNE_BATCH_SIZE,
    use_adapter: bool = USE_ADAPTER,
    patience: int = FINETUNE_PATIENCE,
) -> dict:
    """
    Fine-tune the model on user samples using adapter layer approach.

    When use_adapter=True (default):
    - Adds an adapter layer between backbone and head
    - Freezes backbone, trains adapter + head
    - Provides ~1,300 trainable parameters for better adaptation

    Returns:
        Training stats dict with validation metrics
    """
    if use_adapter:
        model.add_adapter(dropout=ADAPTER_DROPOUT)
        model.to(device)
        print("Added adapter layer for fine-tuning")

    model.freeze_backbone()

    trainable_params = count_parameters(model)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Fine-tuning {trainable_params:,} / {total_params:,} parameters")

    train_dataset = GuitarStringDataset(train_features, train_labels)
    val_dataset = GuitarStringDataset(val_features, val_labels)

    actual_batch_size = min(batch_size, len(train_dataset))
    train_loader = DataLoader(train_dataset, batch_size=actual_batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=actual_batch_size)

    # Use class weights like base training
    class_weights = compute_class_weights(train_labels).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    optimizer = torch.optim.AdamW(
        model.get_trainable_params(),
        lr=lr,
        weight_decay=WEIGHT_DECAY,
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=10
    )

    # Keep BatchNorm in eval mode for frozen layers
    for i, layer in enumerate(model.network):
        if i < 8 and isinstance(layer, nn.BatchNorm1d):
            layer.eval()

    stats = {
        "epochs": [],
        "train_losses": [],
        "train_accuracies": [],
        "val_losses": [],
        "val_accuracies": [],
    }

    best_val_loss = float("inf")
    best_val_acc = 0.0
    epochs_without_improvement = 0
    best_model_state = None

    for epoch in range(epochs):
        # Training
        model.train()
        for i, layer in enumerate(model.network):
            if i < 8 and isinstance(layer, nn.BatchNorm1d):
                layer.eval()

        total_loss = 0.0
        correct = 0
        total = 0

        for features, labels in train_loader:
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

        train_loss = total_loss / total
        train_acc = correct / total

        # Validation
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)

        scheduler.step(val_loss)

        stats["epochs"].append(epoch + 1)
        stats["train_losses"].append(train_loss)
        stats["train_accuracies"].append(train_acc)
        stats["val_losses"].append(val_loss)
        stats["val_accuracies"].append(val_acc)

        # Track best based on validation loss
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_val_acc = val_acc
            best_model_state = model.state_dict().copy()
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(
                f"Epoch {epoch+1:3d}/{epochs} | "
                f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.4f} | "
                f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}"
            )

        if epochs_without_improvement >= patience:
            print(f"\nEarly stopping at epoch {epoch+1}")
            break

    if best_model_state:
        model.load_state_dict(best_model_state)
        print(f"Restored best model (val_loss: {best_val_loss:.4f}, val_acc: {best_val_acc:.4f})")

    return stats


def save_finetuned_model(
    model: StringClassifier,
    output_path: Path,
    checkpoint: dict,
):
    """Save the fine-tuned model including adapter if present."""
    # Note: model.state_dict() automatically includes adapter weights when has_adapter=True
    save_dict = {
        "model_state_dict": model.state_dict(),
        "input_size": checkpoint["input_size"],
        "num_classes": checkpoint["num_classes"],
        "enabled_features": checkpoint.get("enabled_features", get_enabled_feature_names()),
        "is_finetuned": True,
        "has_adapter": model.has_adapter,
    }

    torch.save(save_dict, output_path)
    print(f"Fine-tuned model saved to: {output_path}")
    if model.has_adapter:
        print(f"  (includes adapter layer)")


def finetune_from_samples(
    samples: list[dict],
    user_id: str | None = None,
    base_model_path: Path | None = None,
    scaler_path: Path | None = None,
    output_dir: Path | None = None,
) -> dict:
    """
    Main entry point for fine-tuning from a list of sample dicts.

    Args:
        samples: List of feature dicts (from feature extraction)
        user_id: Optional user identifier (generates UUID if not provided)
        base_model_path: Path to pre-trained model (uses default if not provided)
        scaler_path: Path to scaler (uses default if not provided)
        output_dir: Output directory for fine-tuned model

    Returns:
        Dict with user_id, model_path, and training stats
    """
    script_dir = Path(__file__).parent
    models_dir = script_dir / "data" / "models"

    if base_model_path is None:
        base_model_path = models_dir / "string_classifier.pt"
    if scaler_path is None:
        scaler_path = models_dir / "scaler.pkl"
    if output_dir is None:
        output_dir = models_dir / "finetuned"
    if user_id is None:
        user_id = str(uuid.uuid4())[:8]

    output_dir.mkdir(parents=True, exist_ok=True)

    device = "cpu"

    print(f"\n--- Fine-tuning for user: {user_id} ---")
    print(f"Base model: {base_model_path}")
    print(f"Number of samples: {len(samples)}")

    model, checkpoint = load_pretrained_model(base_model_path, device)
    scaler = load_scaler(scaler_path)

    features, labels = prepare_finetune_data(samples, scaler)
    print(f"Feature shape: {features.shape}")
    print(f"Label distribution: {np.bincount(labels, minlength=6)}")

    # Split into train/val BEFORE augmentation to prevent data leakage
    if len(features) >= 10:
        train_features, val_features, train_labels, val_labels = train_test_split(
            features, labels, test_size=VAL_SPLIT, stratify=labels, random_state=42
        )
    else:
        # Too few samples for stratified split, use simple split
        train_features, val_features, train_labels, val_labels = train_test_split(
            features, labels, test_size=VAL_SPLIT, random_state=42
        )

    print(f"Train/Val split: {len(train_labels)} / {len(val_labels)}")

    # Only augment training data (not validation)
    if ADD_NOISE:
        train_features_aug, train_labels_aug = augment_features(
            train_features, train_labels, num_augmentations=NUM_AUGMENTATIONS
        )
        print(f"Augmented training to {len(train_labels_aug)} samples")
    else:
        train_features_aug = train_features
        train_labels_aug = train_labels

    stats = finetune(
        model, train_features_aug, train_labels_aug, val_features, val_labels, device
    )

    output_path = output_dir / f"string_classifier_{user_id}.pt"
    save_finetuned_model(model, output_path, checkpoint)

    return {
        "user_id": user_id,
        "model_path": str(output_path),
        "stats": stats,
        "final_val_accuracy": stats["val_accuracies"][-1],
        "final_val_loss": stats["val_losses"][-1],
        "best_val_accuracy": max(stats["val_accuracies"]),
    }


def finetune_from_json(
    features_json_path: Path,
    user_id: str | None = None,
) -> dict:
    """
    Fine-tune from a JSON file containing extracted features.

    The JSON should have the same structure as main.py output.
    """
    with open(features_json_path) as f:
        data = json.load(f)

    return finetune_from_samples(data["samples"], user_id)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fine-tune string classifier on user samples"
    )
    parser.add_argument(
        "features_json",
        type=Path,
        help="Path to JSON file with extracted features",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="User identifier (generates UUID if not provided)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if not args.features_json.exists():
        print(f"Features file not found: {args.features_json}")
        exit(1)

    result = finetune_from_json(args.features_json, args.user_id)

    print(f"\n--- Fine-tuning complete ---")
    print(f"User ID: {result['user_id']}")
    print(f"Model saved to: {result['model_path']}")
    print(f"Best validation accuracy: {result['best_val_accuracy']:.4f}")
