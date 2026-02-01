import torch
import torch.nn as nn


class StringClassifier(nn.Module):
    """
    MLP for guitar string classification.
    Designed to be lightweight for real-time browser inference via ONNX.
    """

    def __init__(self, input_size: int = 17, num_classes: int = 6, dropout: float = 0.3):
        super().__init__()

        self.network = nn.Sequential(
            nn.Linear(input_size, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Dropout(dropout * 0.67),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


def count_parameters(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = StringClassifier()
    print(f"Model architecture:\n{model}")
    print(f"\nTotal trainable parameters: {count_parameters(model):,}")

    model.eval()
    dummy_input = torch.randn(1, 17)
    output = model(dummy_input)
    print(f"\nInput shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape}")
