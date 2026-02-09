import type { PracticeFlowConfig } from "./types"

export const CAGED_ROOTS_FLOW: PracticeFlowConfig = {
  practiceType: "roots",
  steps: [
    {
      type: "practice",
      id: "practice-1",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
    },
    {
      type: "article",
      id: "article-1",
      component: "roots-recap",
      retryStepId: "practice-1",
    },
    {
      type: "practice",
      id: "practice-2",
      keys: [
        { keyIndex: 0, rounds: 1 },
        { keyIndex: 3, rounds: 1 },
        { keyIndex: 5, rounds: 1 },
      ],
      mode: "guided",
    },
    {
      type: "article",
      id: "article-2",
      component: "moveable-shapes-recap",
      retryStepId: "practice-2",
    },
    {
      type: "practice",
      id: "test",
      keys: [{ keyIndex: 2, rounds: 1 }],
      mode: "test",
    },
    { type: "quiz", id: "quiz" },
    {
      type: "article",
      id: "article-final",
      component: "next-chord-tones",
    },
    { type: "complete", id: "complete" },
  ],
}

export const CHORD_TONES_FLOW: PracticeFlowConfig = {
  practiceType: "chordTones",
  steps: [
    {
      type: "practice",
      id: "practice-ca",
      keys: [{ keyIndex: 2, rounds: 2 }],
      mode: "guided",
      shapes: ["C", "A"],
    },
    {
      type: "article",
      id: "article-chord-tones-overview",
      component: "chord-tones-overview",
      retryStepId: "practice-ca",
    },
    {
      type: "practice",
      id: "practice-ged",
      keys: [{ keyIndex: 2, rounds: 2 }],
      mode: "guided",
      shapes: ["G", "E", "D"],
    },
    {
      type: "article",
      id: "article-chord-tones-review",
      component: "chord-tones-review",
      retryStepId: "practice-ged",
    },
    {
      type: "practice",
      id: "practice-all",
      keys: [{ keyIndex: 2, rounds: 1 }],
      mode: "guided",
    },
    {
      type: "practice",
      id: "test",
      keys: [{ keyIndex: 2, rounds: 1 }],
      mode: "test",
      showRootsInTest: true,
    },
    { type: "quiz", id: "quiz" },
    {
      type: "article",
      id: "article-chord-tones-recap",
      component: "chord-tones-recap",
    },
    { type: "complete", id: "complete" },
  ],
}

export const PENTATONIC_FLOW: PracticeFlowConfig = {
  practiceType: "pentatonic",
  steps: [
    {
      type: "practice",
      id: "practice-c",
      keys: [
        { keyIndex: 2, rounds: 1 },
        { keyIndex: 4, rounds: 1 },
        { keyIndex: 7, rounds: 1 },
      ],
      mode: "guided",
      shapes: ["C"],
    },
    {
      type: "article",
      id: "article-c-to-a",
      component: "pentatonic-c-to-a",
      retryStepId: "practice-c",
    },
    {
      type: "practice",
      id: "practice-a",
      keys: [
        { keyIndex: 2, rounds: 1 },
        { keyIndex: 4, rounds: 1 },
        { keyIndex: 7, rounds: 1 },
      ],
      mode: "guided",
      shapes: ["A"],
    },
    {
      type: "article",
      id: "article-a-to-g",
      component: "pentatonic-a-to-g",
      retryStepId: "practice-a",
    },
    {
      type: "practice",
      id: "practice-g",
      keys: [
        { keyIndex: 2, rounds: 1 },
        { keyIndex: 4, rounds: 1 },
        { keyIndex: 7, rounds: 1 },
      ],
      mode: "guided",
      shapes: ["G"],
    },
    {
      type: "article",
      id: "article-g-to-e",
      component: "pentatonic-g-to-e",
      retryStepId: "practice-g",
    },
    {
      type: "practice",
      id: "practice-e",
      keys: [
        { keyIndex: 2, rounds: 1 },
        { keyIndex: 4, rounds: 1 },
        { keyIndex: 7, rounds: 1 },
      ],
      mode: "guided",
      shapes: ["E"],
    },
    {
      type: "article",
      id: "article-e-to-d",
      component: "pentatonic-e-to-d",
      retryStepId: "practice-e",
    },
    {
      type: "practice",
      id: "practice-d",
      keys: [
        { keyIndex: 2, rounds: 1 },
        { keyIndex: 4, rounds: 1 },
        { keyIndex: 7, rounds: 1 },
      ],
      mode: "guided",
      shapes: ["D"],
    },
    {
      type: "practice",
      id: "test",
      keys: [{ keyIndex: 2, rounds: 1 }],
      mode: "test",
      showRootsInTest: true,
    },
    { type: "quiz", id: "quiz" },
    {
      type: "article",
      id: "article-pentatonic-recap",
      component: "pentatonic-recap",
    },
    { type: "complete", id: "complete" },
  ],
}

export const MAJOR_SCALE_FLOW: PracticeFlowConfig = {
  practiceType: "majorScale",
  steps: [
    {
      type: "practice",
      id: "practice-c",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
      shapes: ["C"],
    },
    {
      type: "article",
      id: "article-c-to-a",
      component: "major-scale-c-to-a",
      retryStepId: "practice-c",
    },
    {
      type: "practice",
      id: "practice-a",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
      shapes: ["A"],
    },
    {
      type: "article",
      id: "article-a-to-g",
      component: "major-scale-a-to-g",
      retryStepId: "practice-a",
    },
    {
      type: "practice",
      id: "practice-g",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
      shapes: ["G"],
    },
    {
      type: "article",
      id: "article-g-to-e",
      component: "major-scale-g-to-e",
      retryStepId: "practice-g",
    },
    {
      type: "practice",
      id: "practice-e",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
      shapes: ["E"],
    },
    {
      type: "article",
      id: "article-e-to-d",
      component: "major-scale-e-to-d",
      retryStepId: "practice-e",
    },
    {
      type: "practice",
      id: "practice-d",
      keys: [{ keyIndex: 2, rounds: 3 }],
      mode: "guided",
      shapes: ["D"],
    },
    {
      type: "practice",
      id: "test",
      keys: [{ keyIndex: 2, rounds: 1 }],
      mode: "test",
      showRootsInTest: true,
    },
    { type: "quiz", id: "quiz" },
    {
      type: "article",
      id: "article-major-scale-recap",
      component: "major-scale-recap",
    },
    { type: "complete", id: "complete" },
  ],
}

export function getFlowConfig(practiceType: string): PracticeFlowConfig {
  switch (practiceType) {
    case "roots":
      return CAGED_ROOTS_FLOW
    case "chordTones":
      return CHORD_TONES_FLOW
    case "pentatonic":
      return PENTATONIC_FLOW
    case "majorScale":
      return MAJOR_SCALE_FLOW
    default:
      return CAGED_ROOTS_FLOW
  }
}
