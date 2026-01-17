"use client"

import { useEffect, useState } from "react"
import DesktopNav from "./desktop-nav"
import MobileNav from "./mobile-nav"

export default function DashboardNav() {
  const [isMobileView, setIsMobileView] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  if (isMobileView) {
    return <MobileNav />
  } else {
    return <DesktopNav />
  }
}
