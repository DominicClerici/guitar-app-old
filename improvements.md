Melody timings: 

1. Tuplet Mode / Triplet Toggle
Add a "Triplet" or "Tuplet" toggle that overlays a 3-subdivision grid on top of beats instead of 4.
UX: A button next to the interval selector that says "Triplets" - when active, each beat divides into 3 instead of 4
Visual: Different colored grid lines for triplet subdivisions
Data: Store tuplet notes with fractional sixteenths (e.g., 0:1:1.33)

2. Swing / Shuffle Quantization
A slider that applies swing feel by delaying every other subdivision.
UX: A "Swing" slider (0-100%) that shifts off-beat notes forward in time
Implementation: At playback time, apply a percentage offset to notes on even subdivisions
Benefit: Keeps the grid simple but adds musical feel

3. Free-form / Piano Roll Mode
A horizontal timeline where notes can be placed anywhere, not just on grid lines.
UX: Toggle between "Grid Mode" and "Free Mode"
Visual: In free mode, clicking places a note at the exact x-position; snapping is optional
Interaction: Drag notes horizontally to fine-tune timing

4. Humanize / Randomize
A "Humanize" button that adds subtle random timing variations to all notes.
UX: Click to apply random ±X ms offsets to each note
Slider: Control the intensity of randomization
Purpose: Makes programmed melodies feel more natural

5. Custom Time Signature Per Bar
Allow different bars to have different time signatures or subdivisions.
UX: Right-click a bar → "Set Time Signature" or "Set Subdivision"
Example: Bar 1 is 4/4 with 16ths, Bar 2 is 7/8 with triplets
Visual: Bars visually resize to show different beat counts
