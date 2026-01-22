"use client"

import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Book,
  Guitar,
  HelpCircleIcon,
  Home,
  Loader2,
  LogOutIcon,
  Music2,
  Settings,
  UserIcon,
  Waves,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "../button"
import Logo from "../logo"
import { Separator } from "../separator"

const mainNavItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/learn", label: "Learn", icon: Book },
  { href: "/dashboard/practice", label: "Practice", icon: Guitar },
  { href: "/dashboard/tabs", label: "Tabs", icon: Music2 },
]

const secondaryNavItems = [
  { href: "/dashboard/stats", label: "My Stats", icon: BarChart3 },
  { href: "/dashboard/tuner", label: "Tuner", icon: Waves },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

const allNavItems = [...mainNavItems, ...secondaryNavItems]

type NavItem = (typeof mainNavItems)[number] | (typeof secondaryNavItems)[number]

export default function DesktopNav() {
  const { user, logout, isLoading } = useAuth()
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)
  const [selectorStyle, setSelectorStyle] = useState({ top: 0, opacity: 0 })
  const router = useRouter()

  const activeIndex = allNavItems.findIndex(
    (item) =>
      pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)),
  )

  useEffect(() => {
    if (navRef.current && activeIndex !== -1) {
      const navElement = navRef.current
      const links = navElement.querySelectorAll("[data-nav-item]")
      const activeLink = links[activeIndex] as HTMLElement

      if (activeLink) {
        const navRect = navElement.getBoundingClientRect()
        const linkRect = activeLink.getBoundingClientRect()
        const top = linkRect.top - navRect.top

        setSelectorStyle({ top, opacity: 1 })
      }
    } else {
      setSelectorStyle((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [activeIndex, pathname])

  return (
    <header className="bg-background-elevated fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r">
      <div className="mt-2 flex items-center justify-between px-4 py-2">
        <Logo href="/dashboard" />
      </div>
      <Separator className="my-2" />

      <nav ref={navRef} className="relative flex flex-col gap-1 px-3">
        <div
          className="bg-primary/10 absolute right-3 left-3 h-10 rounded-lg transition-all duration-200 ease-out"
          style={{
            transform: `translateY(${selectorStyle.top}px)`,
            opacity: selectorStyle.opacity,
          }}
        />

        {mainNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return <NavItem key={item.href} item={item} isActive={isActive} />
        })}

        <Separator className="my-2" />

        {secondaryNavItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))

          return <NavItem key={item.href} item={item} isActive={isActive} />
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 px-3 pb-4">
        <NavItem
          item={{ href: "/dashboard/support", label: "Support", icon: HelpCircleIcon }}
          isActive={false}
        />
        <Separator className="mb-2" />

        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2">
          {!user ? (
            <div className="flex h-full w-full items-center justify-center py-2">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {user.profile.profilePicture ? (
                  <img
                    src={user.profile.profilePicture.url}
                    alt={user.name}
                    className="size-8 rounded-full"
                  />
                ) : (
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                    <UserIcon className="size-4" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-muted-foreground text-xs">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                isLoading={isLoading}
                onClick={async () => {
                  await logout()
                  router.push("/")
                }}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto size-8"
              >
                <LogOutIcon className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const NavItem = ({ item, isActive }: { item: NavItem; isActive: boolean }) => {
  return (
    <Link
      key={item.href}
      href={item.href}
      data-nav-item
      className={cn(
        "group relative z-10 flex h-10 items-center gap-3 rounded-lg px-3 transition-colors duration-150",
        isActive ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <item.icon
        className={cn(
          "size-[18px] transition-transform duration-150",
          isActive ? "text-primary scale-110" : "group-hover:scale-110",
        )}
        strokeWidth={isActive ? 2.5 : 2}
      />
      <span className="text-sm">{item.label}</span>
    </Link>
  )
}
