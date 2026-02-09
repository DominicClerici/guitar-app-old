export type ModuleType = "article" | "practice" | "quiz" | "test"

export type ModuleDefinition = {
  id: string
  label: string
  type: ModuleType
}

export type LessonConfig = {
  lessonId: string
  path: "caged"
  label: string
  modules: ModuleDefinition[]
}

export const LESSON_CONFIGS: Record<string, LessonConfig> = {
  cagedRoots: {
    lessonId: "cagedRoots",
    path: "caged",
    label: "CAGED Roots",
    modules: [
      { id: "intro-article", label: "Introduction", type: "article" },
      { id: "practice-1", label: "Practice: D Major", type: "practice" },
      { id: "article-1", label: "Roots Recap", type: "article" },
      { id: "practice-2", label: "Practice: New Keys", type: "practice" },
      { id: "article-2", label: "Moveable Shapes", type: "article" },
      { id: "test", label: "Test", type: "test" },
      { id: "quiz", label: "Quiz", type: "quiz" },
      { id: "article-final", label: "What's Next", type: "article" },
    ],
  },
  chordTones: {
    lessonId: "chordTones",
    path: "caged",
    label: "Chord Tones",
    modules: [
      { id: "intro-article", label: "Introduction", type: "article" },
      { id: "practice-ca", label: "Practice: C & A", type: "practice" },
      { id: "article-chord-tones-overview", label: "Chord Tones Overview", type: "article" },
      { id: "practice-ged", label: "Practice: G, E & D", type: "practice" },
      { id: "article-chord-tones-review", label: "Chord Tones Review", type: "article" },
      { id: "practice-all", label: "Practice: All Shapes", type: "practice" },
      { id: "test", label: "Test", type: "test" },
      { id: "quiz", label: "Quiz", type: "quiz" },
      { id: "article-chord-tones-recap", label: "Chord Tones Recap", type: "article" },
    ],
  },
  cagedPentatonic: {
    lessonId: "cagedPentatonic",
    path: "caged",
    label: "Minor Pentatonic",
    modules: [
      { id: "intro-article", label: "Introduction", type: "article" },
      { id: "practice-c", label: "Practice: C Shape", type: "practice" },
      { id: "article-c-to-a", label: "C Shape Review", type: "article" },
      { id: "practice-a", label: "Practice: A Shape", type: "practice" },
      { id: "article-a-to-g", label: "A Shape Review", type: "article" },
      { id: "practice-g", label: "Practice: G Shape", type: "practice" },
      { id: "article-g-to-e", label: "G Shape Review", type: "article" },
      { id: "practice-e", label: "Practice: E Shape", type: "practice" },
      { id: "article-e-to-d", label: "E Shape Review", type: "article" },
      { id: "practice-d", label: "Practice: D Shape", type: "practice" },
      { id: "test", label: "Test", type: "test" },
      { id: "quiz", label: "Quiz", type: "quiz" },
      { id: "article-pentatonic-recap", label: "Pentatonic Recap", type: "article" },
    ],
  },
  majorScale: {
    lessonId: "majorScale",
    path: "caged",
    label: "Major Scale",
    modules: [
      { id: "intro-article", label: "Introduction", type: "article" },
      { id: "practice-c", label: "Practice: C Shape", type: "practice" },
      { id: "article-c-to-a", label: "C Shape Review", type: "article" },
      { id: "practice-a", label: "Practice: A Shape", type: "practice" },
      { id: "article-a-to-g", label: "A Shape Review", type: "article" },
      { id: "practice-g", label: "Practice: G Shape", type: "practice" },
      { id: "article-g-to-e", label: "G Shape Review", type: "article" },
      { id: "practice-e", label: "Practice: E Shape", type: "practice" },
      { id: "article-e-to-d", label: "E Shape Review", type: "article" },
      { id: "practice-d", label: "Practice: D Shape", type: "practice" },
      { id: "test", label: "Test", type: "test" },
      { id: "quiz", label: "Quiz", type: "quiz" },
      { id: "article-major-scale-recap", label: "Major Scale Recap", type: "article" },
    ],
  },
}

export function getLessonConfig(module: string): LessonConfig | null {
  return LESSON_CONFIGS[module] ?? null
}
