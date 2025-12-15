import { relations } from "drizzle-orm"
import { pgSchema, pgTable, text, uuid } from "drizzle-orm/pg-core"
import { tabInformationTable } from "./tabs-schemas"

const authSchema = pgSchema("auth")
export const users = authSchema.table("users", {
  id: uuid("id").primaryKey(),
})

export const usersTable = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
})

export const usersRelations = relations(usersTable, ({ many }) => ({
  tabs: many(tabInformationTable),
}))
