"use client"
import { TabInformation } from "@/lib/fetches/getTab"
import { tabInformationSchema, z } from "@guitar/schemas"
import { zodResolver } from "@hookform/resolvers/zod"
import { createContext, useContext, useState } from "react"
import { useForm } from "react-hook-form"

const TabSettingsContext = createContext<{
  tabSettings: z.infer<typeof tabInformationSchema>
  setTabSettings: React.Dispatch<React.SetStateAction<z.infer<typeof tabInformationSchema>>>
} | null>(null)

interface TabSettingsContextProviderProps {
  children: React.ReactNode
  initialTabSettings: TabInformation
}

export function TabSettingsContextProvider({
  children,
  initialTabSettings,
}: TabSettingsContextProviderProps) {
  const [tabSettings, setTabSettings] = useState<z.infer<typeof tabInformationSchema>>({
    name: initialTabSettings.name,
    description: initialTabSettings.description ?? "",
  })
  const tabSettingsForm = useForm<z.infer<typeof tabInformationSchema>>({
    resolver: zodResolver(tabInformationSchema),
    defaultValues: {
      name: initialTabSettings.name,
      description: initialTabSettings.description ?? "",
    },
  })
  const handleSubmit = tabSettingsForm.handleSubmit((data) => {
    setTabSettings(data)
  })
  return (
    <TabSettingsContext.Provider value={{ tabSettings, setTabSettings }}>
      {children}
    </TabSettingsContext.Provider>
  )
}

export function useTabSettingsContext() {
  const context = useContext(TabSettingsContext)
  if (!context) {
    throw new Error("useTabSettingsContext must be used within TabSettingsContextProvider")
  }
  return context
}
