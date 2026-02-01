import json
import pickle
import warnings
from pathlib import Path

import torch

from model import StringClassifier


def export_to_onnx(
    model_path: Path,
    scaler_path: Path,
    output_dir: Path,
    opset_version: int = 17,
):
    """Export trained model and scaler to ONNX format for browser inference."""
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)

    model = StringClassifier(
        input_size=checkpoint["input_size"],
        num_classes=checkpoint["num_classes"],
    )
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
    print(f"ONNX model saved to: {onnx_path}")

    with open(scaler_path, "rb") as f:
        scaler = pickle.load(f)

    scaler_config = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "feature_names": [
            # Harmonic ratios (12)
            "harmonic_ratio_1",
            "harmonic_ratio_2",
            "harmonic_ratio_3",
            "harmonic_ratio_4",
            "harmonic_ratio_5",
            "harmonic_ratio_6",
            "harmonic_ratio_7",
            "harmonic_ratio_8",
            "harmonic_ratio_9",
            "harmonic_ratio_10",
            "harmonic_ratio_11",
            "harmonic_ratio_12",
            # Spectral (2)
            "spectral_centroid",
            "spectral_rolloff",
            # Timbral (3)
            "inharmonicity",
            "rms_energy",
            "energy_slope",
            # Frequency-relative (3)
            "log_frequency",
            "semitones_from_e2",
            "octave_number",
            # MFCCs (13)
            "mfcc_0",
            "mfcc_1",
            "mfcc_2",
            "mfcc_3",
            "mfcc_4",
            "mfcc_5",
            "mfcc_6",
            "mfcc_7",
            "mfcc_8",
            "mfcc_9",
            "mfcc_10",
            "mfcc_11",
            "mfcc_12",
        ],
        "string_labels": ["E2", "A2", "D3", "G3", "B3", "E4"],
    }

    scaler_json_path = output_dir / "scaler.json"
    with open(scaler_json_path, "w") as f:
        json.dump(scaler_config, f, indent=2)
    print(f"Scaler config saved to: {scaler_json_path}")


def main():
    script_dir = Path(__file__).parent
    models_dir = script_dir / "data" / "models"
    output_dir = script_dir / "data" / "onnx"
    frontend_dir = script_dir.parent / "frontend" / "public" / "models"

    output_dir.mkdir(parents=True, exist_ok=True)
    frontend_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "string_classifier.pt"
    scaler_path = models_dir / "scaler.pkl"

    if not model_path.exists():
        print(f"Model not found: {model_path}")
        print("Train the model first with: python train.py")
        return

    if not scaler_path.exists():
        print(f"Scaler not found: {scaler_path}")
        print("Train the model first with: python train.py")
        return

    export_to_onnx(model_path, scaler_path, output_dir)

    import shutil
    shutil.copy(output_dir / "string_classifier.onnx", frontend_dir / "string_classifier.onnx")
    shutil.copy(output_dir / "scaler.json", frontend_dir / "scaler.json")
    print(f"\nCopied to frontend: {frontend_dir}")

    print("\nExport complete! Files ready for browser deployment.")


if __name__ == "__main__":
    main()
