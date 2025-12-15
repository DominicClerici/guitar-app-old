"use server"

import { db, eq, tabInformationTable } from "@guitar/db"
import { tabInformationSchema, z } from "@guitar/schemas"

export default async function updateTabSettings(
  tabId: string,
  settings: z.infer<typeof tabInformationSchema>,
) {
  try {
    const tab = await db.query.tabInformationTable.findFirst({
      where: eq(tabInformationTable.id, tabId),
    })
  } catch (error) {
    console.error(error)
    return { error: "An unknown error occurred" }
  }
}
