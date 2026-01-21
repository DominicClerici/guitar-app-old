"use client"

import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

export type SettingsSection = "profile" | "account" | "settings" | "subscription" | "notifications"

const navItems: {
  id: SettingsSection
  label: string
}[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings" },
  { id: "subscription", label: "Subscription" },
  { id: "notifications", label: "Notifications" },
]

const linkItems = [
  { href: "/support", label: "Support" },
  { href: "/terms", label: "Terms & Privacy" },
]

interface SettingsNavProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  onLogout: () => void
}

export default function SettingsNav({
  activeSection,
  onSectionChange,
  onLogout,
}: SettingsNavProps) {
  const navRef = useRef<HTMLDivElement>(null)
  const [selectorStyle, setSelectorStyle] = useState({ top: 0, opacity: 0 })

  const activeIndex = navItems.findIndex((item) => item.id === activeSection)

  useEffect(() => {
    if (navRef.current && activeIndex !== -1) {
      const navElement = navRef.current
      const buttons = navElement.querySelectorAll("[data-settings-nav-item]")
      const activeButton = buttons[activeIndex] as HTMLElement

      if (activeButton) {
        const navRect = navElement.getBoundingClientRect()
        const buttonRect = activeButton.getBoundingClientRect()
        const top = buttonRect.top - navRect.top

        setSelectorStyle({ top, opacity: 1 })
      }
    } else {
      setSelectorStyle((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [activeIndex])

  return (
    <nav className="flex w-44 shrink-0 flex-col">
      <div ref={navRef} className="relative flex flex-col">
        <div
          className="bg-primary absolute left-0 h-9 w-0.5 rounded-full transition-all duration-200 ease-out"
          style={{
            transform: `translateY(${selectorStyle.top}px)`,
            opacity: selectorStyle.opacity,
          }}
        />

        {navItems.map((item) => {
          const isActive = item.id === activeSection
          return (
            <button
              key={item.id}
              data-settings-nav-item
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex h-10 items-center gap-3 border-l px-3 font-medium transition-colors duration-75",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground cursor-pointer",
              )}
            >
              <span className="leading-none">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-8" />

      <div className="flex flex-col">
        {linkItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-muted-foreground hover:text-foreground text flex h-10 items-center gap-2 px-3 transition-colors duration-75"
          >
            <span>{item.label}</span>
            <ExternalLink className="size-3 opacity-50" />
          </Link>
        ))}
      </div>

      <div className="mt-6" />

      <button
        onClick={onLogout}
        className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1.5 text-left transition-colors duration-75"
      >
        Log out
      </button>
    </nav>
  )
}
