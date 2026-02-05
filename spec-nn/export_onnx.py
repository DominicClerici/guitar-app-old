"""
Export trained spectrogram classifier to ONNX format for browser inference.

The exported model takes a normalized mel-spectrogram as input and outputs
class logits for the 6 guitar strings.

For browser inference, the spectrogram should be computed using the same
parameters (n_fft, hop_length, n_mels, fmin, fmax) and normalized using
the exported mean/std values.
"""

import argparse
import json
import warnings
from pathlib import Path

import torch
import numpy as np

from model import SpectrogramClassifier, SpectrogramClassifierLarge


def export_to_onnx(
    model_path: Path,
    output_dir: Path,
    opset_version: int = 17,
):
    """Export trained model and normalization stats to ONNX format."""

    # Load checkpoint
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)

    model_type = checkpoint.get("model_type", "small")
    n_mels = checkpoint["n_mels"]
    time_frames = checkpoint["time_frames"]
    num_classes = checkpoint["num_classes"]
    dropout = checkpoint.get("dropout", 0.3)
    config = checkpoint["config"]
    stats = checkpoint["stats"]

    print(f"Model type: {model_type}")
    print(f"Input shape: (1, {n_mels}, {time_frames})")

    # Create model
    if model_type == "large":
        model = SpectrogramClassifierLarge(
            n_mels=n_mels,
            time_frames=time_frames,
            num_classes=num_classes,
            dropout=dropout,
        )
    else:
        model = SpectrogramClassifier(
            n_mels=n_mels,
            time_frames=time_frames,
            num_classes=num_classes,
            dropout=dropout,
        )

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    # Create dummy input with channel dimension
    dummy_input = torch.randn(1, 1, n_mels, time_frames)

    # Export to ONNX
    onnx_path = output_dir / "spec_classifier.onnx"

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*legacy TorchScript-based ONNX export.*")
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=opset_version,
            do_constant_folding=True,
            input_names=["spectrogram"],
            output_names=["logits"],
            dynamic_axes={
                "spectrogram": {0: "batch_size"},
                "logits": {0: "batch_size"},
            },
            dynamo=False,
        )

    # Report model size
    model_size_bytes = onnx_path.stat().st_size
    if model_size_bytes < 1024:
        size_str = f"{model_size_bytes} bytes"
    elif model_size_bytes < 1024 * 1024:
        size_str = f"{model_size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{model_size_bytes / (1024 * 1024):.2f} MB"

    print(f"ONNX model saved to: {onnx_path} ({size_str})")

    # Export config for browser inference
    inference_config = {
        "model_type": model_type,
        "input_shape": [1, n_mels, time_frames],
        "num_classes": num_classes,
        "string_labels": ["E2", "A2", "D3", "G3", "B3", "E4"],
        "normalization": {
            "mean": stats["mean"],
            "std": stats["std"],
        },
        "spectrogram_config": {
            "sample_rate": config["sample_rate"],
            "window_size": config["window_size"],
            "n_fft": config["n_fft"],
            "hop_length": config["hop_length"],
            "n_mels": config["n_mels"],
            "fmin": config["fmin"],
            "fmax": config["fmax"],
            "target_rms": config["target_rms"],
        },
    }

    config_path = output_dir / "spec_config.json"
    with open(config_path, "w") as f:
        json.dump(inference_config, f, indent=2)
    print(f"Config saved to: {config_path}")

    # Verify the export by running a test inference
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(onnx_path))
        test_input = np.random.randn(1, 1, n_mels, time_frames).astype(np.float32)
        outputs = session.run(None, {"spectrogram": test_input})
        print(f"ONNX verification: output shape {outputs[0].shape} ✓")
    except ImportError:
        print("Note: Install onnxruntime to verify export (pip install onnxruntime)")
    except Exception as e:
        print(f"Warning: ONNX verification failed: {e}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export trained spectrogram model to ONNX format."
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=None,
        help="Path to PyTorch model file (default: ./data/models/spec_classifier.pt)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Output directory for ONNX files (default: ./data/onnx)"
    )
    parser.add_argument(
        "--no-copy-to-frontend",
        action="store_true",
        help="Don't copy files to frontend public directory"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    script_dir = Path(__file__).parent
    models_dir = script_dir / "data" / "models"

    model_path = Path(args.model_path) if args.model_path else models_dir / "spec_classifier.pt"
    output_dir = Path(args.output_dir) if args.output_dir else script_dir / "data" / "onnx"

    output_dir.mkdir(parents=True, exist_ok=True)

    if not model_path.exists():
        print(f"Model not found: {model_path}")
        print("Train the model first with: python train.py")
        return

    export_to_onnx(model_path, output_dir)

    # Copy to frontend if requested
    if not args.no_copy_to_frontend and not args.output_dir:
        import shutil
        frontend_dir = script_dir.parent / "frontend" / "public" / "models"
        frontend_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy(output_dir / "spec_classifier.onnx", frontend_dir / "spec_classifier.onnx")
        shutil.copy(output_dir / "spec_config.json", frontend_dir / "spec_config.json")
        print(f"\nCopied to frontend: {frontend_dir}")

    print("\nExport complete!")


if __name__ == "__main__":
    main()
