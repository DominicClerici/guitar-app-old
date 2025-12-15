# Chord Identifier

A comprehensive TypeScript library for identifying musical chords from a set of notes. Superior to existing npm packages with support for 80+ chord types, jazz voicings, altered chords, inversions, slash chords, and detailed musical analysis with warnings.

## Features

- ✅ **80+ chord types** - From basic triads to complex jazz extensions
- ✅ **Multiple input formats** - Space, comma, concatenated, or array
- ✅ **Enharmonic handling** - C# and Db are equivalent
- ✅ **German notation support** - "cis", "fis", "es", etc.
- ✅ **Unicode symbols** - ♯, ♭ work seamlessly
- ✅ **Confidence scoring** - Ranked interpretations by likelihood
- ✅ **Inversion detection** - Identifies chord inversions
- ✅ **Slash chord identification** - Am/G, F/C, etc.
- ✅ **Jazz mode** - Prioritizes extended/altered chords
- ✅ **Classical mode** - Prioritizes triads and 7ths
- ✅ **Comprehensive warning system** - Voice leading issues, dissonance, ambiguity
- ✅ **Full TypeScript support** - Complete type definitions

## Installation

```bash
npm install chord-identifier
```

## Quick Start

```typescript
import { getChordName, identifyChord, getAllChordNames } from 'chord-identifier';

// Simple usage - get the most likely chord name
getChordName('C E G');        // 'C'
getChordName('C E G Bb');     // 'C7'
getChordName('C Eb G');       // 'Cm'

// Get all possible interpretations
getAllChordNames('C E G');    // ['C', 'C5', 'CM3', 'Em3', ...]

// Detailed analysis
const result = identifyChord('C E G Bb D');
console.log(result.interpretations[0].symbol);     // 'C9'
console.log(result.interpretations[0].confidence); // 100
```

## Input Formats

The library accepts notes in many formats:

```typescript
// Space-separated
getChordName('C E G');

// Comma-separated
getChordName('C, E, G');

// Concatenated
getChordName('CEG');

// Array
getChordName(['C', 'E', 'G']);

// With flats
getChordName('Db F Ab');

// With sharps
getChordName('C# E# G#');

// German notation
getChordName('cis fis gis');  // C# F# G#

// Unicode
getChordName('C E♭ G');
```

## Advanced Usage

### Custom Options

```typescript
import { ChordIdentifier } from 'chord-identifier';

const identifier = new ChordIdentifier({
  maxInterpretations: 10,     // Limit results
  includeSlashChords: true,   // Enable slash chord detection
  jazzMode: true,             // Prioritize jazz voicings
  classicalMode: false,       // Prioritize classical triads
  strictMode: false,          // Allow missing notes
  minConfidence: 30,          // Minimum score threshold
  preferFlats: true           // Use flat notation in output
});

const result = identifier.identify('C E G Bb D');
```

### Full Result Object

```typescript
const result = identifyChord('C E G B');

// Result structure:
{
  inputNotes: Note[],           // Parsed input notes
  interpretations: [{           // Ranked chord matches
    symbol: 'Cmaj7',            // Chord symbol
    fullName: 'C major 7th',    // Full name
    confidence: 100,            // 0-100 score
    root: Note,                 // Root note
    bass?: Note,                // Bass note (for slash chords)
    formula: ChordFormula,      // Chord definition
    inversion: 0,               // Inversion number
    warnings: ChordWarning[],   // Musical warnings
    alternateSymbols: string[], // Other valid symbols
    voicingNotes: string[]      // Notes as voiced
  }],
  globalWarnings: ChordWarning[], // Overall warnings
  isValidChord: boolean,          // Any valid interpretation found
  processingTime: number          // Milliseconds
}
```

### Accessing Warnings

```typescript
const result = identifyChord('C E G F');  // Major 3rd with 11

for (const interp of result.interpretations) {
  for (const warning of interp.warnings) {
    console.log(`${warning.severity}: ${warning.title}`);
    console.log(`  ${warning.message}`);
    if (warning.suggestion) {
      console.log(`  Suggestion: ${warning.suggestion}`);
    }
  }
}

// Output:
// warning: Major 3rd & 11th Clash
//   The natural 11th creates a minor 9th interval with the major 3rd
//   Suggestion: Consider using #11 instead, or omitting the 3rd
```

## Supported Chord Types

### Triads
- Major, Minor, Diminished, Augmented

### Suspended
- sus2, sus4, 7sus2, 7sus4, maj7sus4

### Seventh Chords
- maj7, 7, m7, m(maj7), dim7, m7b5, aug7, 7b5

### Extended
- 9, maj9, m9, 11, m11, 13, maj13, m13

### Altered
- 7b9, 7#9, 7#11, 7b13, 7alt, 9#11, 13#11, 13b9

### Added
- add9, add4, 6, m6, 6/9, m6/9

### Power & Quartal
- Power chords (5), Quartal voicings

### Special
- Shell voicings, Polychords, Clusters

## Warning Categories

- **Dissonance** - Clashing intervals (M3 + 11, b9, clusters)
- **Ambiguity** - Multiple valid interpretations (b6/#5, symmetrical chords)
- **Voicing** - Missing notes, wide spacing, inversions
- **Enharmonic** - Spelling considerations
- **Theoretical** - Unusual combinations (double 3rds, double 7ths)
- **Style** - Jazz vs classical considerations

## API Reference

### Functions

| Function | Description |
|----------|-------------|
| `getChordName(input)` | Returns the most likely chord symbol |
| `getAllChordNames(input)` | Returns all possible chord symbols |
| `identifyChord(input)` | Returns full analysis result |
| `parseNotes(input)` | Parses notes from string |

### Classes

| Class | Description |
|-------|-------------|
| `ChordIdentifier` | Main identification engine with options |

### Types

| Type | Description |
|------|-------------|
| `ChordIdentificationResult` | Full result object |
| `ChordInterpretation` | Single chord match |
| `ChordWarning` | Warning information |
| `Note` | Parsed note object |
| `ChordFormula` | Chord definition |

## Examples

```typescript
// Basic triads
getChordName('C E G');      // 'C'
getChordName('A C E');      // 'Am'
getChordName('B D F');      // 'Bdim'
getChordName('C E G#');     // 'Caug'

// Seventh chords
getChordName('C E G B');    // 'Cmaj7'
getChordName('G B D F');    // 'G7'
getChordName('D F A C');    // 'Dm7'
getChordName('B D F A');    // 'Bm7b5'

// Extended chords
getChordName('C E G Bb D'); // 'C9'
getChordName('D F A C E G'); // 'Dm11'

// Altered chords
getChordName('G B D F Ab'); // 'G7b9'
getChordName('E G# B D Fx'); // 'E7#9' (Hendrix chord)

// Slash chords
const result = identifyChord('G A C E');
// Returns Am7, C6, and Am/G interpretations
```

## Contributing

Contributions welcome! Areas for improvement:
- Additional chord formulas
- More warning rules
- Better confidence scoring algorithms
- Additional notation systems

## License

MIT