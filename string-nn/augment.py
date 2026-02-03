"""
Audio augmentation pipeline for guitar string classification.

Provides configurable augmentations that preserve fundamental frequency and harmonic structure
while simulating different recording environments and subtle tonal variations.
"""

from dataclasses import dataclass, field
from typing import Callable
import numpy as np


@dataclass
class AugmentationSettings:
    """Settings for a single augmentation type."""
    enabled: bool = True
    intensity: float = 0.5  # 0.0 to 1.0, controls effect strength
    probability: float = 0.5  # 0.0 to 1.0, proportion of samples affected


@dataclass
class AugmentationConfig:
    """
    Configuration for all augmentations.

    Each augmentation can be individually enabled/disabled, and has:
    - intensity: how strong the effect is (0.0-1.0)
    - probability: what proportion of samples get this augmentation (0.0-1.0)
    """
    reverb: AugmentationSettings = field(default_factory=lambda: AugmentationSettings(
        enabled=True,
        intensity=0.3,  # wet/dry mix
        probability=0.5
    ))
    chorus: AugmentationSettings = field(default_factory=lambda: AugmentationSettings(
        enabled=True,
        intensity=0.2,  # subtle modulation
        probability=0.3
    ))
    eq: AugmentationSettings = field(default_factory=lambda: AugmentationSettings(
        enabled=True,
        intensity=0.5,  # how extreme the EQ curves can be
        probability=0.5
    ))
    noise: AugmentationSettings = field(default_factory=lambda: AugmentationSettings(
        enabled=True,
        intensity=0.1,  # very subtle - noise level relative to signal
        probability=0.4
    ))
    pitch_drift: AugmentationSettings = field(default_factory=lambda: AugmentationSettings(
        enabled=True,
        intensity=0.3,  # max cents deviation (scaled by intensity)
        probability=0.4
    ))

    # Global settings
    random_seed: int | None = None  # For reproducibility

    @classmethod
    def subtle(cls) -> "AugmentationConfig":
        """Preset with very subtle augmentations."""
        return cls(
            reverb=AugmentationSettings(enabled=True, intensity=0.15, probability=0.4),
            chorus=AugmentationSettings(enabled=True, intensity=0.1, probability=0.2),
            eq=AugmentationSettings(enabled=True, intensity=0.3, probability=0.4),
            noise=AugmentationSettings(enabled=True, intensity=0.05, probability=0.3),
            pitch_drift=AugmentationSettings(enabled=True, intensity=0.2, probability=0.3),
        )

    @classmethod
    def moderate(cls) -> "AugmentationConfig":
        """Preset with moderate augmentations (default)."""
        return cls()

    @classmethod
    def aggressive(cls) -> "AugmentationConfig":
        """Preset with stronger augmentations for maximum variety."""
        return cls(
            reverb=AugmentationSettings(enabled=True, intensity=0.5, probability=0.6),
            chorus=AugmentationSettings(enabled=True, intensity=0.35, probability=0.4),
            eq=AugmentationSettings(enabled=True, intensity=0.7, probability=0.6),
            noise=AugmentationSettings(enabled=True, intensity=0.15, probability=0.5),
            pitch_drift=AugmentationSettings(enabled=True, intensity=0.5, probability=0.5),
        )

    @classmethod
    def disabled(cls) -> "AugmentationConfig":
        """All augmentations disabled."""
        return cls(
            reverb=AugmentationSettings(enabled=False, intensity=0, probability=0),
            chorus=AugmentationSettings(enabled=False, intensity=0, probability=0),
            eq=AugmentationSettings(enabled=False, intensity=0, probability=0),
            noise=AugmentationSettings(enabled=False, intensity=0, probability=0),
            pitch_drift=AugmentationSettings(enabled=False, intensity=0, probability=0),
        )


class AudioAugmenter:
    """
    Applies audio augmentations to guitar samples.

    Uses pedalboard for high-quality audio effects processing.
    All augmentations are designed to preserve fundamental frequency
    and harmonic structure while adding realistic tonal variations.
    """

    def __init__(self, config: AugmentationConfig | None = None, sample_rate: int = 44100):
        self.config = config or AugmentationConfig()
        self.sample_rate = sample_rate
        self._rng = np.random.default_rng(self.config.random_seed)

        # Lazy import pedalboard to allow module to load even if not installed
        self._pedalboard = None
        self._effects_cache: dict[str, object] = {}

    def _get_pedalboard(self):
        """Lazy load pedalboard library."""
        if self._pedalboard is None:
            try:
                import pedalboard
                self._pedalboard = pedalboard
            except ImportError:
                raise ImportError(
                    "pedalboard is required for audio augmentation. "
                    "Install with: pip install pedalboard"
                )
        return self._pedalboard

    def _should_apply(self, settings: AugmentationSettings) -> bool:
        """Determine if an augmentation should be applied based on its settings."""
        if not settings.enabled:
            return False
        return self._rng.random() < settings.probability

    def apply_reverb(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply reverb to simulate different room acoustics.

        Uses a convolution-based reverb for realistic room simulation.
        Intensity controls wet/dry mix.
        """
        pb = self._get_pedalboard()
        settings = self.config.reverb

        # Scale parameters by intensity
        room_size = 0.2 + settings.intensity * 0.6  # 0.2 to 0.8
        wet_level = settings.intensity * 0.5  # 0.0 to 0.5 (never fully wet)
        damping = 0.5 + settings.intensity * 0.3  # Higher damping for subtlety

        reverb = pb.Reverb(
            room_size=room_size,
            damping=damping,
            wet_level=wet_level,
            dry_level=1.0 - wet_level * 0.3,  # Keep dry signal strong
        )

        board = pb.Pedalboard([reverb])
        return board(audio, self.sample_rate)

    def apply_chorus(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply subtle chorus effect for slight modulation.

        Very subtle to avoid pitch artifacts that could confuse the classifier.
        """
        pb = self._get_pedalboard()
        settings = self.config.chorus

        # Keep chorus very subtle - small rate, shallow depth
        rate_hz = 0.5 + settings.intensity * 1.5  # 0.5 to 2.0 Hz
        depth = settings.intensity * 0.15  # 0.0 to 0.15 (very shallow)
        mix = settings.intensity * 0.3  # 0.0 to 0.3 (mostly dry)

        chorus = pb.Chorus(
            rate_hz=rate_hz,
            depth=depth,
            mix=mix,
            centre_delay_ms=7.0,
            feedback=0.0,  # No feedback to keep it subtle
        )

        board = pb.Pedalboard([chorus])
        return board(audio, self.sample_rate)

    def apply_eq(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply EQ variations to simulate different amp tone settings and preamps.

        Randomly applies bass/mid/treble adjustments within reasonable ranges.
        """
        pb = self._get_pedalboard()
        settings = self.config.eq

        # Maximum gain/cut in dB, scaled by intensity
        max_db = 3.0 + settings.intensity * 6.0  # 3 to 9 dB

        # Random EQ curve
        low_gain = self._rng.uniform(-max_db, max_db)
        mid_gain = self._rng.uniform(-max_db * 0.7, max_db * 0.7)  # Mids more conservative
        high_gain = self._rng.uniform(-max_db, max_db)

        # Presence adjustment (2-4kHz range, important for guitar character)
        presence_gain = self._rng.uniform(-max_db * 0.5, max_db * 0.5)

        filters = [
            # Low shelf for bass
            pb.LowShelfFilter(cutoff_frequency_hz=200, gain_db=low_gain, q=0.7),
            # Parametric mid
            pb.PeakFilter(cutoff_frequency_hz=800, gain_db=mid_gain, q=1.0),
            # Presence
            pb.PeakFilter(cutoff_frequency_hz=3000, gain_db=presence_gain, q=1.2),
            # High shelf for treble
            pb.HighShelfFilter(cutoff_frequency_hz=4000, gain_db=high_gain, q=0.7),
        ]

        board = pb.Pedalboard(filters)
        return board(audio, self.sample_rate)

    def apply_noise(self, audio: np.ndarray) -> np.ndarray:
        """
        Add subtle amp hiss and 60Hz hum.

        Very subtle to be barely perceptible but add realism.
        """
        settings = self.config.noise

        # Calculate signal RMS for proper noise scaling
        signal_rms = np.sqrt(np.mean(audio ** 2))
        if signal_rms < 1e-10:
            return audio

        # Noise level relative to signal, scaled by intensity
        noise_level = settings.intensity * 0.02  # Max 2% of signal level

        result = audio.copy()

        # Add white noise (amp hiss) - 70% of noise budget
        hiss_amount = noise_level * 0.7 * signal_rms
        hiss = self._rng.normal(0, hiss_amount, len(audio))

        # Apply subtle high-pass to hiss (amp hiss is typically higher frequency)
        # Simple first-order HP filter
        alpha = 0.95
        filtered_hiss = np.zeros_like(hiss)
        filtered_hiss[0] = hiss[0]
        for i in range(1, len(hiss)):
            filtered_hiss[i] = alpha * (filtered_hiss[i-1] + hiss[i] - hiss[i-1])

        result += filtered_hiss

        # Add 60Hz hum (power line) - 30% of noise budget
        hum_amount = noise_level * 0.3 * signal_rms
        t = np.arange(len(audio)) / self.sample_rate
        # 60Hz fundamental with weak harmonics
        hum = hum_amount * (
            np.sin(2 * np.pi * 60 * t) +
            0.3 * np.sin(2 * np.pi * 120 * t) +  # 2nd harmonic
            0.1 * np.sin(2 * np.pi * 180 * t)    # 3rd harmonic
        )
        result += hum

        return result

    def apply_pitch_drift(self, audio: np.ndarray) -> np.ndarray:
        """
        Apply subtle pitch drift to simulate slightly out-of-tune guitars.

        Uses resampling to shift pitch by a small amount (up to ~15 cents by default).
        This preserves harmonic relationships while shifting the fundamental.
        """
        pb = self._get_pedalboard()
        settings = self.config.pitch_drift

        # Maximum pitch shift in semitones, scaled by intensity
        # intensity 0.3 -> max 15 cents (0.15 semitones)
        max_semitones = settings.intensity * 0.5

        # Random pitch shift (positive or negative)
        semitones = self._rng.uniform(-max_semitones, max_semitones)

        if abs(semitones) < 0.01:  # Skip if negligible
            return audio

        # Use high-quality pitch shifting
        pitch_shift = pb.PitchShift(semitones=semitones)

        board = pb.Pedalboard([pitch_shift])
        return board(audio, self.sample_rate)

    def augment(self, audio: np.ndarray) -> tuple[np.ndarray, dict[str, bool]]:
        """
        Apply all enabled augmentations to the audio.

        Returns:
            Tuple of (augmented_audio, applied_augmentations_dict)
            The dict indicates which augmentations were actually applied.
        """
        result = audio.copy().astype(np.float32)

        # Ensure audio is the right shape for pedalboard (needs to be 2D or 1D)
        if result.ndim == 1:
            was_1d = True
        else:
            was_1d = False

        applied = {
            "reverb": False,
            "chorus": False,
            "eq": False,
            "noise": False,
            "pitch_drift": False,
        }

        # Apply augmentations in a specific order that makes sense acoustically:
        # 1. Pitch drift first (modifies the source)
        # 2. EQ (tone shaping)
        # 3. Chorus (modulation)
        # 4. Reverb (spatial)
        # 5. Noise last (recording artifacts)

        if self._should_apply(self.config.pitch_drift):
            result = self.apply_pitch_drift(result)
            applied["pitch_drift"] = True

        if self._should_apply(self.config.eq):
            result = self.apply_eq(result)
            applied["eq"] = True

        if self._should_apply(self.config.chorus):
            result = self.apply_chorus(result)
            applied["chorus"] = True

        if self._should_apply(self.config.reverb):
            result = self.apply_reverb(result)
            applied["reverb"] = True

        if self._should_apply(self.config.noise):
            result = self.apply_noise(result)
            applied["noise"] = True

        # Normalize to prevent clipping while preserving relative levels
        max_val = np.max(np.abs(result))
        if max_val > 1.0:
            result = result / max_val * 0.99

        return result, applied

    def augment_multiple(
        self,
        audio: np.ndarray,
        n_augmentations: int = 1
    ) -> list[tuple[np.ndarray, dict[str, bool]]]:
        """
        Generate multiple augmented versions of the same audio.

        Useful for data augmentation during training.
        """
        results = []
        for _ in range(n_augmentations):
            augmented, applied = self.augment(audio)
            results.append((augmented, applied))
        return results


def create_augmenter(
    preset: str = "moderate",
    sample_rate: int = 44100,
    **overrides
) -> AudioAugmenter:
    """
    Factory function to create an augmenter with a preset configuration.

    Args:
        preset: One of "subtle", "moderate", "aggressive", or "disabled"
        sample_rate: Audio sample rate
        **overrides: Override specific settings, e.g.:
            reverb_enabled=False,
            reverb_intensity=0.2,
            chorus_probability=0.5

    Returns:
        Configured AudioAugmenter instance
    """
    presets = {
        "subtle": AugmentationConfig.subtle,
        "moderate": AugmentationConfig.moderate,
        "aggressive": AugmentationConfig.aggressive,
        "disabled": AugmentationConfig.disabled,
    }

    if preset not in presets:
        raise ValueError(f"Unknown preset: {preset}. Choose from: {list(presets.keys())}")

    config = presets[preset]()

    # Apply overrides
    for key, value in overrides.items():
        parts = key.split("_", 1)
        if len(parts) == 2:
            aug_name, setting = parts
            if hasattr(config, aug_name):
                aug_settings = getattr(config, aug_name)
                if isinstance(aug_settings, AugmentationSettings) and hasattr(aug_settings, setting):
                    setattr(aug_settings, setting, value)

    return AudioAugmenter(config, sample_rate)


if __name__ == "__main__":
    # Demo/test the augmentation pipeline
    import sys

    print("Audio Augmentation Pipeline")
    print("=" * 50)

    # Create test signal (440Hz sine wave, simulating a guitar note)
    sr = 44100
    duration = 1.0
    t = np.linspace(0, duration, int(sr * duration))

    # Create a more realistic guitar-like signal with harmonics
    fundamental = 196.0  # G3, open G string
    test_audio = (
        1.0 * np.sin(2 * np.pi * fundamental * t) +       # Fundamental
        0.5 * np.sin(2 * np.pi * fundamental * 2 * t) +   # 2nd harmonic
        0.25 * np.sin(2 * np.pi * fundamental * 3 * t) +  # 3rd harmonic
        0.12 * np.sin(2 * np.pi * fundamental * 4 * t)    # 4th harmonic
    ).astype(np.float32)

    # Normalize
    test_audio = test_audio / np.max(np.abs(test_audio)) * 0.8

    print(f"\nTest signal: {fundamental}Hz with harmonics")
    print(f"Sample rate: {sr}")
    print(f"Duration: {duration}s")

    # Test each preset
    for preset_name in ["subtle", "moderate", "aggressive"]:
        print(f"\n--- Preset: {preset_name} ---")

        try:
            augmenter = create_augmenter(preset=preset_name, sample_rate=sr)
            augmented, applied = augmenter.augment(test_audio)

            print(f"Applied augmentations: {[k for k, v in applied.items() if v]}")
            print(f"Original RMS: {np.sqrt(np.mean(test_audio**2)):.4f}")
            print(f"Augmented RMS: {np.sqrt(np.mean(augmented**2)):.4f}")
            print(f"Max amplitude: {np.max(np.abs(augmented)):.4f}")

        except ImportError as e:
            print(f"Error: {e}")
            print("Install pedalboard to use augmentations: pip install pedalboard")
            sys.exit(1)

    print("\n" + "=" * 50)
    print("Augmentation pipeline ready!")
