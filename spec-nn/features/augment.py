"""
Audio augmentation for training data.

Applies effects to audio arrays for data augmentation in the training pipeline.
"""

import random

import numpy as np
from pedalboard import Pedalboard, Reverb, Chorus

# tuples of (min, max) values
paramConfig = {
    "slight": {
        "reverb": {
            "room_size": (0.2, 0.3),
            "damping": (0.7, 0.8),
            "wet_level": (0.3, 0.4),
            "width": (0.5, 0.7),
        },
        "chorus": {
            "rate_hz": (0.3, 0.5),
            "depth": (0.05, 0.12),
            "centre_delay_ms": (1, 6),
            "feedback": (0.0, 0.1),
            "mix": (0.3, 0.4),
        },
        "pitch_drift": {
            "cents": (2, 10),
        },
    },
    "moderate": {
        "reverb": {
            "room_size": (0.3, 0.4),
            "damping": (0.5, 0.6),
            "wet_level": (0.45, 0.55),
            "width": (0.7, 0.9),
        },
        "chorus": {
            "rate_hz": (0.3, 0.75),
            "depth": (0.1, 0.16),
            "centre_delay_ms": (1, 6),
            "feedback": (0.1, 0.2),
            "mix": (0.35, 0.5),
        },
        "pitch_drift": {
            "cents": (10, 20),
        },
    },
    "aggressive": {
        "reverb": {
            "room_size": (0.35, 0.45),
            "damping": (0.4, 0.5),
            "wet_level": (0.55, 0.65),
            "width": (0.9, 1.0),
        },
        "chorus": {
            "rate_hz": (0.3, 0.9),
            "depth": (0.15, 0.2),
            "centre_delay_ms": (1, 6),
            "feedback": (0.2, 0.3),
            "mix": (0.55, 0.7),
        },
        "pitch_drift": {
            "cents": (15, 30),
        },
    },
}


def apply_reverb(audio, sample_rate, config="slight"):
    cfg = paramConfig[config]["reverb"]

    room_size = random.uniform(*cfg["room_size"])
    damping = random.uniform(*cfg["damping"])
    wet_level = random.uniform(*cfg["wet_level"])
    width = random.uniform(*cfg["width"])
    dry_level = 1.0 - wet_level

    board = Pedalboard(
        [
            Reverb(
                room_size=room_size,
                damping=damping,
                wet_level=wet_level,
                dry_level=dry_level,
                width=width,
            )
        ]
    )

    return board(audio, sample_rate)


def apply_chorus(audio, sample_rate, config="slight"):
    cfg = paramConfig[config]["chorus"]

    rate_hz = random.uniform(*cfg["rate_hz"])
    depth = random.uniform(*cfg["depth"])
    centre_delay_ms = random.uniform(*cfg["centre_delay_ms"])
    feedback = random.uniform(*cfg["feedback"])
    mix = random.uniform(*cfg["mix"])

    board = Pedalboard(
        [
            Chorus(
                rate_hz=rate_hz,
                depth=depth,
                centre_delay_ms=centre_delay_ms,
                feedback=feedback,
                mix=mix,
            )
        ]
    )

    return board(audio, sample_rate)


def apply_pitch_drift(audio, sample_rate, config="slight"):
    cfg = paramConfig[config]["pitch_drift"]

    cents = random.uniform(*cfg["cents"])
    if random.random() < 0.5:
        cents = -cents

    ratio = 2 ** (cents / 1200)
    n_samples = audio.shape[0]
    new_length = int(n_samples / ratio)

    old_indices = np.arange(n_samples)
    new_indices = np.linspace(0, n_samples - 1, new_length)

    if audio.ndim == 1:
        resampled = np.interp(new_indices, old_indices, audio).astype(np.float32)
    else:
        resampled = np.column_stack(
            [
                np.interp(new_indices, old_indices, audio[:, ch])
                for ch in range(audio.shape[1])
            ]
        ).astype(np.float32)

    return resampled
