/**
 * Feature configuration for guitar string classifier.
 *
 * This file mirrors the Python features_config.py to ensure
 * feature ordering and filtering matches between training and inference.
 *
 * The actual enabled features are determined by scaler.json's feature_names
 * field, which is exported during training.
 */

// All available features in the exact order they appear in the full feature vector.
// This MUST match Python's ALL_FEATURE_NAMES in features_config.py
export const ALL_FEATURE_NAMES = [
  // Harmonic ratios (12 features)
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
  // Spectral features (2 features)
  "spectral_centroid",
  "spectral_rolloff",
  // Timbral features (5 features)
  "inharmonicity",
  "rms_energy",
  "energy_slope",
  "zcr",
  "odd_even_harmonic_ratio",
  // Frequency-relative features (3 features)
  "log_frequency",
  "semitones_from_e2",
  "octave_number",
  // MFCCs (13 features)
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
  // Transition detection (1 feature)
  "transition_likelihood",
] as const

export type FeatureName = (typeof ALL_FEATURE_NAMES)[number]

// Map feature name to its index in the full 36-element feature vector
export const FEATURE_NAME_TO_INDEX: Record<string, number> = Object.fromEntries(
  ALL_FEATURE_NAMES.map((name, i) => [name, i]),
)

/**
 * Get the indices of enabled features in the full feature vector.
 * @param enabledFeatures List of enabled feature names (from scaler.json)
 * @returns Array of indices into the full 36-element vector
 */
export function getEnabledIndices(enabledFeatures: string[]): number[] {
  return enabledFeatures.map((name) => FEATURE_NAME_TO_INDEX[name]).filter((i) => i !== undefined)
}

/**
 * Filter a full feature vector to only include enabled features.
 * @param fullVector The complete 36-element feature vector
 * @param enabledFeatures List of enabled feature names (from scaler.json)
 * @returns Filtered vector containing only enabled features in correct order
 */
export function filterFeatureVector(
  fullVector: Float32Array,
  enabledFeatures: string[],
): Float32Array {
  const indices = getEnabledIndices(enabledFeatures)
  const filtered = new Float32Array(indices.length)
  for (let i = 0; i < indices.length; i++) {
    filtered[i] = fullVector[indices[i]]
  }
  return filtered
}
