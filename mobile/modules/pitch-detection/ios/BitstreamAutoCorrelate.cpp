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
        int SIZE = static_cast<int>(buf.size());
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
        while (d < static_cast<int>(correlations.size()) - 1 && correlations[d] >= correlations[d + 1]) {
            d++;
        }

        // Find max after dip
        for (int i = d; i < static_cast<int>(correlations.size()); ++i) {
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
        if (idx < 1 || idx >= static_cast<int>(correlations.size()) - 1) {
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
