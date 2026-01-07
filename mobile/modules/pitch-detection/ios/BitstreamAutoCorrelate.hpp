#ifndef BITSTREAM_AUTO_CORRELATE_H
#define BITSTREAM_AUTO_CORRELATE_H

#include <vector>
#include <cstdint>

namespace pitchdetection {

    /**
     * Detect pitch using Bitstream Autocorrelation (BACF) algorithm.
     *
     * This algorithm converts audio to a 1-bit binary stream and uses
     * XOR operations for fast correlation computation, providing 32-64x
     * speedup over standard autocorrelation.
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
    std::vector<uint64_t> samplesToBitstream(const std::vector<double>& samples);

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
