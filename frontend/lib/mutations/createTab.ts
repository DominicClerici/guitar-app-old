"use server"

import { db, tabDataTable, tabInformationTable } from "@guitar/db"
import getUserInfo from "../fetches/getUserInfo"

export default async function createTab() {
  try {
    const user = await getUserInfo()
    if (!user) {
      return { data: null, error: "User not found" }
    }
    const result = await db.transaction(async (tx) => {
      const [newDataTab] = await tx
        .insert(tabDataTable)
        .values({
          data: { value: "", effects: "" },
          settings: { value: "" },
        })
        .returning({ id: tabDataTable.id })

      if (!newDataTab) {
        tx.rollback()
        return null
      }

      const [newTab] = await tx
        .insert(tabInformationTable)
        .values({
          name: "New Tab",
          userId: user.id,
          tabDataId: newDataTab.id,
        })
        .returning({ id: tabInformationTable.id })

      if (!newTab) {
        tx.rollback()
        return null
      }

      return newTab
    })

    if (!result) {
      return { data: null, error: "Failed to create tab" }
    }
    return { data: result.id, error: null }
  } catch (error) {
    console.error(error)
    return { data: null, error: "An unknown error occurred" }
  }
}
