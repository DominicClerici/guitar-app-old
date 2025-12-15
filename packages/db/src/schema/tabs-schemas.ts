import { relations } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { usersTable } from "./users-schema"

export type TabDataDataField = {
  value: string
  effects: TabDataEffectsSettings
}
export type TabDataSettingsField = {
  value: string
}
export type TabDataEffectsSettings =
  | {
      reverb: {
        enabled: boolean
        presetId: string // ID of the selected impulse response
        wet: number // Mix level (0 to 1)
        preDelay: number // Pre-delay in seconds (0 to 0.1)
        decay: number // Decay multiplier (0.1 to 2) - affects how the IR is scaled
        highCut: number // High frequency cutoff for reverb (1000 to 20000 Hz)
      }
      sampler: {
        volume: number // Sampler volume in dB (-24 to 0)
      }
      limiter: {
        enabled: boolean
        threshold: number // Threshold in dB (-12 to 0)
      }
      compressor: {
        enabled: boolean
        threshold: number // Threshold in dB (-48 to 0)
        ratio: number // Compression ratio (1 to 20)
        attack: number // Attack time in seconds (0.001 to 0.1)
        release: number // Release time in seconds (0.01 to 1)
      }
      master: {
        gain: number // Master gain (0 to 1)
      }
      velocityScale: number // Scale factor for note velocities (0.1 to 1)
    }
  | string

export const tabInformationTable = pgTable("tab_information", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  tabDataId: uuid("tab_data_id")
    .references(() => tabDataTable.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const tabInformationRelations = relations(tabInformationTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [tabInformationTable.userId],
    references: [usersTable.id],
  }),
  tabData: one(tabDataTable, {
    fields: [tabInformationTable.tabDataId],
    references: [tabDataTable.id],
  }),
}))

export const tabDataTable = pgTable("tab_data", {
  id: uuid("id").primaryKey().defaultRandom(),
  data: jsonb("data").notNull().$type<TabDataDataField>(),
  settings: jsonb("settings").notNull().$type<TabDataSettingsField>(),
})

export const tabDataEffectsPresetsTable = pgTable("tab_data_effects_presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" })
    .notNull(),
  settings: jsonb("settings").notNull().$type<Exclude<TabDataEffectsSettings, string>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
