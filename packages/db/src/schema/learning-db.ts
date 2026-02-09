import { relations } from "drizzle-orm"
import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { usersTable } from "./users-db"

export const learningPathsEnum = pgEnum("learning_paths_enum", ["caged"])

export const learningPathsTable = pgTable("learning_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  path: learningPathsEnum("path").notNull(),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
})

export const learningPathRelations = relations(learningPathsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [learningPathsTable.userId],
    references: [usersTable.id],
  }),
}))
