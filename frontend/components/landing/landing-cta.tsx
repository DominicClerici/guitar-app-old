"use client"

import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { ArrowRight, Sparkles } from "lucide-react"
import Link from "next/link"

function GuitarNeckPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.04]">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="bg-foreground absolute top-0 bottom-0 w-px"
          style={{ left: `${(i + 1) * 8}%` }}
        />
      ))}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-foreground absolute right-0 left-0 h-px"
          style={{ top: `${20 + i * 12}%` }}
        />
      ))}
    </div>
  )
}

export default function LandingCta() {
  const { user } = useAuth()

  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="bg-foreground text-background relative overflow-hidden rounded-3xl">
          <GuitarNeckPattern />

          <div className="bg-landing-accent/20 absolute -top-20 -left-20 size-64 rounded-full blur-3xl" />
          <div className="bg-landing-accent/20 absolute -right-20 -bottom-20 size-64 rounded-full blur-3xl" />

          <div className="relative px-8 py-16 sm:px-16 lg:px-24 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <div className="bg-background/10 mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Sparkles className="text-landing-accent size-4" />
                <span>Start your journey today</span>
              </div>

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Ready to become the guitarist you&apos;ve always wanted to be?
              </h2>

              <p className="text-background/70 mt-6 text-lg leading-relaxed">
                Join thousands of learners who are mastering guitar with StringFlow. No credit card
                required. No commitment. Just pure progress.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                {user ? (
                  <Button
                    size="lg"
                    asChild
                    className="bg-landing-accent text-foreground hover:bg-landing-accent-light h-12 px-8 text-base"
                  >
                    <Link href="/dashboard">
                      Continue Learning
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      asChild
                      className="bg-landing-accent text-foreground hover:bg-landing-accent-light h-12 px-8 text-base"
                    >
                      <Link href="/sign-up">
                        Get Started Free
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      asChild
                      className="border-background/30 text-background hover:bg-background/10 hover:text-background h-12 bg-transparent px-8 text-base"
                    >
                      <Link href="/dashboard">Try the Demo</Link>
                    </Button>
                  </>
                )}
              </div>

              <p className="text-background/50 mt-8 text-sm">
                No credit card required • Works on any device • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
