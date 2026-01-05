// Based on react-native-live-pitch-detection by techoptio
// https://github.com/techoptio/react-native-live-pitch-detection

#include "AutoCorrelate.hpp"

#include <vector>
#include <cmath>
#include <algorithm>
#include <numeric>
#include <limits>

namespace pitchdetection {
    double getVolumeDecibel(double rms) {
        return 20 * std::log10(rms);
    }

    double autoCorrelate(const std::vector<double> &buf, double sampleRate, double minVolume) {
        int SIZE = buf.size();
        double rms = 0;

        // Calculate RMS
        for (int i = 0; i < SIZE; ++i) {
            double val = buf[i];
            rms += val * val;
        }
        rms = std::sqrt(rms / SIZE);

        // Check minimum volume threshold
        double decibel = getVolumeDecibel(rms);
        if (decibel < minVolume) {
            return -1;
        }

        // Trim silence from beginning and end
        int r1 = 0, r2 = SIZE - 1;
        double thres = 0.2;

        for (int i = 0; i < SIZE / 2; ++i) {
            if (std::abs(buf[i]) < thres) {
                r1 = i;
                break;
            }
        }

        for (int i = 1; i < SIZE / 2; ++i) {
            if (std::abs(buf[SIZE - i]) < thres) {
                r2 = SIZE - i;
                break;
            }
        }

        // Create sliced buffer
        std::vector<double> slicedBuf(buf.begin() + r1, buf.begin() + r2);
        SIZE = slicedBuf.size();

        if (SIZE < 2) {
            return -1;
        }

        // Autocorrelation
        std::vector<double> c(SIZE, 0);
        for (int i = 0; i < SIZE; ++i) {
            for (int j = 0; j < SIZE - i; ++j) {
                c[i] += slicedBuf[j] * slicedBuf[j + i];
            }
        }

        // Find first dip
        int d = 0;
        while (d < SIZE - 1 && c[d] > c[d + 1]) {
            d++;
        }

        // Find maximum after the dip
        double maxval = -1, maxpos = -1;
        for (int i = d; i < SIZE; ++i) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }

        if (maxpos < 1 || maxpos >= SIZE - 1) {
            return -1;
        }

        double T0 = maxpos;

        // Parabolic interpolation for better precision
        double x1 = c[(int)T0 - 1], x2 = c[(int)T0], x3 = c[(int)T0 + 1];
        double a = (x1 + x3 - 2 * x2) / 2;
        double b = (x3 - x1) / 2;

        if (a != 0) {
            T0 = T0 - b / (2 * a);
        }

        if (T0 <= 0) {
            return -1;
        }

        return sampleRate / T0;
    }
}
