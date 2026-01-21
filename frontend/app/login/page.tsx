import LoginForm from "@/components/auth/login-form"
import HoverArrow from "@/components/ui/hover-arrow/hover-arrow"
import { Headphones, Music } from "lucide-react"
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
            transform: `rotate(${2 - i * 0.5}deg)`,
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

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen">
      <GuitarStrings />

      <FloatingNote className="top-[20%] right-[10%]" delay={600} />
      <FloatingNote className="top-[35%] left-[8%]" delay={1000} />
      <FloatingNote className="right-[15%] bottom-[25%]" delay={1400} />
      <FloatingNote className="bottom-[15%] left-[12%]" delay={1800} />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--primary)_0%,transparent_50%)] opacity-[0.06]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,var(--primary)_0%,transparent_40%)] opacity-[0.04]" />

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
              <div className="bg-primary/10 border-primary/20 mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border">
                <Music className="text-primary size-6" />
              </div>

              <h1
                className="animate-float-up font-display text-2xl font-bold tracking-tight opacity-0"
                style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
              >
                Sign in to StringFlow
              </h1>

              <p
                className="text-muted-foreground animate-float-up mt-2 text-sm opacity-0"
                style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
              >
                Continue your guitar learning journey
              </p>
            </div>

            <div
              className="animate-float-up opacity-0"
              style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
            >
              <LoginForm />
            </div>
          </div>

          <p
            className="text-muted-foreground animate-float-up mt-6 text-center text-sm opacity-0"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            Don't have an account?{" "}
            <Link
              href="/sign-up"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      <div className="bg-card/30 relative hidden w-1/2 overflow-hidden border-l lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-[0.08]" />

        <div className="relative flex h-full flex-col items-center justify-center p-12">
          <div
            className="animate-scale-in max-w-md text-center opacity-0"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            <div className="bg-primary/10 border-primary/20 mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl border">
              <Headphones className="text-primary size-8" />
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight">
              Welcome <span className="text-primary">back</span>
            </h2>

            <p className="text-muted-foreground mt-4 leading-relaxed">
              Your guitar journey continues here. Pick up right where you left off and keep
              improving your skills.
            </p>

            <div className="bg-card/50 mt-8 rounded-xl border p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Your progress</span>
                <span className="text-primary text-sm font-medium">Level 12</span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Chords mastered</span>
                    <span className="font-medium">24/32</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="bg-primary h-full w-[75%] rounded-full" />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Songs completed</span>
                    <span className="font-medium">18/50</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="h-full w-[36%] rounded-full bg-green-500" />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Practice streak</span>
                    <span className="font-medium">7 days</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="h-full w-full rounded-full bg-yellow-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
