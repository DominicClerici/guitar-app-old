import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import DetectChordTiming from "./detect-chord-timing"
import ManualChordTiming from "./manual-chord-timing"

export default function ChordTimingDialog() {
  const [currentTab, setCurrentTab] = useState<"detect" | "manual">("manual")
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Strum Pattern</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>Chord Timing</DialogTitle>
        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as "detect" | "manual")}>
          <TabsList>
            <TabsTrigger value="detect">Detect</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="detect">
            <DetectChordTiming />
          </TabsContent>
          <TabsContent value="manual">
            <ManualChordTiming />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
