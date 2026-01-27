"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ArrowRight, Eye, Lightbulb, Target } from "lucide-react"

interface CAGEDArticleProps {
  onEnterPreview: () => void
}

function ArticleSection({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={cn("space-y-4", className)}>{children}</section>
}

function ArticleHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{children}</h2>
}

function ArticleSubheading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-xl font-semibold tracking-tight">{children}</h3>
}

function ArticleParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-base leading-relaxed sm:text-lg">{children}</p>
}

function HighlightBox({
  children,
  icon: Icon,
  variant = "default",
}: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  variant?: "default" | "tip" | "important"
}) {
  const variants = {
    default: "from-primary/5 to-primary/10 border-primary/20",
    tip: "from-emerald-500/5 to-emerald-500/10 border-emerald-500/20",
    important: "from-amber-500/5 to-amber-500/10 border-amber-500/20",
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-5",
        variants[variant],
      )}
    >
      <div className="flex gap-4">
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className="text-muted-foreground size-5" />
          </div>
        )}
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  )
}

function ShapeCard({ letter, description }: { letter: string; description: string }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-lg">
      <div className="absolute -top-4 -right-4 size-16 rounded-full bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 blur-2xl transition-all group-hover:scale-150" />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700">
          <span className="font-display text-xl font-bold text-white">{letter}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{letter} Shape</h4>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </Card>
  )
}

export default function CAGEDArticle({ onEnterPreview }: CAGEDArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12">
      <ArticleSection>
        <ArticleHeading>Understanding the CAGED System</ArticleHeading>
        <ArticleParagraph>
          The CAGED system is one of the most powerful frameworks for understanding the guitar
          fretboard. It reveals how five basic open chord shapes connect across the entire neck,
          giving you a roadmap for playing in any key, anywhere on the guitar.
        </ArticleParagraph>

        <HighlightBox icon={Target} variant="important">
          <p className="text-foreground font-medium">What you&apos;ll learn</p>
          <p className="text-muted-foreground text-sm">
            By the end of this module, you&apos;ll be able to identify root notes across the
            fretboard using five interconnected shapes, forming the foundation for scales, chords,
            and improvisation.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>The Five Shapes</ArticleSubheading>
        <ArticleParagraph>
          CAGED stands for the five basic open chord shapes: C, A, G, E, and D. Each shape has a
          unique pattern of root notes that spans a specific area of the fretboard.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ShapeCard
            letter="C"
            description="Root on the 5th string, spanning frets 0-3 in open position"
          />
          <ShapeCard
            letter="A"
            description="Root on the 5th string, spanning frets 2-5 in open position"
          />
          <ShapeCard
            letter="G"
            description="Root on the 6th string, spanning frets 2-5 in open position"
          />
          <ShapeCard
            letter="E"
            description="Root on the 6th string, spanning frets 0-3 in open position"
          />
          <ShapeCard
            letter="D"
            description="Root on the 4th string, spanning frets 0-3 in open position"
          />
        </div>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>How the Shapes Connect</ArticleSubheading>
        <ArticleParagraph>
          The magic of CAGED is how these shapes link together seamlessly. As you move up the neck,
          one shape transitions into the next in a repeating sequence: C → A → G → E → D → C...
        </ArticleParagraph>

        <div className="bg-muted/50 flex items-center justify-center gap-2 rounded-xl p-6">
          {["C", "A", "G", "E", "D"].map((letter, index) => (
            <div key={letter} className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700">
                <span className="font-display text-sm font-bold text-white">{letter}</span>
              </div>
              {index < 4 && <ArrowRight className="text-muted-foreground size-4" />}
            </div>
          ))}
        </div>

        <ArticleParagraph>
          This sequence repeats indefinitely up the neck. Understanding this connection means you
          can find any chord or scale pattern starting from any of the five shapes.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Why Root Notes Matter</ArticleSubheading>
        <ArticleParagraph>
          Root notes are the foundation of everything in music theory. They define the key
          you&apos;re playing in and serve as anchor points for building chords, scales, and
          melodies. In the CAGED system, knowing where your root notes are helps you:
        </ArticleParagraph>

        <ul className="text-muted-foreground list-inside list-disc space-y-2 text-base sm:text-lg">
          <li>Instantly find chord voicings anywhere on the neck</li>
          <li>Build scale patterns around familiar shapes</li>
          <li>Navigate key changes while improvising</li>
          <li>Communicate more effectively with other musicians</li>
        </ul>

        <HighlightBox icon={Lightbulb} variant="tip">
          <p className="text-foreground font-medium">Pro Tip</p>
          <p className="text-muted-foreground text-sm">
            Start by memorizing the root note positions. Once you can find them instantly, adding
            chord tones and scale degrees becomes much easier.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Ready to Explore?</ArticleSubheading>
        <ArticleParagraph>
          Now that you understand the concept, it&apos;s time to see the CAGED roots in action.
          Switch to the fretboard preview to visualize how these patterns connect across the neck.
        </ArticleParagraph>

        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={onEnterPreview} className="h-14 px-8 text-lg">
            <Eye className="mr-2 size-5" />
            View Fretboard Preview
          </Button>
        </div>
      </ArticleSection>
    </article>
  )
}
