import argparse
import json
import pickle
import warnings
from pathlib import Path

import torch

from model import StringClassifier
from features_config import get_enabled_feature_names


def export_to_onnx(
    model_path: Path,
    scaler_path: Path,
    output_dir: Path,
    opset_version: int = 17,
    copy_to_frontend: bool = True,
):
    """Export trained model and scaler to ONNX format for browser inference."""
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)

    model = StringClassifier(
        input_size=checkpoint["input_size"],
        num_classes=checkpoint["num_classes"],
    )

    # Add adapter BEFORE loading state_dict if the checkpoint has one
    has_adapter = checkpoint.get("has_adapter", False)
    if has_adapter:
        from finetune import ADAPTER_DROPOUT
        model.add_adapter(dropout=ADAPTER_DROPOUT)
        print("Fine-tuned model with adapter layer detected")

    # Now load the state_dict (includes adapter weights if present)
    model.load_state_dict(checkpoint["model_state_dict"])

    model.eval()

    dummy_input = torch.randn(1, checkpoint["input_size"])

    onnx_path = output_dir / "string_classifier.onnx"
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*legacy TorchScript-based ONNX export.*")
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            export_params=True,
            opset_version=opset_version,
            do_constant_folding=True,
            input_names=["features"],
            output_names=["logits"],
            dynamic_axes={
                "features": {0: "batch_size"},
                "logits": {0: "batch_size"},
            },
            dynamo=False,
        )
    model_size_bytes = onnx_path.stat().st_size
    if model_size_bytes < 1024:
        size_str = f"{model_size_bytes} bytes"
    elif model_size_bytes < 1024 * 1024:
        size_str = f"{model_size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{model_size_bytes / (1024 * 1024):.2f} MB"
    print(f"ONNX model saved to: {onnx_path} ({size_str})")

    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)

    scaler_config = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "feature_names": get_enabled_feature_names(),
        "string_labels": ["E2", "A2", "D3", "G3", "B3", "E4"],
    }

    scaler_json_path = output_dir / "scaler.json"
    with open(scaler_json_path, "w") as f:
        json.dump(scaler_config, f, indent=2)
    print(f"Scaler config saved to: {scaler_json_path}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Export trained model to ONNX format for browser inference."
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=None,
        help="Path to PyTorch model file (default: ./data/models/string_classifier.pt)"
    )
    parser.add_argument(
        "--scaler-path",
        type=str,
        default=None,
        help="Path to scaler pickle file (default: ./data/models/scaler.pkl)"
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

    model_path = Path(args.model_path) if args.model_path else models_dir / "string_classifier.pt"
    scaler_path = Path(args.scaler_path) if args.scaler_path else models_dir / "scaler.pkl"
    output_dir = Path(args.output_dir) if args.output_dir else script_dir / "data" / "onnx"

    output_dir.mkdir(parents=True, exist_ok=True)

    if not model_path.exists():
        print(f"Model not found: {model_path}")
        print("Train the model first with: python train.py")
        return

    if not scaler_path.exists():
        print(f"Scaler not found: {scaler_path}")
        print("Train the model first with: python train.py")
        return

    export_to_onnx(model_path, scaler_path, output_dir)

    if not args.no_copy_to_frontend and not args.output_dir:
        import shutil
        frontend_dir = script_dir.parent / "frontend" / "public" / "models"
        frontend_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy(output_dir / "string_classifier.onnx", frontend_dir / "string_classifier.onnx")
        shutil.copy(output_dir / "scaler.json", frontend_dir / "scaler.json")
        print(f"\nCopied to frontend: {frontend_dir}")

    print("\nExport complete! Files ready for browser deployment.")


if __name__ == "__main__":
    main()
