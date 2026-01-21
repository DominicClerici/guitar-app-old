"use client"

import { Button } from "@/components/ui/button"
import Logo from "@/components/ui/logo"
import useAuth from "@/hooks/useAuth"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function LandingHeader() {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="bg-background/80 absolute inset-0 backdrop-blur-md" />
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Logo href="/" />

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="#testimonials"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Testimonials
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Button href="/dashboard" hoverArrow>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button variant="ghost" href="/login">
                Sign In
              </Button>
              <Button href="/sign-up" hoverArrow>
                Get Started
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="bg-background/95 absolute inset-x-0 top-full backdrop-blur-lg md:hidden">
          <div className="flex flex-col gap-4 px-6 py-6">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="#testimonials"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Testimonials
            </Link>
            <div className="mt-4 flex flex-col gap-3 border-t pt-4">
              {user ? (
                <Button href="/dashboard" hoverArrow>
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button variant="ghost" href="/login">
                    Sign In
                  </Button>
                  <Button href="/sign-up" hoverArrow>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
