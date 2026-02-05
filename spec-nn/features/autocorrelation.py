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