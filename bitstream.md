# Bitstream Autocorrelation (BACF) Implementation Outline

This document outlines the implementation of Bitstream Autocorrelation (BACF) as an alternative pitch detection algorithm for the guitar app. The goal is to achieve lower latency (~30-35ms) while maintaining accuracy for frequencies down to 82Hz (low E string).

## Overview

### What is Bitstream Autocorrelation?

Bitstream Autocorrelation (BACF) is a pitch detection algorithm that converts audio samples to a 1-bit binary stream (zero-crossing representation) and uses XOR operations instead of floating-point multiplication. This provides:

- **32-64x speedup** over standard autocorrelation (processes 64 bits per XOR on 64-bit systems)
- **Pitch detection within 2 cycles** with high accuracy
- **Simpler computation** - no floating-point multiplication, only XOR and popcount operations

### References

- [Cycfi Research - Bitstream Autocorrelation](https://www.cycfi.com/2018/03/fast-and-efficient-pitch-detection-bitstream-autocorrelation/)
- [Q DSP Library](https://github.com/cycfi/Q) - Production-ready C++ implementation
- [Python Proof of Concept](https://github.com/cycfi/bitstream_autocorrelation/blob/master/bcf.py)

---

## Current Module Structure

The existing pitch detection module is located at `mobile/modules/pitch-detection/` with this structure:

```
mobile/modules/pitch-detection/
├── package.json                           # NPM package config
├── expo-module.config.json                # Expo module config
├── index.ts                               # Module entry point
├── src/
│   └── PitchDetectionModule.ts            # TypeScript interface definitions
├── shared/
│   ├── AutoCorrelate.hpp                  # C++ header (shared)
│   └── AutoCorrelate.cpp                  # C++ implementation (shared)
├── ios/
│   ├── PitchDetection.podspec             # CocoaPods spec
│   ├── PitchDetectionModule.swift         # Swift module (audio capture + event emission)
│   ├── AutoCorrelate.h                    # Objective-C bridge header
│   ├── AutoCorrelate.mm                   # Objective-C++ wrapper (calls C++)
│   ├── AutoCorrelate.hpp                  # C++ header (iOS copy)
│   └── AutoCorrelate.cpp                  # C++ implementation (iOS copy)
└── android/
    ├── build.gradle                       # Android build config
    ├── src/main/
    │   ├── AndroidManifest.xml
    │   ├── java/expo/modules/pitchdetection/
    │   │   └── PitchDetectionModule.kt    # Kotlin module (audio capture + event emission)
    │   └── jni/
    │       ├── CMakeLists.txt             # CMake build config
    │       └── cpp-adapter.cpp            # JNI bridge to C++
```

---

## Implementation Plan

### Phase 1: Core C++ Algorithm

#### 1.1 Create `shared/BitstreamAutoCorrelate.hpp`

```cpp
#ifndef BITSTREAM_AUTO_CORRELATE_H
#define BITSTREAM_AUTO_CORRELATE_H

#include <vector>
#include <cstdint>

namespace pitchdetection {

    /**
     * Detect pitch using Bitstream Autocorrelation (BACF) algorithm.
     *
     * This algorithm converts audio to a 1-bit binary stream and uses
     * XOR operations for fast correlation computation.
     *
     * @param buf Audio buffer samples (normalized -1.0 to 1.0)
     * @param sampleRate Sample rate in Hz
     * @param minVolume Minimum volume in decibels to trigger detection
     * @param minFreq Minimum frequency to detect (default 80 Hz for guitar low E)
     * @param maxFreq Maximum frequency to detect (default 1200 Hz for guitar high E + harmonics)
     * @return Detected frequency in Hz, or -1 if no pitch detected
     */
    double bitstreamAutoCorrelate(
        const std::vector<double>& buf,
        double sampleRate,
        double minVolume,
        double minFreq = 80.0,
        double maxFreq = 1200.0
    );

    /**
     * Calculate volume in decibels from RMS value.
     */
    double getVolumeDecibelBACF(double rms);

    /**
     * Convert audio samples to bitstream (zero-crossing representation).
     * Each bit represents whether a sample is >= 0.
     *
     * @param samples Input audio samples
     * @return Vector of 64-bit integers representing the bitstream
     */
    std::vector<uint64_t> samplesTobitstream(const std::vector<double>& samples);

    /**
     * Compute bitstream autocorrelation using XOR and popcount.
     *
     * @param bitstream The binary representation of the audio
     * @param numSamples Original number of samples
     * @param lag The lag (shift) to compute correlation for
     * @return Correlation value (higher = more correlated)
     */
    int computeBitstreamCorrelation(
        const std::vector<uint64_t>& bitstream,
        int numSamples,
        int lag
    );

}

#endif
```

#### 1.2 Create `shared/BitstreamAutoCorrelate.cpp`

```cpp
#include "BitstreamAutoCorrelate.hpp"
#include <cmath>
#include <algorithm>
#include <numeric>

// Use compiler intrinsics for popcount
#if defined(_MSC_VER)
    #include <intrin.h>
    #define POPCOUNT64(x) __popcnt64(x)
#elif defined(__GNUC__) || defined(__clang__)
    #define POPCOUNT64(x) __builtin_popcountll(x)
#else
    // Fallback implementation
    inline int popcount64_fallback(uint64_t x) {
        x = x - ((x >> 1) & 0x5555555555555555ULL);
        x = (x & 0x3333333333333333ULL) + ((x >> 2) & 0x3333333333333333ULL);
        x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0FULL;
        return (x * 0x0101010101010101ULL) >> 56;
    }
    #define POPCOUNT64(x) popcount64_fallback(x)
#endif

namespace pitchdetection {

    double getVolumeDecibelBACF(double rms) {
        if (rms <= 0) return -100.0;
        return 20.0 * std::log10(rms);
    }

    std::vector<uint64_t> samplesToBitstream(const std::vector<double>& samples) {
        size_t numSamples = samples.size();
        size_t numWords = (numSamples + 63) / 64;  // Round up to nearest 64 bits
        std::vector<uint64_t> bitstream(numWords, 0);

        for (size_t i = 0; i < numSamples; ++i) {
            if (samples[i] >= 0) {
                size_t wordIndex = i / 64;
                size_t bitIndex = i % 64;
                bitstream[wordIndex] |= (1ULL << bitIndex);
            }
        }

        return bitstream;
    }

    int computeBitstreamCorrelation(
        const std::vector<uint64_t>& bitstream,
        int numSamples,
        int lag
    ) {
        // XOR counts mismatches, so we want MINIMUM XOR result for best correlation
        // But we return match count (numSamples - lag - mismatchCount) for consistency

        int mismatchCount = 0;
        int samplesToCompare = numSamples - lag;

        // Process full 64-bit words
        int startBit = 0;
        int endBit = samplesToCompare;

        for (int bit = startBit; bit < endBit; ) {
            int wordIdx1 = bit / 64;
            int bitInWord1 = bit % 64;
            int laggedBit = bit + lag;
            int wordIdx2 = laggedBit / 64;
            int bitInWord2 = laggedBit % 64;

            // If both positions are aligned to word boundaries, use fast path
            if (bitInWord1 == 0 && bitInWord2 == 0 && (endBit - bit) >= 64) {
                uint64_t xorResult = bitstream[wordIdx1] ^ bitstream[wordIdx2];
                mismatchCount += POPCOUNT64(xorResult);
                bit += 64;
            } else {
                // Slow path for unaligned bits
                uint64_t bit1 = (bitstream[wordIdx1] >> bitInWord1) & 1;
                uint64_t bit2 = (bitstream[wordIdx2] >> bitInWord2) & 1;
                mismatchCount += (bit1 ^ bit2);
                bit += 1;
            }
        }

        return samplesToCompare - mismatchCount;  // Return match count
    }

    double bitstreamAutoCorrelate(
        const std::vector<double>& buf,
        double sampleRate,
        double minVolume,
        double minFreq,
        double maxFreq
    ) {
        int SIZE = buf.size();
        if (SIZE < 64) return -1;  // Need minimum samples

        // Calculate RMS for volume threshold
        double rms = 0;
        for (int i = 0; i < SIZE; ++i) {
            rms += buf[i] * buf[i];
        }
        rms = std::sqrt(rms / SIZE);

        // Check minimum volume threshold
        double decibel = getVolumeDecibelBACF(rms);
        if (decibel < minVolume) {
            return -1;
        }

        // Convert to bitstream
        std::vector<uint64_t> bitstream = samplesToBitstream(buf);

        // Calculate lag range from frequency range
        // lag = sampleRate / frequency
        int minLag = static_cast<int>(sampleRate / maxFreq);  // Higher freq = shorter period
        int maxLag = static_cast<int>(sampleRate / minFreq);  // Lower freq = longer period

        // Ensure we don't exceed buffer bounds
        maxLag = std::min(maxLag, SIZE / 2);
        minLag = std::max(minLag, 1);

        if (minLag >= maxLag) return -1;

        // Find the peak in autocorrelation
        // Strategy: Find first significant peak after initial decline

        std::vector<int> correlations(maxLag - minLag + 1);
        for (int lag = minLag; lag <= maxLag; ++lag) {
            correlations[lag - minLag] = computeBitstreamCorrelation(bitstream, SIZE, lag);
        }

        // Normalize correlations (optional, for peak detection)
        int maxCorr = *std::max_element(correlations.begin(), correlations.end());
        if (maxCorr == 0) return -1;

        // Find first significant peak
        // Look for: decline from start, then rise to peak, then decline
        int bestLag = -1;
        int bestCorr = 0;

        // Simple peak detection: find maximum after first dip
        int d = 0;
        while (d < (int)correlations.size() - 1 && correlations[d] >= correlations[d + 1]) {
            d++;
        }

        // Find max after dip
        for (int i = d; i < (int)correlations.size(); ++i) {
            if (correlations[i] > bestCorr) {
                bestCorr = correlations[i];
                bestLag = minLag + i;
            }
        }

        if (bestLag < 1 || bestLag >= SIZE - 1) {
            return -1;
        }

        // Parabolic interpolation for sub-sample precision
        // Use the integer correlation values around the peak
        int idx = bestLag - minLag;
        if (idx < 1 || idx >= (int)correlations.size() - 1) {
            return sampleRate / bestLag;
        }

        double y1 = correlations[idx - 1];
        double y2 = correlations[idx];
        double y3 = correlations[idx + 1];

        double a = (y1 + y3 - 2 * y2) / 2;
        double b = (y3 - y1) / 2;

        double refinedLag = bestLag;
        if (a != 0) {
            refinedLag = bestLag - b / (2 * a);
        }

        if (refinedLag <= 0) return -1;

        return sampleRate / refinedLag;
    }

}
```

#### 1.3 Algorithm Optimizations to Consider

1. **Word-aligned processing**: Pre-compute shifted bitstreams for common lag values to enable fully aligned XOR operations

2. **SIMD acceleration**: Use AVX2/NEON intrinsics for processing multiple 64-bit words simultaneously

3. **Hybrid approach**: Use BACF for initial coarse frequency estimate, then refine with a small window of standard autocorrelation

4. **Zero-crossing hysteresis**: Add small hysteresis threshold to prevent noise from causing spurious bit flips:
   ```cpp
   // Instead of: if (samples[i] >= 0)
   // Use: if (samples[i] >= hysteresis || (lastBit == 1 && samples[i] >= -hysteresis))
   ```

---

### Phase 2: iOS Integration

#### 2.1 Create `ios/BitstreamAutoCorrelate.h` (Objective-C Bridge Header)

```objc
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface BitstreamAutoCorrelate : NSObject

/**
 * Detect pitch using Bitstream Autocorrelation algorithm.
 * @param buffer Audio buffer samples as float array
 * @param bufferSize Number of samples in buffer
 * @param sampleRate Sample rate in Hz
 * @param minVolume Minimum volume in decibels to trigger detection
 * @return Detected frequency in Hz, or -1 if no pitch detected
 */
+ (double)detectPitchFromBuffer:(const float *)buffer
                     bufferSize:(int)bufferSize
                     sampleRate:(double)sampleRate
                      minVolume:(double)minVolume;

@end

NS_ASSUME_NONNULL_END
```

#### 2.2 Create `ios/BitstreamAutoCorrelate.mm` (Objective-C++ Wrapper)

```objc
#import "BitstreamAutoCorrelate.h"
#import "BitstreamAutoCorrelate.hpp"
#include <vector>

@implementation BitstreamAutoCorrelate

+ (double)detectPitchFromBuffer:(const float *)buffer
                     bufferSize:(int)bufferSize
                     sampleRate:(double)sampleRate
                      minVolume:(double)minVolume {
    // Convert float buffer to double vector
    std::vector<double> buf(bufferSize);
    for (int i = 0; i < bufferSize; ++i) {
        buf[i] = static_cast<double>(buffer[i]);
    }

    return pitchdetection::bitstreamAutoCorrelate(buf, sampleRate, minVolume);
}

@end
```

#### 2.3 Copy Header to iOS Directory

Copy `shared/BitstreamAutoCorrelate.hpp` to `ios/BitstreamAutoCorrelate.hpp` (same pattern as existing AutoCorrelate files).

#### 2.4 Update `ios/PitchDetectionModule.swift`

Option A: **Replace** the existing algorithm:
```swift
// Change line 117-122 from:
let frequency = AutoCorrelate.detectPitch(
    fromBuffer: channelData[0],
    bufferSize: frameLength,
    sampleRate: currentSampleRate,
    minVolume: minVolume
)

// To:
let frequency = BitstreamAutoCorrelate.detectPitch(
    fromBuffer: channelData[0],
    bufferSize: frameLength,
    sampleRate: currentSampleRate,
    minVolume: minVolume
)
```

Option B: **Add algorithm selection** (recommended for A/B testing):
```swift
// Add enum and property
enum PitchAlgorithm: Int {
    case autocorrelation = 0
    case bitstreamAutocorrelation = 1
}
private var algorithm: PitchAlgorithm = .bitstreamAutocorrelation

// Add function to set algorithm
Function("setAlgorithm") { (algorithmType: Int) in
    self.algorithm = PitchAlgorithm(rawValue: algorithmType) ?? .bitstreamAutocorrelation
}

// In detectPitch method:
let frequency: Double
switch algorithm {
case .autocorrelation:
    frequency = AutoCorrelate.detectPitch(...)
case .bitstreamAutocorrelation:
    frequency = BitstreamAutoCorrelate.detectPitch(...)
}
```

#### 2.5 Update `ios/PitchDetection.podspec`

The existing podspec already includes `**/*.{h,m,mm,swift,hpp,cpp}` so new files will be automatically included. No changes needed.

---

### Phase 3: Android Integration

#### 3.1 Update `android/src/main/jni/CMakeLists.txt`

```cmake
cmake_minimum_required(VERSION 3.4.1)
project(PitchDetection)

set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 14)

add_library(pitchdetection SHARED
    ../../../../shared/AutoCorrelate.cpp
    ../../../../shared/BitstreamAutoCorrelate.cpp  # Add this line
    cpp-adapter.cpp
)

include_directories(
    ../../../../shared
)
```

#### 3.2 Update `android/src/main/jni/cpp-adapter.cpp`

Add new JNI function:

```cpp
#include <jni.h>
#include "AutoCorrelate.hpp"
#include "BitstreamAutoCorrelate.hpp"  // Add this include
#include <vector>

// Existing function remains unchanged
extern "C" JNIEXPORT jdouble JNICALL
Java_expo_modules_pitchdetection_PitchDetectionModule_nativeAutoCorrelate(
    JNIEnv *env,
    jobject thiz,
    jshortArray buffer,
    jint sampleRate,
    jdouble minVolume
) {
    // ... existing implementation ...
}

// Add new function for BACF
extern "C" JNIEXPORT jdouble JNICALL
Java_expo_modules_pitchdetection_PitchDetectionModule_nativeBitstreamAutoCorrelate(
    JNIEnv *env,
    jobject thiz,
    jshortArray buffer,
    jint sampleRate,
    jdouble minVolume
) {
    jshort *buf = env->GetShortArrayElements(buffer, nullptr);
    jsize size = env->GetArrayLength(buffer);

    // Convert short buffer to double vector (normalize to -1.0 to 1.0 range)
    std::vector<double> vec(size);
    for (int i = 0; i < size; ++i) {
        vec[i] = static_cast<double>(buf[i]) / 32768.0;
    }

    env->ReleaseShortArrayElements(buffer, buf, 0);

    return pitchdetection::bitstreamAutoCorrelate(
        vec,
        static_cast<double>(sampleRate),
        minVolume
    );
}
```

#### 3.3 Update `android/src/main/java/expo/modules/pitchdetection/PitchDetectionModule.kt`

```kotlin
// Add new external function declaration (around line 28)
private external fun nativeBitstreamAutoCorrelate(
    buffer: ShortArray,
    sampleRate: Int,
    minVolume: Double
): Double

// Add algorithm selection property
private var useBitstreamAlgorithm = true  // Default to new algorithm

// Add function to module definition (inside definition() block)
Function("setAlgorithm") { algorithmType: Int ->
    useBitstreamAlgorithm = algorithmType == 1
}

// Update the pitch detection call in the recording thread (around line 86)
val frequency = if (useBitstreamAlgorithm) {
    nativeBitstreamAutoCorrelate(buffer.copyOf(read), sampleRate, minVolume)
} else {
    nativeAutoCorrelate(buffer.copyOf(read), sampleRate, minVolume)
}
```

---

### Phase 4: TypeScript Interface Updates

#### 4.1 Update `src/PitchDetectionModule.ts`

```typescript
import { NativeModule, requireNativeModule } from "expo"

export type PitchDetectionModuleEvents = {
  onPitchDetected: (params: PitchEvent) => void
}

export type PitchEvent = {
  frequency: number
}

export enum PitchAlgorithm {
  Autocorrelation = 0,
  BitstreamAutocorrelation = 1,
}

export type PitchDetectionOptions = {
  /** Buffer size for audio capture. Default: 4096 */
  bufferSize?: number
  /** Minimum volume in decibels to trigger detection. Default: -20.0 */
  minVolume?: number
  /** Update interval in milliseconds. Default: 100 */
  updateIntervalMs?: number
  /** Pitch detection algorithm. Default: BitstreamAutocorrelation */
  algorithm?: PitchAlgorithm
}

declare class PitchDetectionModule extends NativeModule<PitchDetectionModuleEvents> {
  /**
   * Configure detection options before starting
   */
  setOptions(bufferSize: number, minVolume: number, updateIntervalMs: number): void

  /**
   * Set the pitch detection algorithm
   * @param algorithm 0 = Autocorrelation, 1 = BitstreamAutocorrelation
   */
  setAlgorithm(algorithm: number): void

  /**
   * Start listening for pitch
   */
  startListening(): Promise<void>

  /**
   * Stop listening
   */
  stopListening(): Promise<void>

  /**
   * Check if currently listening
   */
  isListening(): boolean

  /**
   * Get the current sample rate
   */
  getSampleRate(): number
}

export default requireNativeModule<PitchDetectionModule>("PitchDetection")
```

---

### Phase 5: Testing & Validation

#### 5.1 Unit Tests for C++ Algorithm

Create `shared/BitstreamAutoCorrelate.test.cpp` (or integrate with existing test framework):

```cpp
// Test cases to implement:

// 1. Pure sine wave detection at various frequencies
void testSineWave82Hz();   // Low E
void testSineWave110Hz();  // A2
void testSineWave220Hz();  // A3
void testSineWave440Hz();  // A4
void testSineWave880Hz();  // A5

// 2. Volume threshold
void testBelowVolumeThreshold();
void testAtVolumeThreshold();

// 3. Edge cases
void testEmptyBuffer();
void testTinyBuffer();
void testSilence();

// 4. Accuracy comparison with existing autocorrelation
void compareWithStandardAutocorrelation();
```

#### 5.2 Integration Tests

Test on actual device with:
- All 6 open guitar strings (E2=82Hz, A2=110Hz, D3=147Hz, G3=196Hz, B3=247Hz, E4=330Hz)
- Fretted notes across the range
- Different playing dynamics (soft to loud)
- Different buffer sizes (1024, 1536, 2048)
- Different polling rates (30ms, 50ms, 100ms)

#### 5.3 Performance Benchmarks

Measure and compare:
- CPU usage (standard AC vs BACF)
- Latency (time from note onset to detection)
- Accuracy (cents deviation from true pitch)
- Detection rate (% of frames with valid pitch)

---

## File Checklist

### New Files to Create

- [ ] `shared/BitstreamAutoCorrelate.hpp`
- [ ] `shared/BitstreamAutoCorrelate.cpp`
- [ ] `ios/BitstreamAutoCorrelate.hpp` (copy of shared)
- [ ] `ios/BitstreamAutoCorrelate.h`
- [ ] `ios/BitstreamAutoCorrelate.mm`

### Files to Modify

- [ ] `ios/PitchDetectionModule.swift` - Add algorithm selection and BACF call
- [ ] `android/src/main/jni/CMakeLists.txt` - Add BitstreamAutoCorrelate.cpp
- [ ] `android/src/main/jni/cpp-adapter.cpp` - Add JNI bridge function
- [ ] `android/src/main/java/.../PitchDetectionModule.kt` - Add algorithm selection
- [ ] `src/PitchDetectionModule.ts` - Add TypeScript interface

### Files That Need No Changes

- `package.json`
- `expo-module.config.json`
- `index.ts`
- `ios/PitchDetection.podspec` (wildcard already covers new files)
- `android/build.gradle`
- `android/src/main/AndroidManifest.xml`

---

## Recommended Buffer Size Settings

Based on the algorithm's ability to detect pitch within 2 cycles:

| Target Frequency | Min Samples (2 cycles) | Recommended Buffer | Polling Rate |
|------------------|------------------------|-------------------|--------------|
| 82 Hz (low E)    | 1076 @ 44.1kHz        | 1536              | 35ms         |
| 110 Hz (A2)      | 802 @ 44.1kHz         | 1024              | 23ms         |
| 220 Hz (A3)      | 401 @ 44.1kHz         | 512               | 12ms         |

For guitar apps targeting all 6 strings, use **1536 samples** with **35ms polling** as a good balance.

---

## Potential Improvements (Future Work)

1. **Adaptive buffer sizing**: Automatically adjust buffer size based on detected frequency range
2. **Confidence score**: Return a confidence value alongside frequency
3. **Noise floor estimation**: Dynamically adjust minVolume based on ambient noise
4. **Multi-pitch detection**: Detect multiple simultaneous notes (for chords)
5. **Note onset detection**: Detect when a new note starts (transient detection)

---

## Troubleshooting

### Common Issues

1. **Octave errors (detecting 2x or 0.5x frequency)**
   - Adjust peak detection to find first significant peak, not global maximum
   - Add harmonic validation

2. **Noise causing false detections**
   - Increase minVolume threshold
   - Add hysteresis to zero-crossing detection

3. **Poor accuracy at low frequencies**
   - Ensure buffer is large enough (at least 2 periods)
   - Verify parabolic interpolation is working

4. **Build errors on Android**
   - Ensure CMakeLists.txt path is correct
   - Check that `__builtin_popcountll` is available (should be on all modern compilers)

5. **Build errors on iOS**
   - Ensure .hpp files are listed in private_header_files in podspec
   - Run `pod install` after adding new files
