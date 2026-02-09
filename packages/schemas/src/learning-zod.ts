import { z } from "zod"

export const completeModuleZod = z.object({
  path: z.enum(["caged"]),
  lesson: z.enum(["cagedRoots", "chordTones", "cagedPentatonic", "majorScale"]),
  moduleId: z.string().min(1),
})

export const getLessonProgressZod = z.object({
  path: z.enum(["caged"]),
  lesson: z.enum(["cagedRoots", "chordTones", "cagedPentatonic", "majorScale"]),
})
