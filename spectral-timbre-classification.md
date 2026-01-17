# Spectral/Timbre Feature Classification for Guitar String Detection

## Overview

This approach detects which guitar string is being played by extracting **timbral features** from the audio signal and using machine learning classification. Each string has a unique "sound fingerprint" based on its physical construction, even when playing the same pitch.

## The Concept

### Why Strings Sound Different

Even when two strings produce the same fundamental frequency, they differ in:

- **Harmonic content**: Relative amplitudes of overtones
- **Attack characteristics**: How the sound begins
- **Spectral envelope**: Overall shape of the frequency spectrum
- **Brightness**: Concentration of energy in high vs low frequencies

These differences arise from:
- String material (plain steel vs wound)
- String gauge (thickness)
- Pickup position relative to the vibrating length
- Effective string length when fretted

### Machine Learning Approach

1. Extract numerical features that capture timbral characteristics
2. Train a classifier on labeled examples (known string → features)
3. At runtime, extract features and classify

## Key Spectral Features

### 1. Spectral Centroid

The "center of mass" of the spectrum — indicates brightness.

```
Centroid = Σ(f × M(f)) / Σ(M(f))
```

Where f is frequency and M(f) is magnitude at that frequency.

- Higher centroid = brighter sound (more high-frequency content)
- Lower centroid = darker sound (more low-frequency content)

Thinner strings and higher fret positions tend to produce higher spectral centroids.

### 2. Spectral Rolloff

The frequency below which a certain percentage (typically 85% or 95%) of the spectral energy is contained.

```
Find f_rolloff where: Σ(M(f) for f < f_rolloff) = 0.85 × Σ(M(f))
```

Indicates the "edge" of the spectral energy distribution.

### 3. Spectral Spread (Bandwidth)

The standard deviation of the spectrum around the centroid.

```
Spread = √(Σ((f - centroid)² × M(f)) / Σ(M(f)))
```

Narrow spread = more concentrated spectrum; Wide spread = broader tonal content.

### 4. Spectral Flatness

Ratio of geometric mean to arithmetic mean of the spectrum.

- Values near 1.0 = noise-like (flat spectrum)
- Values near 0.0 = tonal (peaked spectrum)

Useful for detecting clean vs distorted signals.

### 5. Spectral Flux

Rate of change of the spectrum over time.

```
Flux = Σ(M_current(f) - M_previous(f))²
```

High flux during attack, lower during sustain. Different strings have different attack profiles.

### 6. MFCC (Mel-Frequency Cepstral Coefficients)

The gold standard for timbre representation. MFCCs capture the spectral envelope in a perceptually-motivated way.

**Computation steps:**
1. Compute power spectrum via FFT
2. Apply mel filterbank (triangular filters spaced on mel scale)
3. Take log of filterbank energies
4. Apply DCT to get cepstral coefficients

Typically use 12-13 MFCCs. These compress the spectral shape into a compact representation.

### 7. Harmonic Ratios

Relative amplitudes of specific harmonics:
- H2/H1 (2nd harmonic to fundamental ratio)
- H3/H1
- Even/Odd harmonic ratio

Different strings have characteristic harmonic profiles.

### 8. Zero Crossing Rate

Number of times the signal crosses zero per unit time.

Higher ZCR = more high-frequency content. Simple but effective brightness indicator.

## Feature Vector Construction

Combine multiple features into a single vector for classification:

```
Feature Vector = [
  spectral_centroid,
  spectral_rolloff,
  spectral_spread,
  spectral_flatness,
  spectral_flux,
  mfcc_1, mfcc_2, ..., mfcc_13,
  h2_h1_ratio,
  h3_h1_ratio,
  zcr
]
```

Total: ~20-25 features. Normalize each feature (z-score or min-max) before classification.

## Classification Methods

### Option A: Support Vector Machine (SVM)

- Works well with small datasets
- Good for clearly separable classes
- Can use RBF kernel for non-linear boundaries

### Option B: Random Forest

- Handles feature interactions well
- Provides feature importance rankings
- Robust to outliers

### Option C: K-Nearest Neighbors (KNN)

- Simple, no training phase (lazy learning)
- Good for small datasets
- Can use dynamic time warping for time-series features

### Option D: Small Neural Network

- MLP with 1-2 hidden layers
- Can learn complex feature interactions
- Requires more training data

**Recommendation**: Start with **Random Forest** or **KNN** for simplicity. Move to neural network if accuracy is insufficient.

## Implementation Architecture

### Hook: `useSpectralStringDetection`

```
Input:
  - Audio buffer (Float32Array from AnalyserNode)
  - Sample rate
  - Trained classifier model
  - (Optional) detected fundamental frequency for filtering candidates

Output:
  - Detected string number (1-6)
  - Confidence scores for each string
  - Extracted features (for debugging)
```

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  Audio Input (from AnalyserNode)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Preprocessing                                              │
│  - Apply window function (Hann)                             │
│  - Compute FFT                                              │
│  - Compute power spectrum                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Feature Extraction                                         │
│  - Spectral centroid, rolloff, spread, flatness             │
│  - MFCCs (via mel filterbank + DCT)                         │
│  - Harmonic ratios (requires fundamental)                   │
│  - Zero crossing rate                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Feature Normalization                                      │
│  - Apply stored mean/std from training                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Classification                                             │
│  - Run classifier (KNN, RF, or NN)                          │
│  - Optionally filter by pitch (rule out impossible strings) │
│  - Output string + confidence                               │
└─────────────────────────────────────────────────────────────┘
```

## Training Data Collection

### Calibration/Training Flow

Unlike inharmonicity detection, this approach **requires labeled training data**.

**Per-guitar calibration:**
1. User plays each string at multiple fret positions
2. Collect ~10-20 samples per string (varied frets, varied dynamics)
3. Extract features from each sample
4. Train classifier in-browser

**Pre-trained model (generic):**
- Train on diverse guitar recordings
- Works "out of the box" but less accurate
- Can be fine-tuned with user's guitar

### Data Augmentation

To improve robustness with limited data:
- Add slight pitch shifts
- Add small amounts of noise
- Vary amplitude

## Browser-Based ML Options

### TensorFlow.js

- Full ML framework in browser
- Can train and run models
- Larger bundle size

### ONNX Runtime Web

- Run pre-trained models (export from Python)
- Efficient inference
- No training in browser

### ML5.js

- Simplified ML for creative coding
- Built on TensorFlow.js
- Good for KNN classifier

### Custom Implementation

For simple classifiers (KNN, decision trees), consider implementing from scratch:
- No dependencies
- Full control
- Easier to debug

**Recommendation**: Use **TensorFlow.js** for flexibility, or implement **KNN** manually for minimal dependencies.

## Technical Considerations

### FFT Parameters

| Parameter | Recommendation | Notes |
|-----------|---------------|-------|
| FFT Size | 2048-4096 | Balance resolution vs latency |
| Window | Hann | Good frequency resolution |
| Hop Size | 512-1024 | For flux calculation |

### MFCC Computation

- Number of mel filters: 26-40
- Number of MFCCs to keep: 12-13 (discard the 0th coefficient)
- Frequency range: 20Hz to Nyquist (or 8000Hz for guitar)

The mel scale approximates human pitch perception:
```
mel(f) = 2595 × log10(1 + f/700)
```

### Real-Time Considerations

- Feature extraction must complete within one buffer cycle
- Cache mel filterbank (constant for given sample rate)
- Pre-compute DCT matrix for MFCCs
- Consider Web Workers for classification if latency is an issue

### Handling Multiple Notes

This approach works best for **monophonic** (single note) detection. For chords:
- Features become mixed
- Would need source separation first
- Consider focusing on the root note

## Comparison with Inharmonicity Approach

| Aspect | Inharmonicity | Spectral/Timbre |
|--------|---------------|-----------------|
| Training data | Optional (physics model) | Required |
| Accuracy | High for clean signals | High with good training |
| Computation | Moderate (peak finding) | Higher (many features) |
| Robustness | Sensitive to noise | More robust to noise |
| Generalization | Works across guitars | Per-guitar calibration ideal |

## Integration with Existing Code

The hook should:
1. Share the AnalyserNode from `useNoteDetection`
2. Accept optional pitch data to filter candidate strings
3. Expose training/calibration methods
4. Store model in localStorage or IndexedDB

## Testing the Hook

Create a debug UI showing:
- Real-time feature values (centroid, rolloff, etc.)
- Feature history over time (line charts)
- Classification probabilities per string
- Confusion matrix during training
- Spectrogram visualization

## Feature Extraction Libraries

Consider these for implementation reference:

- **Meyda.js** — Audio feature extraction library for JavaScript
  - Provides: spectral centroid, rolloff, flux, MFCCs, ZCR, and more
  - https://meyda.js.org/

- **essentia.js** — Port of Essentia (C++ audio analysis) to WebAssembly
  - Comprehensive feature set
  - Higher performance
  - https://mtg.github.io/essentia.js/

Using an existing library (especially Meyda) can significantly accelerate development.

## Sample Workflow for Training

1. **Collect**: Record each string at frets 0, 3, 5, 7, 9, 12
2. **Label**: Associate each recording with string number
3. **Extract**: Compute feature vector for each sample
4. **Split**: 80% training, 20% validation
5. **Train**: Fit classifier
6. **Evaluate**: Check accuracy on validation set
7. **Deploy**: Save model for runtime use

## References

- Meyda.js Documentation — https://meyda.js.org/
- MFCC Explanation — https://www.practicalcryptography.com/miscellaneous/machine-learning/guide-mel-frequency-cepstral-coefficients-mfccs/
- Spectral Features for Music Analysis — https://www.mathworks.com/help/audio/ug/spectral-descriptors.html
- TensorFlow.js — https://www.tensorflow.org/js
