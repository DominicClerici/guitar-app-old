import type { QuizQuestion, ShapeRootConfig } from "./types"

export const CAGED_SHAPE_ORDER: ShapeRootConfig[] = [
  { shapeName: "C", rootCount: 2 },
  { shapeName: "A", rootCount: 2 },
  { shapeName: "G", rootCount: 3 },
  { shapeName: "E", rootCount: 2 },
  { shapeName: "D", rootCount: 2 },
]

export const CHORD_TONES_SHAPE_ORDER: ShapeRootConfig[] = [
  { shapeName: "C", rootCount: 6 },
  { shapeName: "A", rootCount: 6 },
  { shapeName: "G", rootCount: 8 },
  { shapeName: "E", rootCount: 6 },
  { shapeName: "D", rootCount: 5 },
]

export const MINOR_PENTATONIC_SHAPE_ORDER: ShapeRootConfig[] = [
  { shapeName: "C", rootCount: 10 },
  { shapeName: "A", rootCount: 10 },
  { shapeName: "G", rootCount: 14 },
  { shapeName: "E", rootCount: 10 },
  { shapeName: "D", rootCount: 10 },
]

export const MAJOR_SCALE_SHAPE_ORDER: ShapeRootConfig[] = [
  { shapeName: "C", rootCount: 14 },
  { shapeName: "A", rootCount: 14 },
  { shapeName: "G", rootCount: 17 },
  { shapeName: "E", rootCount: 13 },
  { shapeName: "D", rootCount: 12 },
]

export const CAGED_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "caged-order",
    questionText: "What is the correct order of the CAGED shapes moving up the neck?",
    options: [
      { id: "a", label: "C, A, G, E, D" },
      { id: "b", label: "C, E, A, D, G" },
      { id: "c", label: "A, C, D, E, G" },
      { id: "d", label: "E, A, D, G, C" },
    ],
    correctAnswerId: "a",
  },
  {
    id: "root-count-g",
    questionText: "How many root notes does the G shape contain?",
    options: [
      { id: "a", label: "1 root note" },
      { id: "b", label: "2 root notes" },
      { id: "c", label: "3 root notes" },
      { id: "d", label: "4 root notes" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "caged-purpose",
    questionText: "What is the primary purpose of the CAGED system?",
    options: [
      { id: "a", label: "To learn chord voicings only" },
      { id: "b", label: "To navigate the entire fretboard using familiar chord shapes" },
      { id: "c", label: "To memorize every note on the guitar" },
      { id: "d", label: "To play faster solos" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "shape-connection",
    questionText: "Which shape comes immediately after the A shape when moving up the neck?",
    options: [
      { id: "a", label: "C shape" },
      { id: "b", label: "D shape" },
      { id: "c", label: "E shape" },
      { id: "d", label: "G shape" },
    ],
    correctAnswerId: "d",
  },
  {
    id: "root-importance",
    questionText: "Why are root notes important in the CAGED system?",
    options: [
      { id: "a", label: "They are the loudest notes" },
      { id: "b", label: "They define the key and help you locate each shape position" },
      { id: "c", label: "They are only used for bass players" },
      { id: "d", label: "They are always on the 6th string" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "caged-cycle",
    questionText: "What happens after you play through all 5 CAGED shapes?",
    options: [
      { id: "a", label: "The pattern ends" },
      { id: "b", label: "You must start in a new key" },
      { id: "c", label: "The pattern repeats an octave higher" },
      { id: "d", label: "You switch to a different scale" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "c-shape-roots",
    questionText: "How many root notes does the C shape typically contain?",
    options: [
      { id: "a", label: "1 root note" },
      { id: "b", label: "2 root notes" },
      { id: "c", label: "3 root notes" },
      { id: "d", label: "4 root notes" },
    ],
    correctAnswerId: "b",
  },
]

export const CHORD_TONES_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "chord-tone-degrees",
    questionText: "Which scale degrees make up the chord tones of a major triad?",
    options: [
      { id: "a", label: "1, 2, 3" },
      { id: "b", label: "1, 3, 5" },
      { id: "c", label: "1, 4, 5" },
      { id: "d", label: "1, 5, 7" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "third-function",
    questionText: "What is the primary function of the 3rd in a chord?",
    options: [
      { id: "a", label: "Determines the root note" },
      { id: "b", label: "Determines major or minor quality" },
      { id: "c", label: "Adds tension" },
      { id: "d", label: "Creates the bass note" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "fifth-role",
    questionText: "What role does the 5th play in a major chord?",
    options: [
      { id: "a", label: "Determines the key" },
      { id: "b", label: "Creates dissonance" },
      { id: "c", label: "Adds stability and fullness" },
      { id: "d", label: "Changes the chord quality" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "triad-count",
    questionText: "How many different chord tones are in a basic major triad?",
    options: [
      { id: "a", label: "2" },
      { id: "b", label: "3" },
      { id: "c", label: "4" },
      { id: "d", label: "5" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "improvisation-importance",
    questionText: "Why are chord tones important for improvisation?",
    options: [
      { id: "a", label: "They are the easiest notes to play" },
      { id: "b", label: "They outline the harmony and sound consonant over chords" },
      { id: "c", label: "They create tension in solos" },
      { id: "d", label: "They are only used in jazz" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "arpeggio-definition",
    questionText: "What is an arpeggio?",
    options: [
      { id: "a", label: "A type of scale" },
      { id: "b", label: "Playing chord tones one at a time" },
      { id: "c", label: "A strumming pattern" },
      { id: "d", label: "A chord voicing" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "caged-chord-tones",
    questionText: "In the CAGED system, chord tones are found within which patterns?",
    options: [
      { id: "a", label: "Only the C and G shapes" },
      { id: "b", label: "The pentatonic scale positions" },
      { id: "c", label: "The 5 CAGED shape positions" },
      { id: "d", label: "Only open position chords" },
    ],
    correctAnswerId: "c",
  },
]

export const MINOR_PENTATONIC_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "pentatonic-degrees",
    questionText: "Which scale degrees make up the major pentatonic scale?",
    options: [
      { id: "a", label: "1, 2, 3, 4, 5" },
      { id: "b", label: "1, 2, 3, 5, 6" },
      { id: "c", label: "1, 3, 4, 5, 7" },
      { id: "d", label: "1, 2, 4, 5, 6" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "pentatonic-meaning",
    questionText: 'What does "pentatonic" mean?',
    options: [
      { id: "a", label: "Five fingers" },
      { id: "b", label: "Five tones" },
      { id: "c", label: "Five chords" },
      { id: "d", label: "Five frets" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "pentatonic-missing",
    questionText: "Which scale degrees are NOT included in the pentatonic scale?",
    options: [
      { id: "a", label: "2 and 5" },
      { id: "b", label: "3 and 6" },
      { id: "c", label: "4 and 7" },
      { id: "d", label: "1 and 5" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "pentatonic-improvisation",
    questionText: "Why is the pentatonic scale popular for improvisation?",
    options: [
      { id: "a", label: "It has the most notes" },
      { id: "b", label: 'It avoids the "avoid notes" that can clash' },
      { id: "c", label: "It only uses open strings" },
      { id: "d", label: "It requires less finger strength" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "pentatonic-patterns",
    questionText: "How many pentatonic patterns connect across the CAGED system?",
    options: [
      { id: "a", label: "3 patterns" },
      { id: "b", label: "4 patterns" },
      { id: "c", label: "5 patterns" },
      { id: "d", label: "7 patterns" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "pentatonic-chord-tones",
    questionText: "The major pentatonic scale contains which chord tones?",
    options: [
      { id: "a", label: "Only the root" },
      { id: "b", label: "Root and 5th only" },
      { id: "c", label: "Root, 3rd, and 5th - full triad" },
      { id: "d", label: "Root, 3rd, 5th, and 7th" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "pentatonic-additions",
    questionText: "Which notes does the pentatonic scale add to the basic triad?",
    options: [
      { id: "a", label: "4th and 7th" },
      { id: "b", label: "2nd and 6th" },
      { id: "c", label: "2nd and 4th" },
      { id: "d", label: "6th and 7th" },
    ],
    correctAnswerId: "b",
  },
]

export const MAJOR_SCALE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "major-scale-degrees",
    questionText: "How many notes are in the major scale?",
    options: [
      { id: "a", label: "5 notes" },
      { id: "b", label: "6 notes" },
      { id: "c", label: "7 notes" },
      { id: "d", label: "8 notes" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "major-scale-additions",
    questionText: "Which scale degrees does the major scale add to the pentatonic?",
    options: [
      { id: "a", label: "2nd and 6th" },
      { id: "b", label: "4th and 7th" },
      { id: "c", label: "3rd and 5th" },
      { id: "d", label: "2nd and 7th" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "major-scale-tension",
    questionText: "Why are the 4th and 7th degrees considered tension notes?",
    options: [
      { id: "a", label: "They are the loudest notes" },
      { id: "b", label: "They create half-step intervals that want to resolve" },
      { id: "c", label: "They are played on the thickest strings" },
      { id: "d", label: "They only work in minor keys" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "major-scale-formula",
    questionText: "What is the interval pattern of the major scale?",
    options: [
      { id: "a", label: "W-W-H-W-W-W-H" },
      { id: "b", label: "W-H-W-W-H-W-W" },
      { id: "c", label: "W-W-W-H-W-W-H" },
      { id: "d", label: "H-W-W-W-H-W-W" },
    ],
    correctAnswerId: "a",
  },
  {
    id: "major-scale-pentatonic-relationship",
    questionText: "What is the relationship between the pentatonic and major scale?",
    options: [
      { id: "a", label: "They share no common notes" },
      { id: "b", label: "The pentatonic is the major scale with the 4th and 7th removed" },
      { id: "c", label: "The pentatonic has more notes" },
      { id: "d", label: "They are identical scales" },
    ],
    correctAnswerId: "b",
  },
  {
    id: "fourth-degree-clash",
    questionText: "The 4th degree creates a half-step clash with which chord tone?",
    options: [
      { id: "a", label: "The root" },
      { id: "b", label: "The 5th" },
      { id: "c", label: "The 3rd" },
      { id: "d", label: "The 2nd" },
    ],
    correctAnswerId: "c",
  },
  {
    id: "seventh-degree-resolution",
    questionText: "The 7th degree has a strong tendency to resolve to which note?",
    options: [
      { id: "a", label: "The 5th" },
      { id: "b", label: "The 3rd" },
      { id: "c", label: "The root" },
      { id: "d", label: "The 6th" },
    ],
    correctAnswerId: "c",
  },
]

export function shuffleQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
