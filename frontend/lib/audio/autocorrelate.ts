/**
 * TypeScript implementation of frequency estimation using autocorrelation.
 * Replicates the Python implementation using numpy/scipy.
 */

// =============================================================================
// Correlate function (inlined from correlate.ts)
// =============================================================================

type CorrelateMode = "valid" | "same" | "full" | 0 | 1 | 2

/**
 * Compute the dot product of two arrays with given strides.
 */
function dot(
  arr1: number[],
  start1: number,
  stride1: number,
  arr2: number[],
  start2: number,
  stride2: number,
  n: number,
): number {
  let sum = 0
  let idx1 = start1
  let idx2 = start2

  for (let i = 0; i < n; i++) {
    sum += arr1[idx1] * arr2[idx2]
    idx1 += stride1
    idx2 += stride2
  }

  return sum
}

/**
 * Convert mode string to numeric value.
 */
function modeToNumber(mode: CorrelateMode): number {
  if (typeof mode === "number") {
    if (mode < 0 || mode > 2) {
      throw new Error("mode must be 0, 1, or 2")
    }
    return mode
  }

  switch (mode) {
    case "valid":
      return 0
    case "same":
      return 1
    case "full":
      return 2
    default:
      throw new Error(`Invalid mode: ${mode}`)
  }
}

/**
 * Internal implementation of correlate.
 */
function _correlate(
  ap1: number[],
  ap2: number[],
  mode: number,
): { result: number[]; inverted: boolean } {
  let n1 = ap1.length
  let n2 = ap2.length
  let inverted = false

  if (n1 < n2) {
    ;[ap1, ap2] = [ap2, ap1]
    ;[n1, n2] = [n2, n1]
    inverted = true
  }

  let length = n1
  const n = n2
  let n_left: number
  let n_right: number

  switch (mode) {
    case 0:
      length = length - n + 1
      n_left = 0
      n_right = 0
      break
    case 1:
      n_left = Math.floor(n / 2)
      n_right = n - n_left - 1
      break
    case 2:
      n_right = n - 1
      n_left = n - 1
      length = length + n - 1
      break
    default:
      throw new Error("mode must be 0, 1, or 2")
  }

  const result: number[] = new Array(length).fill(0)
  const is1 = 1
  const is2 = 1
  let ip1 = 0
  let ip2 = n_left
  let currentN = n - n_left
  let opIdx = 0

  for (let i = 0; i < n_left; i++) {
    result[opIdx] = dot(ap1, ip1, is1, ap2, ip2, is2, currentN)
    currentN++
    ip2 -= is2
    opIdx++
  }

  const middleIterations = n1 - n2 + 1
  for (let i = 0; i < middleIterations; i++) {
    result[opIdx] = dot(ap1, ip1, is1, ap2, ip2, is2, currentN)
    ip1 += is1
    opIdx++
  }

  for (let i = 0; i < n_right; i++) {
    currentN--
    result[opIdx] = dot(ap1, ip1, is1, ap2, ip2, is2, currentN)
    ip1 += is1
    opIdx++
  }

  return { result, inverted }
}

/**
 * Cross-correlation of two 1-dimensional arrays.
 */
function correlate(
  a: number[] | Float64Array | Float32Array,
  v: number[] | Float64Array | Float32Array,
  mode: CorrelateMode = "valid",
): number[] {
  const arr1 = Array.from(a)
  const arr2 = Array.from(v)

  if (arr1.length === 0 || arr2.length === 0) {
    throw new Error("Arrays must not be empty")
  }

  const modeNum = modeToNumber(mode)
  const { result, inverted } = _correlate(arr1, arr2, modeNum)

  if (inverted) {
    return result.reverse()
  }

  return result
}

// =============================================================================
// Frequency estimation functions
// =============================================================================

/**
 * Return the indices where the condition is true (like numpy.nonzero on a raveled array).
 *
 * @param condition - Array of boolean values
 * @returns Array of indices where condition is true
 */
export function find(condition: boolean[]): number[] {
  const result: number[] = []
  for (let i = 0; i < condition.length; i++) {
    if (condition[i]) {
      result.push(i)
    }
  }
  return result
}

/**
 * Compute the difference between consecutive elements (like numpy.diff).
 *
 * @param arr - Input array
 * @returns Array of differences: [arr[1]-arr[0], arr[2]-arr[1], ...]
 */
export function diff(arr: number[]): number[] {
  const result: number[] = new Array(arr.length - 1)
  for (let i = 0; i < arr.length - 1; i++) {
    result[i] = arr[i + 1] - arr[i]
  }
  return result
}

/**
 * Compute the mean of an array (like numpy.mean).
 *
 * @param arr - Input array
 * @returns Mean value
 */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
  }
  return sum / arr.length
}

/**
 * Find the index of the maximum value in an array (like numpy.argmax).
 *
 * @param arr - Input array
 * @returns Index of the maximum value
 */
export function argmax(arr: number[]): number {
  if (arr.length === 0) {
    throw new Error("argmax of an empty array")
  }
  let maxIdx = 0
  let maxVal = arr[0]
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) {
      maxVal = arr[i]
      maxIdx = i
    }
  }
  return maxIdx
}

/**
 * Quadratic interpolation for estimating the true position of an
 * inter-sample maximum when nearby samples are known.
 *
 * f is a vector and x is an index for that vector.
 *
 * Returns [vx, vy], the coordinates of the vertex of a parabola that goes
 * through point x and its two neighbors.
 *
 * @param f - Input vector
 * @param x - Index for that vector (must be an integer)
 * @returns [vx, vy] - Coordinates of the parabola vertex
 *
 * @example
 * // Defining a vector f with a local maximum at index 3 (= 6), find local
 * // maximum if points 2, 3, and 4 actually defined a parabola.
 * const f = [2, 3, 1, 6, 4, 2, 3, 1];
 * parabolic(f, argmax(f));
 * // Returns: [3.2142857142857144, 6.1607142857142856]
 */
export function parabolic(f: number[], x: number): [number, number] {
  if (!Number.isInteger(x)) {
    throw new Error("x must be an integer sample index")
  }

  // Boundary check
  if (x <= 0 || x >= f.length - 1) {
    // Can't interpolate at boundaries, return the original point
    return [x, f[x]]
  }

  const denom = f[x - 1] - 2 * f[x] + f[x + 1]

  // Avoid division by zero (happens when the three points are collinear)
  if (Math.abs(denom) < 1e-10) {
    return [x, f[x]]
  }

  const xv = (0.5 * (f[x - 1] - f[x + 1])) / denom + x
  const yv = f[x] - 0.25 * (f[x - 1] - f[x + 1]) * (xv - x)

  return [xv, yv]
}

/**
 * Estimate frequency using autocorrelation.
 *
 * Pros: Best method for finding the true fundamental of any repeating wave,
 * even with strong harmonics or completely missing fundamental.
 *
 * Cons: Not as accurate, doesn't find fundamental for inharmonic things like
 * musical instruments, this implementation has trouble with finding the true
 * peak.
 *
 * @param signal - Input signal array
 * @param fs - Sample rate in Hz
 * @returns Estimated frequency in Hz
 *
 * @example
 * // Generate a 440 Hz sine wave at 44100 Hz sample rate
 * const fs = 44100;
 * const freq = 440;
 * const t = Array.from({length: 4096}, (_, i) => i / fs);
 * const signal = t.map(t => Math.sin(2 * Math.PI * freq * t));
 *
 * const estimatedFreq = freqFromAutocorr(signal, fs);
 * // Should be approximately 440 Hz
 */
export function freqFromAutocorr(
  signal: number[] | Float64Array | Float32Array,
  fs: number,
): number {
  // Convert to array and ensure it's a copy with floating point values
  let sig = Array.from(signal).map((x) => x + 0.0)

  // Remove DC offset (subtract mean)
  const sigMean = mean(sig)
  sig = sig.map((x) => x - sigMean)

  // Calculate autocorrelation using full mode
  const corr = correlate(sig, sig, "full")

  // Throw away the negative lags (keep from midpoint onwards)
  const corrPositive = corr.slice(Math.floor(corr.length / 2))

  // Find the first valley in the autocorrelation
  // d = diff(corr) gives us the slope
  const d = diff(corrPositive)

  // Find where the slope becomes positive (first valley)
  const positiveSlope = d.map((x) => x > 0)
  const valleys = find(positiveSlope)

  if (valleys.length === 0) {
    throw new Error(
      "Could not find valley in autocorrelation - signal may be too short or not periodic",
    )
  }

  const start = valleys[0]

  // Find the next peak after the low point (other than 0 lag)
  // This bit is not reliable for long signals, due to the desired peak
  // occurring between samples, and other peaks appearing higher.
  const corrFromStart = corrPositive.slice(start)
  const i_peak = argmax(corrFromStart) + start

  // Use parabolic interpolation to get a more accurate peak position
  const [i_interp] = parabolic(corrPositive, i_peak)

  // Frequency = sample_rate / period
  return fs / i_interp
}

// Default export
export default freqFromAutocorr
