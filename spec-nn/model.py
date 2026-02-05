"""
Spectrogram-based CNN model for guitar string classification.

Designed for real-time browser inference via ONNX:
- Small footprint (<100KB model)
- Simple architecture that exports cleanly to ONNX
- Input: mel-spectrogram (1, 64, 16) - (channels, n_mels, time_frames)
- Output: 6 class logits (one per string)

Architecture uses depthwise separable convolutions for efficiency,
followed by global average pooling to avoid FC layer explosion.
"""

import torch
import torch.nn as nn


class DepthwiseSeparableConv(nn.Module):
    """Depthwise separable convolution - more efficient than standard conv."""

    def __init__(self, in_channels: int, out_channels: int, kernel_size: int, padding: int = 0):
        super().__init__()
        self.depthwise = nn.Conv2d(
            in_channels, in_channels, kernel_size,
            padding=padding, groups=in_channels, bias=False
        )
        self.pointwise = nn.Conv2d(in_channels, out_channels, 1, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.depthwise(x)
        x = self.pointwise(x)
        return x


class SpectrogramClassifier(nn.Module):
    """
    Lightweight CNN for guitar string classification from mel-spectrograms.

    Input shape: (batch, 1, 64, 16) - single channel mel-spectrogram
    Output shape: (batch, 6) - logits for 6 strings

    Architecture:
    - 3 conv blocks with increasing channels (1 -> 16 -> 32 -> 64)
    - Each block: Conv -> BatchNorm -> ReLU -> MaxPool
    - Global Average Pooling
    - Small fully connected classifier

    Total params: ~15K (very lightweight for browser)
    """

    def __init__(self, n_mels: int = 64, time_frames: int = 16, num_classes: int = 6, dropout: float = 0.3):
        super().__init__()

        self.n_mels = n_mels
        self.time_frames = time_frames

        # Convolutional feature extractor
        self.features = nn.Sequential(
            # Block 1: 1 -> 16 channels
            nn.Conv2d(1, 16, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 64x16 -> 32x8

            # Block 2: 16 -> 32 channels
            nn.Conv2d(16, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 32x8 -> 16x4

            # Block 3: 32 -> 64 channels
            nn.Conv2d(32, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 16x4 -> 8x2
        )

        # Global average pooling - reduces to (batch, 64, 1, 1)
        self.global_pool = nn.AdaptiveAvgPool2d(1)

        # Classifier head
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout * 0.5),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch, 1, n_mels, time_frames) or (batch, n_mels, time_frames)

        # Add channel dimension if missing
        if x.dim() == 3:
            x = x.unsqueeze(1)

        # Feature extraction
        x = self.features(x)

        # Global pooling
        x = self.global_pool(x)
        x = x.view(x.size(0), -1)  # Flatten to (batch, 64)

        # Classification
        x = self.classifier(x)

        return x

    def get_feature_map_size(self) -> tuple[int, int, int]:
        """Calculate feature map size after conv layers (before global pool)."""
        with torch.no_grad():
            dummy = torch.zeros(1, 1, self.n_mels, self.time_frames)
            features = self.features(dummy)
            return features.shape[1:]  # (channels, height, width)


class SpectrogramClassifierLarge(nn.Module):
    """
    Larger CNN variant for better accuracy (if browser performance allows).

    Same interface as SpectrogramClassifier but with more capacity.
    Total params: ~50K
    """

    def __init__(self, n_mels: int = 64, time_frames: int = 16, num_classes: int = 6, dropout: float = 0.3):
        super().__init__()

        self.n_mels = n_mels
        self.time_frames = time_frames

        self.features = nn.Sequential(
            # Block 1: 1 -> 32 channels
            nn.Conv2d(1, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            # Block 2: 32 -> 64 channels
            nn.Conv2d(32, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),

            # Block 3: 64 -> 128 channels
            nn.Conv2d(64, 128, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),
        )

        self.global_pool = nn.AdaptiveAvgPool2d(1)

        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout * 0.5),
            nn.Linear(64, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() == 3:
            x = x.unsqueeze(1)

        x = self.features(x)
        x = self.global_pool(x)
        x = x.view(x.size(0), -1)
        x = self.classifier(x)

        return x


def count_parameters(model: nn.Module) -> int:
    """Count trainable parameters in a model."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    # Test both model variants
    print("SpectrogramClassifier (small):")
    model_small = SpectrogramClassifier()
    print(f"  Parameters: {count_parameters(model_small):,}")
    print(f"  Feature map size: {model_small.get_feature_map_size()}")

    dummy_input = torch.randn(1, 1, 64, 16)
    output = model_small(dummy_input)
    print(f"  Input shape: {dummy_input.shape}")
    print(f"  Output shape: {output.shape}")

    print("\nSpectrogramClassifierLarge:")
    model_large = SpectrogramClassifierLarge()
    print(f"  Parameters: {count_parameters(model_large):,}")

    output_large = model_large(dummy_input)
    print(f"  Output shape: {output_large.shape}")

    # Test without explicit channel dimension
    print("\nTest with 3D input (batch, n_mels, time):")
    dummy_3d = torch.randn(4, 64, 16)
    output_3d = model_small(dummy_3d)
    print(f"  Input shape: {dummy_3d.shape}")
    print(f"  Output shape: {output_3d.shape}")
