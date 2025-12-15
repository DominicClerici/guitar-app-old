import { db, eq, tabInformationTable } from "@guitar/db"

export default async function getTab(id: string) {
  try {
    const tab = await db.query.tabInformationTable.findFirst({
      where: eq(tabInformationTable.id, id),
      with: {
        tabData: true,
      },
    })
    if (!tab) {
      console.error("Tab not found")
      return { data: null, error: "Tab not found" }
    }
    return { data: tab, error: null }
  } catch (error) {
    console.error(error)
    return { data: null, error: "An unknown error occurred" }
  }
}

export type TabInformation = NonNullable<Awaited<ReturnType<typeof getTab>>["data"]>
