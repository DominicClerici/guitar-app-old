import { TabContextMain } from "@/components/custom/tab-editor/tab-context-main"
import TabEditorMain from "@/components/custom/tab-editor/tab-editor-main"
import getTab from "@/lib/fetches/getTab"
import getUserInfo from "@/lib/fetches/getUserInfo"

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function page({ params }: PageProps) {
  const { id } = await params
  const [tab, user] = await Promise.all([getTab(id), getUserInfo()])
  if (!tab.data || tab.error || !user) {
    return <div>{tab.error || "User not found"}</div>
  }
  return (
    <TabContextMain initialTabSettings={tab.data}>
      <TabEditorMain />
    </TabContextMain>
  )
}
