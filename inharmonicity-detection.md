# Inharmonicity-Based Guitar String Detection

## Overview

This approach detects which guitar string is being played by analyzing **inharmonicity** — the physical phenomenon where real string overtones deviate from perfect harmonic ratios. Each string has a unique inharmonicity "fingerprint" based on its physical properties.

## The Physics

### Ideal vs Real Strings

An **ideal string** produces perfectly harmonic overtones:
- Fundamental: f₀
- 2nd partial: 2 × f₀
- 3rd partial: 3 × f₀
- nth partial: n × f₀

A **real string** has stiffness, causing partials to be slightly sharp (stretched):
- nth partial: `fₙ = n × f₀ × √(1 + B × n²)`

Where **B** is the inharmonicity coefficient.

### The Inharmonicity Coefficient (B)

B is determined by physical string properties:

```
B = (π² × E × I) / (T × L²)
```

Where:
- E = Young's modulus (material stiffness)
- I = Second moment of area (related to string diameter)
- T = String tension
- L = Vibrating string length

**Key insight**: B varies significantly between strings because:
- Thicker strings (low E, A) have higher B values
- Thinner strings (high E, B) have lower B values
- Fretting shortens L, which increases B (B ∝ 1/L²)

### Why This Enables String Detection

The same pitch can be played on multiple strings at different frets. For example, A4 (440Hz) can be played:
- String 1 (high E), fret 5
- String 2 (B), fret 10
- String 3 (G), fret 14

Each produces A4 but with **different B values** because:
- Different base string thickness
- Different vibrating length (fret position)
- Different tension

By measuring B from the audio, we can identify which string produced the note.

## Detection Algorithm

### Step 1: Obtain the Fundamental Frequency

Use the existing `useNoteDetection` hook to get the detected pitch. This is our f₀.

### Step 2: Extract Partial Frequencies via FFT

Perform an FFT on the audio buffer to get the frequency spectrum. For each expected partial (n = 2, 3, 4, ... up to ~10):

1. Calculate the **ideal** partial frequency: `f_ideal = n × f₀`
2. Search for a peak in the spectrum near `f_ideal`
3. Use **parabolic interpolation** around the peak bin for sub-bin accuracy
4. Record the **actual** partial frequency: `f_actual`

### Step 3: Estimate the Inharmonicity Coefficient

From the formula `fₙ = n × f₀ × √(1 + B × n²)`, we can solve for B:

```
B = ((fₙ / (n × f₀))² - 1) / n²
```

Calculate B for each detected partial (n = 2 through ~8), then take the median or weighted average. Higher partials give more reliable B estimates because the stretching effect is amplified by n².

### Step 4: Map B to String/Fret

Two approaches:

**A) Lookup Table (requires calibration)**
- User plays each open string during setup
- Store measured B values for each string
- At runtime, compare measured B against stored values

**B) Physics Model (no calibration)**
- Use known string gauge, tension, and scale length
- Calculate expected B for each string/fret combination
- Match measured B to closest predicted value

## Implementation Architecture

### Hook: `useInharmonicityDetection`

```
Input:
  - Audio buffer (Float32Array from AnalyserNode)
  - Sample rate
  - Detected fundamental frequency (from useNoteDetection)
  - Calibration data (optional)

Output:
  - Estimated inharmonicity coefficient (B)
  - Detected string number (1-6)
  - Confidence score
  - Detected partials array (for debugging/visualization)
```

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  Audio Input (from useNoteDetection's analyser)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FFT Analysis                                               │
│  - Use larger FFT size (4096-8192) for frequency resolution │
│  - Apply window function (Hann or Blackman)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Peak Detection                                             │
│  - Find peaks near expected partial frequencies             │
│  - Use parabolic interpolation for precision                │
│  - Filter by amplitude threshold                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  B Coefficient Estimation                                   │
│  - Calculate B from each partial                            │
│  - Use robust estimation (median, outlier rejection)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  String Classification                                      │
│  - Compare B to calibration data or physics model           │
│  - Consider pitch to narrow candidate strings               │
│  - Output string number + confidence                        │
└─────────────────────────────────────────────────────────────┘
```

## Technical Considerations

### FFT Size and Frequency Resolution

Frequency resolution = sampleRate / fftSize

| FFT Size | Resolution @ 44.1kHz |
|----------|---------------------|
| 2048     | 21.5 Hz             |
| 4096     | 10.8 Hz             |
| 8192     | 5.4 Hz              |

For accurate partial detection, use **4096 or 8192**. The tradeoff is latency — larger FFT requires more samples.

### Parabolic Interpolation

FFT bins are discrete. To find the true peak frequency between bins, fit a parabola to the peak bin and its neighbors:

Given bins at indices k-1, k, k+1 with magnitudes y₁, y₂, y₃:
```
δ = 0.5 × (y₁ - y₃) / (y₁ - 2×y₂ + y₃)
true_bin = k + δ
true_frequency = true_bin × (sampleRate / fftSize)
```

### Partial Detection Reliability

- **Partials 2-4**: Strong amplitude, but small deviation from ideal (low signal-to-noise for B)
- **Partials 5-8**: Moderate amplitude, larger deviation (better for B estimation)
- **Partials 9+**: May be weak or missing, especially on wound strings

Weight the B estimates by partial amplitude and reliability.

### Handling Edge Cases

- **Missing partials**: Some partials may be suppressed by pickup position or playing technique
- **Noise**: Electric guitar with distortion will have unreliable partials
- **Harmonics vs partials**: Ensure you're detecting the actual partial, not noise

## Calibration Flow

For best accuracy, implement a calibration step:

1. Prompt user to play each open string (E2, A2, D3, G3, B3, E4)
2. Measure B coefficient for each string
3. Store calibration data in localStorage or user profile
4. At runtime, use pitch + B to classify

This also captures guitar-specific characteristics (string gauge, scale length, pickup response).

## Expected B Values (Rough Guidelines)

These are approximate and vary by string gauge and guitar:

| String | Note | Typical B Range |
|--------|------|-----------------|
| 6 (Low E) | E2 | 0.0003 - 0.0006 |
| 5 (A) | A2 | 0.0002 - 0.0004 |
| 4 (D) | D3 | 0.00015 - 0.0003 |
| 3 (G) | G3 | 0.0001 - 0.0002 |
| 2 (B) | B3 | 0.00005 - 0.0001 |
| 1 (High E) | E4 | 0.00002 - 0.00006 |

Note: Fretting increases B significantly. Low E fretted at 12th fret may have B > 0.001.

## Integration with Existing Code

The hook should:
1. Accept the same audio context/analyser from `useNoteDetection`
2. Optionally receive pitch data via callback or shared state
3. Run analysis on the same requestAnimationFrame loop or separately

Consider creating a combined hook or a parent hook that orchestrates both pitch detection and string detection.

## Testing the Hook

Create a debug UI that displays:
- Detected fundamental frequency
- Spectrum visualization with marked partials
- Individual B estimates from each partial
- Final B estimate and string classification
- Confidence metrics

This visualization is crucial for debugging and tuning the algorithm.

## References

- Penn State Acoustics: Inharmonicity due to Stiffness — https://www.acs.psu.edu/drussell/Demos/Stiffness-Inharmonicity/Stiffness-B.html
- GS-Detector (Python reference implementation) — https://github.com/mogeadis/GS-Detector
- IEEE: Real-time guitar string detection for music education software — https://ieeexplore.ieee.org/document/6616120/
