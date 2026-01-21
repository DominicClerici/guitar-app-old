import { ArrowRight, Cable, Headphones, Mic, Play, Sparkles } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: Mic,
    title: "Connect Your Input",
    description:
      "Use your computer's microphone, a USB guitar interface, or even your phone. StringFlow adapts to your setup.",
    visual: (
      <div className="flex items-center justify-center gap-4">
        <div className="border-primary/30 bg-primary/5 flex size-14 items-center justify-center rounded-xl border-2 border-dashed">
          <Mic className="text-primary size-6" />
        </div>
        <div className="text-muted-foreground">or</div>
        <div className="border-primary/30 bg-primary/5 flex size-14 items-center justify-center rounded-xl border-2 border-dashed">
          <Cable className="text-primary size-6" />
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: Play,
    title: "Play Along",
    description:
      "Follow interactive exercises, practice scales, learn songs, or freestyle while StringFlow listens to every note.",
    visual: (
      <div className="flex items-center gap-1">
        {["E", "A", "D", "G", "B", "E"].map((note, i) => (
          <div
            key={i}
            className="bg-primary/10 text-primary flex h-12 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold"
          >
            {note}
          </div>
        ))}
      </div>
    ),
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Get Instant Feedback",
    description:
      "See real-time analysis of your playing. StringFlow highlights what you nailed and where you can improve.",
    visual: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
            <div className="h-full w-[85%] rounded-full bg-green-500" />
          </div>
          <span className="text-sm text-green-500">Timing</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-[92%] rounded-full" />
          </div>
          <span className="text-primary text-sm">Pitch</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
            <div className="h-full w-[78%] rounded-full bg-yellow-500" />
          </div>
          <span className="text-sm text-yellow-500">Technique</span>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    icon: Headphones,
    title: "Level Up",
    description:
      "Track your progress over time, unlock achievements, and watch yourself transform from beginner to guitarist.",
    visual: (
      <div className="flex items-end gap-2">
        {[40, 55, 45, 65, 80, 75, 95].map((height, i) => (
          <div key={i} className="bg-primary/20 w-6 rounded-t-sm" style={{ height: `${height}%` }}>
            <div
              className="bg-primary w-full rounded-t-sm"
              style={{ height: `${Math.min(100, height + 10)}%` }}
            />
          </div>
        ))}
      </div>
    ),
  },
]

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="border-primary/20 bg-primary/5 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
            <span className="bg-primary size-1.5 rounded-full" />
            How It Works
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Start playing in <span className="text-primary">minutes</span>
          </h2>

          <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
            No complicated setup. No expensive equipment. Just you, your guitar, and StringFlow.
          </p>
        </div>

        <div className="mt-20">
          <div className="relative">
            <div className="via-primary/30 absolute top-0 left-8 hidden h-full w-px bg-gradient-to-b from-transparent to-transparent lg:left-1/2 lg:block" />

            <div className="space-y-12 lg:space-y-24">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isEven = index % 2 === 0

                return (
                  <div key={step.number} className="relative">
                    <div
                      className={`flex flex-col items-center gap-8 lg:flex-row ${isEven ? "" : "lg:flex-row-reverse"}`}
                    >
                      <div
                        className={`flex-1 ${isEven ? "lg:pr-16 lg:text-right" : "lg:pl-16 lg:text-left"}`}
                      >
                        <div
                          className={`inline-flex items-center gap-3 ${isEven ? "lg:flex-row-reverse" : ""}`}
                        >
                          <span className="text-primary font-mono text-sm">{step.number}</span>
                          <ArrowRight
                            className={`text-muted-foreground size-4 ${isEven ? "lg:rotate-180" : ""}`}
                          />
                        </div>

                        <h3 className="mt-4 text-2xl font-bold">{step.title}</h3>

                        <p className="text-muted-foreground mt-3">{step.description}</p>
                      </div>

                      <div className="bg-card shadow-primary/10 relative z-10 flex size-16 shrink-0 items-center justify-center rounded-2xl border shadow-lg">
                        <Icon className="text-primary size-7" />
                      </div>

                      <div className="bg-card/50 flex h-32 flex-1 items-center justify-center rounded-2xl border p-6">
                        {step.visual}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
