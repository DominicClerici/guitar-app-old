# Guitar Sound Realism Improvements

## Current Implementation Analysis

**Current setup:**
- Sampler-based playback using Tone.js Sampler
- Signal chain: Sampler ’ Reverb (Freeverb) ’ Compressor ’ Limiter ’ Master Gain ’ Destination
- Strum simulation with 20ms delay between strings and velocity gradients
- Per-string note tracking for proper release behavior
- Sample coverage: ~37 samples for acoustic, ~17 for electric, ~27 for nylon

---

## Improvement Recommendations

### 1. Strum Timing Improvements

**Current issue:** Fixed 20ms strum delay is unrealistic
```typescript
const strumDelay = 0.02 // Fixed value
```

**Improvements:**
- **Variable strum speed**: Real strums vary from 15-60ms total depending on tempo/intensity
- **Non-linear timing**: First and last strings take slightly longer (acceleration/deceleration)
- **Tempo-aware strumming**: Faster BPM should have faster strums
- **Random micro-variations**: Add ±2-5ms jitter per string for human feel

---

### 2. Velocity & Dynamics

**Current issue:** Predictable velocity patterns
```typescript
const downVelocities = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25]
```

**Improvements:**
- **Add randomization**: ±5-10% velocity variation per note
- **String-specific curves**: Bass strings naturally have different attack characteristics
- **Accent patterns**: First beat strums should be louder than offbeats
- **Pick attack variation**: Different attack curves for different playing styles

---

### 3. Sympathetic String Resonance

**Missing feature:** When you play a note, nearby strings vibrate sympathetically

**Implementation ideas:**
- When playing a note, trigger very quiet (5-10% velocity) notes on harmonically related open strings
- Apply a slight detuning effect to sympathetic notes
- This is especially noticeable on acoustic guitars

---

### 4. String Muting & Palm Muting

**Current:** Binary mute (all or nothing with `muteOnNewStrum`)

**Improvements:**
- **Gradual release envelope**: Use `releaseAll()` with a fade rather than instant cutoff
- **Palm mute effect**: Add a lowpass filter + shorter decay option
- **Fret buzz simulation**: Very low velocity notes should have slight buzz
- **Left-hand muting**: When lifting fingers, add brief "chuk" sound

---

### 5. Better Reverb Configuration

**Current:** Using Freeverb (algorithmic)

**Improvements:**
- **Use Convolver reverb**: `Tone.Convolver` with real room/studio impulse responses sounds far more natural
- **Add pre-delay**: Small delay before reverb for clarity
- **Consider separate reverbs**: Short early reflections + longer tail
- **Add subtle room EQ**: Cut low frequencies from reverb

---

### 6. Body Resonance Simulation

**Missing:** Guitar body resonates and colors the sound

**Implementation:**
- Add an EQ or filter that boosts frequencies around 80-120Hz (acoustic body resonance)
- Add subtle peak around 2-4kHz for string brightness
- Use `Tone.EQ3` or `Tone.Filter` to shape the tone

---

### 7. Humanization / Timing Variations

**Current:** Notes are perfectly timed

**Improvements:**
- Add ±5-15ms random timing offset to each note
- Slightly detune notes (±2-5 cents) for more organic feel
- Vary attack time slightly between notes
- The Sampler has `attack` and `release` parameters you could randomize

---

### 8. Multiple Velocity Layers (Round Robins)

**Current:** Single sample per note, velocity just changes volume

**Significant improvement:**
- Record each note at 3-4 velocity levels (pp, mp, mf, ff)
- Use different samples based on velocity input
- This prevents the "machine gun effect" of identical samples
- Tone.js Sampler doesn't natively support this, but you could:
  - Create multiple samplers for different velocities
  - Crossfade between them based on velocity

---

### 9. Pick Position Simulation

**Missing:** Where you pick on the string changes tone dramatically

**Implementation:**
- Near bridge: brighter (boost high frequencies)
- Near neck: warmer (cut highs, boost mids)
- Add a "pick position" parameter that adjusts EQ
- Could use `Tone.Filter` or `Tone.EQ3`

---

### 10. Release Characteristics

**Current:** Using fixed duration `"4"` for notes
```typescript
instrument.triggerAttackRelease(freq, "4", start + i * strumDelay, velocity)
```

**Improvements:**
- **Velocity-dependent decay**: Louder notes ring longer
- **Frequency-dependent decay**: Low notes sustain longer than high notes
- **String-dependent decay**: Bass strings have longer natural decay
- **Add release noise**: Finger lifting off strings creates subtle noise

---

### 11. Slide & Hammer-on/Pull-off Effects

**For future features:**
- Use `Tone.Sampler.triggerAttack` with pitch bending for slides
- Hammer-ons should have softer attack and different timbre
- `Tone.PitchShift` could help with real-time pitch slides

---

### 12. Cabinet/Amp Simulation (Electric Guitar)

**For electric guitar realism:**
- Add cabinet impulse response convolution
- Add subtle tube saturation: `Tone.Distortion` with very low settings
- Consider `Tone.Chebyshev` for tube-like harmonics

---

### 13. Chorus/Doubling Effect

**For richness:**
- Very subtle chorus (1-3% wet) adds natural width
- Simulates slight intonation differences between strings
- `Tone.Chorus` with low depth and slow rate

---

### 14. Sample Quality Improvements

**Current samples:** Tonejs-instruments samples (decent quality)

**Consider:**
- Higher sample density (every semitone vs every 2-3 semitones)
- Multiple round-robin samples per note
- Longer samples with natural decay
- Samples recorded with different articulations (picked, fingered, muted)

---

### 15. Attack Envelope Shaping

**Add attack variation:**
```typescript
// Configure sampler with attack/release envelopes
new Sampler(samples, {
  attack: 0.005,  // Slight attack softening
  release: 0.3,   // Natural release tail
})
```

---

## Priority Ranking

| Priority | Improvement | Impact | Complexity |
|----------|-------------|--------|------------|
| 1 | Variable strum timing + randomization | High | Low |
| 2 | Velocity randomization | High | Low |
| 3 | Better release/decay handling | High | Medium |
| 4 | Convolver reverb with IR | High | Medium |
| 5 | Body resonance EQ | Medium | Low |
| 6 | Timing humanization | Medium | Low |
| 7 | Pick position filter | Medium | Medium |
| 8 | Multiple velocity layers | Very High | High |
| 9 | Sympathetic resonance | Medium | High |
| 10 | Palm mute effect | Medium | Medium |

---

## Quick Wins (Low Complexity, High Impact)

Items 1, 2, 5, and 6 can be implemented without changing the sample library and will provide immediate improvements to realism.
