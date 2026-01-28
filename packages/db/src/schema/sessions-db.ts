import { relations } from "drizzle-orm"
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { usersTable } from "./users-db"

export const sessionTypesEnum = pgEnum("session_types", ["scales", "arpeggios", "caged"])

export const timingModesEnum = pgEnum("timing_modes", ["infinite", "timed", "shapes"])

export type SpeedWindow = {
  notes: number
  shapes: number[]
}

export type ShapeCompletionTime = {
  shapeIndex: number
  shapeName: string
  durationMs: number
}

export type ScaleSessionData = {
  type: "scales"
  key: number
  shapes: number[]
  shapesCompleted: number
  totalNotesPlayed: number
  speedWindows?: SpeedWindow[]
  shapeCompletionTimes?: ShapeCompletionTime[]
}
export type ArpeggioSessionData = {
  type: "arpeggios"
  arpeggio: string
  shapes: number[]
}
export type CagedSessionData = {
  type: "caged"
  caged: string
  shapes: number[]
}

export type SessionData = ScaleSessionData | ArpeggioSessionData | CagedSessionData

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => usersTable.id)
    .notNull(),
  duration: integer("duration").notNull(),
  type: sessionTypesEnum("type").notNull(),
  timingMode: timingModesEnum("timing_mode").notNull(),
  keys: text("keys").array().notNull(),

  sessionData: jsonb("session_data").$type<SessionData>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const sessionRelations = relations(sessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [sessionsTable.userId],
    references: [usersTable.id],
  }),
}))
