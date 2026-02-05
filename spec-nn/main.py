"""
Spectrogram-based guitar string classification pipeline.

Orchestrates feature extraction, model training, and ONNX export.

Usage:
    python main.py              # Run all steps (extract, train, export)
    python main.py -f           # Extract features only
    python main.py -t           # Train model only
    python main.py -e           # Export to ONNX only
    python main.py -s           # Simulate browser inference on label sessions
    python main.py -f -t        # Extract features and train
    python main.py -f -t -e     # All steps (explicit)
"""

import argparse
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(
        description="Spectrogram-based guitar string classification pipeline."
    )

    # Pipeline control
    parser.add_argument(
        "-f", "--features",
        action="store_true",
        help="Extract mel-spectrogram features from audio samples"
    )
    parser.add_argument(
        "-t", "--train",
        action="store_true",
        help="Train the CNN classifier"
    )
    parser.add_argument(
        "-e", "--export",
        action="store_true",
        help="Export trained model to ONNX"
    )
    parser.add_argument(
        "-s", "--simulate",
        action="store_true",
        help="Simulate browser inference on label sessions"
    )

    # Feature extraction options
    parser.add_argument(
        "--samples-dir",
        type=str,
        default=None,
        help="Directory containing audio samples (default: ../frontend/samples)"
    )
    parser.add_argument(
        "--include-finetune",
        action="store_true",
        help="Include finetune samples from ../frontend/finetune_samples"
    )

    # Training options
    parser.add_argument("--epochs", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--patience", type=int, default=30)
    parser.add_argument("--large-model", action="store_true")
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument(
        "--seed",
        type=str,
        default="random",
        help="Random seed for train/val split (integer or 'random', default: 'random')"
    )

    # Export options
    parser.add_argument(
        "--no-copy-to-frontend",
        action="store_true",
        help="Don't copy ONNX files to frontend public directory"
    )

    return parser.parse_args()


def main():
    args = parse_args()

    run_all = not (args.features or args.train or args.export or args.simulate)

    if args.features or run_all:
        print("\n====== Feature Extraction ======\n")
        from features import extract_features

        extract_features(
            samples_dir=Path(args.samples_dir) if args.samples_dir else None,
            include_finetune=args.include_finetune,
        )

    if args.train or run_all:
        print("\n====== Training ======\n")
        from train import train

        train(
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.learning_rate,
            patience=args.patience,
            use_large_model=args.large_model,
            dropout=args.dropout,
            seed=args.seed,
        )

    if args.export or run_all:
        print("\n====== ONNX Export ======\n")
        from export_onnx import run_export

        run_export(
            copy_to_frontend=not args.no_copy_to_frontend,
        )

    if args.simulate:
        from simulate import simulate

        simulate()


if __name__ == "__main__":
    main()
