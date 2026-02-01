#!/usr/bin/env python

from numpy import argmax, asarray, copy, diff, log, mean
from numpy.fft import rfft
from scipy.signal import correlate, decimate
from scipy.signal.windows import kaiser
import numpy as np

def find(condition):
    "Return the indices where ravel(condition) is true"
    res, = np.nonzero(np.ravel(condition))
    return res

def parabolic(f, x):
    """
    Quadratic interpolation for estimating the true position of an
    inter-sample maximum when nearby samples are known.

    f is a vector and x is an index for that vector.

    Returns (vx, vy), the coordinates of the vertex of a parabola that goes
    through point x and its two neighbors.

    Example:
    Defining a vector f with a local maximum at index 3 (= 6), find local
    maximum if points 2, 3, and 4 actually defined a parabola.

    In [3]: f = [2, 3, 1, 6, 4, 2, 3, 1]

    In [4]: parabolic(f, argmax(f))
    Out[4]: (3.2142857142857144, 6.1607142857142856)
    """
    if int(x) != x:
        raise ValueError('x must be an integer sample index')
    else:
        x = int(x)
    xv = 1/2. * (f[x-1] - f[x+1]) / (f[x-1] - 2 * f[x] + f[x+1]) + x
    yv = f[x] - 1/4. * (f[x-1] - f[x+1]) * (xv - x)
    return (xv, yv)


def freq_from_autocorr(signal, fs):
    """
    Estimate frequency using autocorrelation

    Pros: Best method for finding the true fundamental of any repeating wave,
    even with strong harmonics or completely missing fundamental

    Cons: Not as accurate, doesn't find fundamental for inharmonic things like
    musical instruments, this implementation has trouble with finding the true
    peak
    """
    signal = asarray(signal) + 0.0

    # Calculate autocorrelation, and throw away the negative lags
    signal -= mean(signal)  # Remove DC offset
    corr = correlate(signal, signal, mode='full')
    corr = corr[len(corr)//2:]

    # Find the first valley in the autocorrelation
    d = diff(corr)
    start = find(d > 0)[0]

    # Find the next peak after the low point (other than 0 lag).  This bit is
    # not reliable for long signals, due to the desired peak occurring between
    # samples, and other peaks appearing higher.
    i_peak = argmax(corr[start:]) + start
    i_interp = parabolic(corr, i_peak)[0]

    return fs / i_interp


def freq_from_hps(signal, fs):
    """
    Estimate frequency using harmonic product spectrum

    Low frequency noise piles up and overwhelms the desired peaks

    Doesn't work well if signal doesn't have harmonics
    """
    signal = asarray(signal) + 0.0

    N = len(signal)
    signal -= mean(signal)  # Remove DC offset

    # Compute Fourier transform of windowed signal
    windowed = signal * kaiser(N, 100)

    # Get spectrum
    X = log(abs(rfft(windowed)))

    # Remove mean of spectrum (so sum is not increasingly offset
    # only in overlap region)
    X -= mean(X)

    # Downsample sum logs of spectra instead of multiplying
    hps = copy(X)
    for h in range(2, 9):  # TODO: choose a smarter upper limit
        dec = decimate(X, h, zero_phase=True)
        hps[:len(dec)] += dec

    # Find the peak and interpolate to get a more accurate peak
    i_peak = argmax(hps[:len(dec)])
    i_interp = parabolic(hps, i_peak)[0]

    # Convert to equivalent frequency
    return fs * i_interp / N  # Hz


if __name__ == '__main__':
    import pytest
    pytest.main(['../tests/test_freq_estimation.py', "--capture=sys"])