import { Quote, Star } from "lucide-react"

const testimonials = [
  {
    quote:
      "I've tried dozens of guitar apps, but StringFlow is the first one that actually feels like having a teacher in the room. The real-time feedback changed everything for me.",
    author: "Marcus Chen",
    role: "Hobbyist Guitarist",
    rating: 5,
    highlight: "first one that actually feels like having a teacher",
  },
  {
    quote:
      "As a music teacher, I recommend StringFlow to all my students for practice between lessons. The accuracy of the note detection is remarkable.",
    author: "Sarah Mitchell",
    role: "Guitar Instructor",
    rating: 5,
    highlight: "accuracy of the note detection is remarkable",
  },
  {
    quote:
      "I went from struggling with basic chords to confidently playing songs in just a few months. The structured practice really works.",
    author: "James Rodriguez",
    role: "Beginner to Intermediate",
    rating: 5,
    highlight: "struggling with basic chords to confidently playing songs",
  },
]

const stats = [
  { value: "50K+", label: "Active Learners" },
  { value: "2M+", label: "Practice Hours" },
  { value: "4.9", label: "App Store Rating" },
  { value: "95%", label: "Accuracy Rate" },
]

function TestimonialCard({ testimonial }: { testimonial: (typeof testimonials)[0] }) {
  const parts = testimonial.quote.split(testimonial.highlight)

  return (
    <div className="group bg-card hover:border-primary/30 relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:shadow-lg">
      <Quote className="text-primary/5 absolute -top-2 -right-2 size-24 transition-transform duration-500 group-hover:scale-110" />

      <div className="relative">
        <div className="mb-4 flex gap-1">
          {[...Array(testimonial.rating)].map((_, i) => (
            <Star key={i} className="fill-primary text-primary size-4" />
          ))}
        </div>

        <blockquote className="text-foreground/90 text-base leading-relaxed">
          &ldquo;{parts[0]}
          <span className="text-primary font-medium">{testimonial.highlight}</span>
          {parts[1]}&rdquo;
        </blockquote>

        <div className="mt-6 flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full font-semibold">
            {testimonial.author[0]}
          </div>
          <div>
            <div className="font-medium">{testimonial.author}</div>
            <div className="text-muted-foreground text-sm">{testimonial.role}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingTestimonials() {
  return (
    <section id="testimonials" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,var(--background-elevated)_50%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="border-primary/20 bg-primary/5 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm">
            <span className="bg-primary size-1.5 rounded-full" />
            Testimonials
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Loved by <span className="text-primary">guitarists</span> everywhere
          </h2>

          <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
            Join thousands of musicians who have transformed their playing with StringFlow.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.author} testimonial={testimonial} />
          ))}
        </div>

        <div className="mt-20">
          <div className="bg-card/50 rounded-3xl border p-8 backdrop-blur-sm lg:p-12">
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-primary text-3xl font-bold lg:text-4xl">{stat.value}</div>
                  <div className="text-muted-foreground mt-2 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
