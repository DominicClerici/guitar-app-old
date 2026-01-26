import { relations } from "drizzle-orm"
import { integer, jsonb, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { sessionsTable } from "./sessions-db"

const authSchema = pgSchema("auth")
export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
})

export type DatabaseImage = {
  path: string
  url: string
}

// E A D G B e
export type GuitarTuning = [number, number, number, number, number, number]

export const usersTable = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const userProfileTable = pgTable("user_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  country: text("country"),
  bio: text("bio"),
  profilePicture: jsonb("profile_picture")
    .notNull()
    .default({
      path: "",
      url: "",
    })
    .$type<DatabaseImage>(),
})

export const usersMetadataTable = pgTable("users_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  defaultTuning: integer("default_tuning")
    .array()
    .notNull()
    .default([0, 0, 0, 0, 0, 0])
    .$type<GuitarTuning>(),
})

export const userProfileRelations = relations(userProfileTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userProfileTable.userId],
    references: [usersTable.id],
  }),
}))

export const usersMetadataRelations = relations(usersMetadataTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [usersMetadataTable.userId],
    references: [usersTable.id],
  }),
}))

export const userRelations = relations(usersTable, ({ one, many }) => ({
  profile: one(userProfileTable, {
    fields: [usersTable.id],
    references: [userProfileTable.userId],
  }),
  sessions: many(sessionsTable),
  metadata: one(usersMetadataTable, {
    fields: [usersTable.id],
    references: [usersMetadataTable.userId],
  }),
}))
