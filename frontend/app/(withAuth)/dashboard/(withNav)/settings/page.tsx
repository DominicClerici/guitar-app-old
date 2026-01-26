"use client"

import AccountSection from "@/components/settings/sections/account-section"
import NotificationsSection from "@/components/settings/sections/notifications-section"
import ProfileSection from "@/components/settings/sections/profile-section"
import AppSettingsSection from "@/components/settings/sections/settings-section"
import SubscriptionSection from "@/components/settings/sections/subscription-section"
import SettingsNav, { type SettingsSection } from "@/components/settings/settings-nav"
import useAuth from "@/hooks/useAuth"
import { useState } from "react"

const sectionComponents: Record<SettingsSection, React.ComponentType> = {
  profile: ProfileSection,
  account: AccountSection,
  settings: AppSettingsSection,
  subscription: SubscriptionSection,
  notifications: NotificationsSection,
}

export default function SettingsPage() {
  const { logout } = useAuth()
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile")

  const ActiveComponent = sectionComponents[activeSection]

  return (
    <div className="w-full">
      <h1 className="font-display mb-10 text-4xl font-bold tracking-tight">My account</h1>

      <div className="flex gap-12">
        <SettingsNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onLogout={logout}
        />

        <div className="min-w-0 grow">
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}
