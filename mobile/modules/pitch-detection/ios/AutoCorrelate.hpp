#ifndef AUTO_CORRELATE_H
#define AUTO_CORRELATE_H

#ifdef __cplusplus
#include <vector>

namespace pitchdetection {
    /**
     * Detect pitch using autocorrelation algorithm.
     *
     * @param buf Audio buffer samples
     * @param sampleRate Sample rate in Hz
     * @param minVolume Minimum volume in decibels to trigger detection
     * @return Detected frequency in Hz, or -1 if no pitch detected
     */
    double autoCorrelate(const std::vector<double> &buf, double sampleRate, double minVolume);

    /**
     * Calculate volume in decibels from RMS value.
     */
    double getVolumeDecibel(double rms);
}
#endif // __cplusplus

#endif
