import SignupForm from "@/components/auth/signup-form"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import { Music } from "lucide-react"
import Link from "next/link"

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
      <Music className="text-primary/30 size-6" />
    </div>
  )
}

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen">
      <GuitarStrings />

      <FloatingNote className="top-[15%] left-[8%]" delay={600} />
      <FloatingNote className="top-[25%] right-[12%]" delay={1000} />
      <FloatingNote className="bottom-[30%] left-[15%]" delay={1400} />
      <FloatingNote className="right-[8%] bottom-[20%]" delay={1800} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--primary)_0%,transparent_50%)] opacity-[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--primary)_0%,transparent_40%)] opacity-[0.04]" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div
          className="animate-float-up w-full max-w-md opacity-0"
          style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
        >
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground group mb-8 inline-flex items-center gap-2 text-sm transition-colors"
          >
            <HoverArrow className="size-3 rotate-180" />
            Back to home
          </Link>

          <div className="bg-card/60 rounded-2xl border p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-8 text-center">
              <div
                className="bg-primary/10 border-primary/20 mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border"
                style={{ animationDelay: "200ms" }}
              >
                <Music className="text-primary size-6" />
              </div>

              <h1
                className="animate-float-up font-display text-2xl font-bold tracking-tight opacity-0"
                style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
              >
                Start your journey
              </h1>

              <p
                className="text-muted-foreground animate-float-up mt-2 text-sm opacity-0"
                style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
              >
                Create your account and begin learning guitar
              </p>
            </div>

            <div
              className="animate-float-up opacity-0"
              style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
            >
              <SignupForm />
            </div>
          </div>

          <p
            className="text-muted-foreground animate-float-up mt-6 text-center text-sm opacity-0"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-card/30 relative hidden w-1/2 overflow-hidden border-l lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-[0.08]" />

        <div className="relative flex h-full flex-col items-center justify-center p-12">
          <div
            className="animate-scale-in max-w-md text-center opacity-0"
            style={{ animationDelay: "600ms", animationFillMode: "forwards" }}
          >
            <div className="mb-8 flex justify-center gap-1">
              {[20, 35, 50, 70, 85, 70, 50, 35, 20].map((height, i) => (
                <div
                  key={i}
                  className="bg-primary/60 animate-wave-pulse w-1 rounded-full"
                  style={{
                    height: `${height}px`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight">
              Learn at your own <span className="text-primary">pace</span>
            </h2>

            <p className="text-muted-foreground mt-4 leading-relaxed">
              StringFlow listens to you play and provides instant feedback. Whether you're picking
              up a guitar for the first time or refining your skills, we adapt to your level.
            </p>

            <div className="mt-8 flex justify-center gap-6">
              <div className="text-center">
                <div className="text-primary text-2xl font-bold">10k+</div>
                <div className="text-muted-foreground text-xs">Active learners</div>
              </div>
              <div className="bg-border h-12 w-px" />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">98%</div>
                <div className="text-muted-foreground text-xs">Satisfaction rate</div>
              </div>
              <div className="bg-border h-12 w-px" />
              <div className="text-center">
                <div className="text-2xl font-bold">500+</div>
                <div className="text-muted-foreground text-xs">Lessons</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
