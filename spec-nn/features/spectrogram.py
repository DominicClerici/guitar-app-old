"""
Mel-spectrogram computation for guitar audio classification.

Parameters are chosen for real-time browser inference matching the
frontend's spectrogram implementation.
"""

import numpy as np
import librosa

# Audio parameters
SAMPLE_RATE = 48000
WINDOW_SIZE = 4096

# Spectrogram parameters
N_FFT = WINDOW_SIZE
HOP_LENGTH = WINDOW_SIZE // 8
N_MELS = 80
FMIN = 60.0  # Below low E (82Hz) to capture fundamental
FMAX = 5000.0  # Captures harmonics up to ~6th for high strings

# Amplitude normalization
TARGET_RMS = 0.035  # Match browser inference


def calculate_rms(samples: np.ndarray) -> float:
    return float(np.sqrt(np.mean(samples**2)))


def normalize_audio_amplitude(
    samples: np.ndarray, target_rms: float = TARGET_RMS
) -> np.ndarray:
    current_rms = calculate_rms(samples)
    if current_rms < 1e-10:
        return samples
    gain = target_rms / current_rms
    return samples * gain


def audio_to_mel_spectrogram(
    audio: np.ndarray,
    sr: int = SAMPLE_RATE,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
    n_mels: int = N_MELS,
    fmin: float = FMIN,
    fmax: float = FMAX,
) -> np.ndarray:
    """
    Convert audio window to mel-spectrogram in dB scale.

    Returns:
        Mel-spectrogram in dB scale, shape (n_mels, time_frames)
    """
    mel_spec = librosa.feature.melspectrogram(
        y=audio,
        sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        n_mels=n_mels,
        fmin=fmin,
        fmax=fmax,
        power=2.0,
    )

    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
    return mel_spec_db
