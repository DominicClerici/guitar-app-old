"""
Feature configuration for guitar string classifier.

Edit ENABLED_FEATURES to enable/disable features for training.
Feature extraction (main.py) always extracts all features to keep data complete.
Filtering happens at training time.
"""

# ============================================================
# ALL AVAILABLE FEATURES (in order)
# ============================================================
ALL_FEATURE_NAMES = (
    [f"harmonic_ratio_{i+1}" for i in range(12)] +
    ["spectral_centroid", "spectral_rolloff"] +
    ["inharmonicity", "rms_energy", "energy_slope", "zcr", "odd_even_harmonic_ratio"] +
    ["log_frequency", "semitones_from_e2", "octave_number"] +
    [f"mfcc_{i}" for i in range(13)]
)

# ============================================================
# ENABLED FEATURES - Edit this list to enable/disable features
# ============================================================
# Comment out or remove features you want to disable.
# The model will only be trained on features listed here.

ENABLED_FEATURES = [
    # Harmonic ratios (12 features) - relative amplitudes of harmonics
    # "harmonic_ratio_1",
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

    # Spectral features (2 features)
    "spectral_centroid",
    "spectral_rolloff",

    # Timbral features (5 features)
    "inharmonicity",
    # "rms_energy",
    "energy_slope",
    "zcr",
    "odd_even_harmonic_ratio",

    # Frequency-relative features (3 features)
    "log_frequency",
    # "semitones_from_e2",
    "octave_number",

    # MFCCs (13 features) - mel-frequency cepstral coefficients
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
]

# ============================================================
# FEATURE GROUPS (for analysis and ablation studies)
# ============================================================
FEATURE_GROUPS = {
    "harmonic_ratios": [f"harmonic_ratio_{i+1}" for i in range(12)],
    "spectral": ["spectral_centroid", "spectral_rolloff"],
    "timbral": ["inharmonicity", "rms_energy", "energy_slope", "zcr", "odd_even_harmonic_ratio"],
    "frequency_relative": ["log_frequency", "semitones_from_e2", "octave_number"],
    "mfcc": [f"mfcc_{i}" for i in range(13)],
}


def get_enabled_feature_names() -> list[str]:
    """Get list of enabled feature names in their original order."""
    enabled_set = set(ENABLED_FEATURES)
    return [f for f in ALL_FEATURE_NAMES if f in enabled_set]


def get_enabled_indices() -> list[int]:
    """Get indices of enabled features in the full feature vector."""
    enabled_set = set(ENABLED_FEATURES)
    return [i for i, name in enumerate(ALL_FEATURE_NAMES) if name in enabled_set]


def get_enabled_feature_groups() -> dict[str, list[int]]:
    """
    Get feature groups with indices remapped for enabled features only.

    Returns dict mapping group name to list of indices in the filtered feature vector.
    Groups with no enabled features are omitted.
    """
    enabled_names = get_enabled_feature_names()
    name_to_idx = {name: i for i, name in enumerate(enabled_names)}

    groups = {}
    for group_name, feature_names in FEATURE_GROUPS.items():
        indices = [name_to_idx[f] for f in feature_names if f in name_to_idx]
        if indices:
            groups[group_name] = indices
    return groups


def get_num_enabled_features() -> int:
    """Get the number of enabled features."""
    return len(get_enabled_feature_names())


def print_feature_summary():
    """Print a summary of enabled vs disabled features."""
    enabled = get_enabled_feature_names()
    enabled_set = set(enabled)
    disabled = [f for f in ALL_FEATURE_NAMES if f not in enabled_set]

    print(f"\nFeature Configuration Summary")
    print(f"{'=' * 40}")
    print(f"Total features:   {len(ALL_FEATURE_NAMES)}")
    print(f"Enabled features: {len(enabled)}")
    print(f"Disabled features: {len(disabled)}")

    if disabled:
        print(f"\nDisabled features:")
        for f in disabled:
            print(f"  - {f}")

    print(f"\nEnabled feature groups:")
    for group_name, indices in get_enabled_feature_groups().items():
        print(f"  {group_name}: {len(indices)} features")


if __name__ == "__main__":
    print_feature_summary()
