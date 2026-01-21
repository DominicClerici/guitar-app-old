import { relations } from "drizzle-orm"
import { jsonb, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

const authSchema = pgSchema("auth")
export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
})

export type DatabaseImage = {
  path: string
  url: string
}

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
  profilePicture: jsonb("profile_picture").$type<DatabaseImage>(),
})

export const userProfileRelations = relations(userProfileTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userProfileTable.userId],
    references: [usersTable.id],
  }),
}))

export const userRelations = relations(usersTable, ({ one }) => ({
  profile: one(userProfileTable, {
    fields: [usersTable.id],
    references: [userProfileTable.userId],
  }),
}))
