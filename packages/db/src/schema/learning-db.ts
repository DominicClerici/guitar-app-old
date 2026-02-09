import { relations } from "drizzle-orm"
import { pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { usersTable } from "./users-db"

export const learningPathsEnum = pgEnum("learning_paths_enum", ["caged"])

export const lessonsEnum = pgEnum("lessons_enum", [
  "cagedRoots",
  "chordTones",
  "cagedPentatonic",
  "majorScale",
])

export const learningPathsTable = pgTable("learning_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  path: learningPathsEnum("path").notNull(),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
})

export const moduleCompletionsTable = pgTable(
  "module_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    path: learningPathsEnum("path").notNull(),
    lesson: lessonsEnum("lesson").notNull(),
    moduleId: text("module_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.path, table.lesson, table.moduleId)],
)

export const learningPathRelations = relations(learningPathsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [learningPathsTable.userId],
    references: [usersTable.id],
  }),
  moduleCompletions: many(moduleCompletionsTable),
}))

export const moduleCompletionRelations = relations(moduleCompletionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [moduleCompletionsTable.userId],
    references: [usersTable.id],
  }),
}))
