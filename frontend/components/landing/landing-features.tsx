import { AudioLines, Brain, Gauge, Guitar, Music2, Target } from "lucide-react"

const features = [
  {
    icon: AudioLines,
    title: "Real-Time Listening",
    description:
      "Connect your microphone or guitar input and StringFlow instantly recognizes what you're playing with incredible accuracy.",
  },
  {
    icon: Brain,
    title: "Intelligent Feedback",
    description:
      "Get personalized tips based on your playing style. Our AI understands your strengths and areas for improvement.",
  },
  {
    icon: Target,
    title: "Guided Practice",
    description:
      "Follow structured lessons that adapt to your skill level. Never practice the wrong thing again.",
  },
  {
    icon: Gauge,
    title: "Progress Tracking",
    description:
      "Visualize your improvement over time with detailed analytics on accuracy, timing, and technique.",
  },
  {
    icon: Music2,
    title: "Scale & Chord Library",
    description:
      "Master scales, chords, and progressions with interactive exercises that respond to your playing.",
  },
  {
    icon: Guitar,
    title: "Works With Any Guitar",
    description:
      "Acoustic, electric, classical — StringFlow works with any guitar, with or without additional hardware.",
  },
]

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const Icon = feature.icon

  return (
    <div
      className="group bg-card/50 hover:border-landing-accent/30 hover:shadow-landing-accent/5 relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg"
      style={{
        animationDelay: `${index * 100}ms`,
      }}
    >
      <div className="bg-landing-accent/5 absolute -top-8 -right-8 size-32 rounded-full transition-transform duration-500 group-hover:scale-150" />

      <div className="relative">
        <div className="bg-landing-accent/10 group-hover:bg-landing-accent/20 mb-4 flex size-12 items-center justify-center rounded-xl transition-colors duration-300">
          <Icon className="text-landing-accent size-6" />
        </div>

        <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>

        <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
      </div>
    </div>
  )
}

export default function LandingFeatures() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,var(--background-elevated)_50%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="border-landing-accent/20 bg-landing-accent/5 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
            <span className="bg-landing-accent size-1.5 rounded-full" />
            Features
          </div>

          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Everything you need to <span className="text-landing-accent">master the guitar</span>
          </h2>

          <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
            StringFlow combines cutting-edge audio recognition with proven teaching methods to
            create the most effective guitar learning experience.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
