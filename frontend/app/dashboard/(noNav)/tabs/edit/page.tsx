import TabEditor from "@/components/tabs/tab-editor"
import { TabsProvider } from "@/context/tabs-provider"

export default function page() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4">
      <h2>Edit Tabs</h2>
      <TabsProvider>
        <TabEditor />
      </TabsProvider>
    </div>
  )
}
