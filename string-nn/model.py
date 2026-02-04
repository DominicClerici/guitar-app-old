import torch
import torch.nn as nn

MODEL_SIZE_BASE = 64
ADAPTER_SIZE = MODEL_SIZE_BASE // 2  # Same as backbone output size


class StringClassifier(nn.Module):
    """
    MLP for guitar string classification.
    Designed to be lightweight for real-time browser inference via ONNX.

    Architecture uses 'network' as the main Sequential to maintain backward compatibility
    with existing checkpoints. Layers 0-7 are the backbone (feature extraction),
    layer 8 is the head (classification).

    For fine-tuning, an adapter layer can be inserted between backbone and head.
    """

    def __init__(self, input_size: int = 33, num_classes: int = 6, dropout: float = 0.3):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(input_size, MODEL_SIZE_BASE),
            nn.BatchNorm1d(MODEL_SIZE_BASE),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(MODEL_SIZE_BASE, MODEL_SIZE_BASE // 2),
            nn.BatchNorm1d(MODEL_SIZE_BASE // 2),
            nn.ReLU(),
            nn.Dropout(dropout * 0.67),
            nn.Linear(MODEL_SIZE_BASE // 2, num_classes),
        )

        self.adapter = None
        self.has_adapter = False

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if self.has_adapter and self.adapter is not None:
            # Run backbone (layers 0-7)
            for i in range(8):
                x = self.network[i](x)
            # Run adapter
            x = self.adapter(x)
            # Run head (layer 8)
            x = self.network[8](x)
            return x
        return self.network(x)

    def add_adapter(self, dropout: float = 0.3):
        """
        Add an adapter layer between backbone and head for fine-tuning.

        The adapter provides dedicated capacity for user-specific adaptation
        without modifying the pre-trained backbone features.

        Architecture: Linear(32→32) + BatchNorm + ReLU + Dropout
        This adds ~1,100 trainable parameters.
        """
        self.adapter = nn.Sequential(
            nn.Linear(ADAPTER_SIZE, ADAPTER_SIZE),
            nn.BatchNorm1d(ADAPTER_SIZE),
            nn.ReLU(),
            nn.Dropout(dropout),
        )
        self.has_adapter = True

    def freeze_backbone(self):
        """Freeze all backbone parameters for fine-tuning (layers 0-7)."""
        for i, layer in enumerate(self.network):
            if i < 8:
                for param in layer.parameters():
                    param.requires_grad = False
                if isinstance(layer, nn.BatchNorm1d):
                    layer.eval()

    def unfreeze_backbone(self):
        """Unfreeze backbone parameters (layers 0-7)."""
        for i, layer in enumerate(self.network):
            if i < 8:
                for param in layer.parameters():
                    param.requires_grad = True

    def freeze_for_finetuning(self):
        """
        Prepare model for fine-tuning: freeze backbone, keep adapter + head trainable.
        Call add_adapter() first if you want adapter-based fine-tuning.
        """
        self.freeze_backbone()
        # Head (layer 8) stays trainable by default
        # Adapter (if present) stays trainable by default

    def get_trainable_params(self):
        """Return only parameters that require gradients."""
        return [p for p in self.parameters() if p.requires_grad]

    def get_head(self) -> nn.Linear:
        """Return the classification head (layer 8)."""
        return self.network[8]

    def get_adapter(self) -> nn.Sequential | None:
        """Return the adapter layer if present."""
        return self.adapter


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = StringClassifier()
    print(f"Model architecture:\n{model}")
    print(f"\nTotal trainable parameters: {count_parameters(model):,}")

    # Test with adapter
    print("\n--- With Adapter (for fine-tuning) ---")
    model.add_adapter()
    model.freeze_backbone()
    print(f"Adapter: {model.adapter}")
    print(f"Trainable parameters after freezing: {count_parameters(model):,}")

    model.eval()
    dummy_input = torch.randn(1, 33)
    output = model(dummy_input)
    print(f"\nInput shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
