"use client"

import { Button } from "@/components/ui/button"
import useAuth from "@/hooks/useAuth"
import { Mic, Music } from "lucide-react"

function SoundWaveBar({ delay, height }: { delay: number; height: number }) {
  return (
    <div
      className="bg-primary/80 animate-wave-pulse w-1 rounded-full"
      style={{
        height: `${height}px`,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}

function GuitarStrings() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="bg-foreground absolute right-0 left-0 h-px"
          style={{
            top: `${15 + i * 14}%`,
            transform: `rotate(${-2 + i * 0.5}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function FloatingNote({ className, delay }: { className: string; delay: number }) {
  return (
    <div
      className={`animate-float-up absolute opacity-0 ${className}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <Music className="text-primary/40 size-8" />
    </div>
  )
}

export default function LandingHero() {
  const { user } = useAuth()

  const waveHeights = [20, 35, 50, 70, 85, 70, 50, 35, 20, 35, 55, 75, 90, 75, 55, 35, 20]

  return (
    <section className="relative min-h-screen overflow-hidden pt-20">
      <GuitarStrings />

      <FloatingNote className="top-[20%] left-[10%]" delay={800} />
      <FloatingNote className="top-[30%] right-[15%]" delay={1200} />
      <FloatingNote className="bottom-[25%] left-[20%]" delay={1600} />
      <FloatingNote className="right-[25%] bottom-[35%]" delay={2000} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_50%)] opacity-[0.08]" />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pt-20 lg:px-8 lg:pt-32">
        <div
          className="border-primary/20 bg-primary/5 animate-float-up mb-6 flex items-center gap-2 rounded-full border px-4 py-2 opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <Mic className="text-primary size-4" />
          <span className="text-muted-foreground text-sm">Real-time listening technology</span>
        </div>

        <h1
          className="animate-float-up font-display max-w-4xl text-center text-5xl leading-[1.1] font-bold tracking-tight opacity-0 sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
        >
          Learn guitar with an{" "}
          <span className="relative">
            <span className="text-primary relative z-10">AI that listens</span>
            <span className="bg-primary/10 absolute -inset-x-2 -inset-y-1 -z-10 -rotate-1" />
          </span>
        </h1>

        <p
          className="text-muted-foreground animate-float-up mt-8 max-w-2xl text-center text-lg leading-relaxed opacity-0 sm:text-xl"
          style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
        >
          StringFlow hears you play through your microphone or guitar input, giving you instant
          feedback to accelerate your learning. Practice smarter, not harder.
        </p>

        <div
          className="animate-float-up mt-10 flex flex-col items-center gap-4 opacity-0 sm:flex-row"
          style={{ animationDelay: "600ms", animationFillMode: "forwards" }}
        >
          {user ? (
            <Button size="xl" href="/dashboard" hoverArrow>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button size="xl" hoverArrow href="/sign-up">
                Start Learning Free
              </Button>
              <Button size="xl" variant="outline">
                View Demo
              </Button>
            </>
          )}
        </div>

        <div
          className="text-muted-foreground animate-float-up mt-16 flex items-center justify-center gap-8 text-sm opacity-0"
          style={{ animationDelay: "800ms", animationFillMode: "forwards" }}
        >
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500" />
            <span>Works with any guitar</span>
          </div>
        </div>

        <div
          className="animate-scale-in relative mt-20 w-full max-w-4xl opacity-0"
          style={{ animationDelay: "1000ms", animationFillMode: "forwards" }}
        >
          <div className="bg-card/50 shadow-primary/5 relative overflow-hidden rounded-2xl border p-8 shadow-2xl backdrop-blur-sm">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-[0.03]" />

            <div className="relative flex flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex size-10 items-center justify-center rounded-full">
                  <Mic className="text-primary size-5" />
                </div>
                <span className="text-muted-foreground text-sm font-medium">
                  Listening to your performance...
                </span>
              </div>

              <div className="flex h-24 items-end justify-center gap-1">
                {waveHeights.map((height, i) => (
                  <SoundWaveBar key={`wave-${i}`} delay={i * 100} height={height} />
                ))}
              </div>

              <div className="mt-4 grid w-full max-w-md grid-cols-3 gap-4 text-center">
                <div className="bg-background/50 rounded-lg p-3">
                  <div className="text-primary text-2xl font-bold">G</div>
                  <div className="text-muted-foreground text-xs">Current Note</div>
                </div>
                <div className="bg-background/50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-500">98%</div>
                  <div className="text-muted-foreground text-xs">Accuracy</div>
                </div>
                <div className="bg-background/50 rounded-lg p-3">
                  <div className="text-2xl font-bold">120</div>
                  <div className="text-muted-foreground text-xs">BPM</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-primary/20 absolute -bottom-4 left-1/2 h-8 w-3/4 -translate-x-1/2 rounded-full blur-2xl" />
        </div>
      </div>
    </section>
  )
}
