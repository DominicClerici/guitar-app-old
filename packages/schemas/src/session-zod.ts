import { z } from "zod"

const scaleSessionDataZod = z.object({
  type: z.literal("scales"),
  key: z.number().min(0).max(11),
  shapes: z.array(z.number().min(1).max(5)),
  shapesCompleted: z.number().min(0),
  totalNotesPlayed: z.number().min(0),
})

export const saveNewSessionZod = z.object({
  duration: z.number().min(0),
  type: z.enum(["scales", "arpeggios", "caged"]),
  timingMode: z.enum(["infinite", "timed", "shapes"]),
  keys: z.array(z.string()),
  sessionData: scaleSessionDataZod,
})
