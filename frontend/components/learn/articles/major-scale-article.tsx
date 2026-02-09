"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ArrowRight, Eye, Lightbulb, Sparkles, Target, Zap } from "lucide-react"

interface MajorScaleArticleProps {
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

function MajorScaleDegreeCard({
  degree,
  name,
  description,
  color,
  isNew,
}: {
  degree: string
  name: string
  description: string
  color: string
  isNew?: boolean
}) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-lg">
      <div
        className={cn(
          "absolute -top-4 -right-4 size-16 rounded-full blur-2xl transition-all group-hover:scale-150",
          color,
        )}
      />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700">
          <span className="font-display text-xl font-bold text-white">{degree}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-lg font-semibold">{name}</h4>
            {isNew && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-500">
                NEW
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </Card>
  )
}

function ShapeMajorScaleCard({
  letter,
  majorScaleNoteCount,
}: {
  letter: string
  majorScaleNoteCount: number
}) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-lg">
      <div className="absolute -top-4 -right-4 size-16 rounded-full bg-gradient-to-br from-amber-500/10 to-red-500/10 blur-2xl transition-all group-hover:scale-150" />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700">
          <span className="font-display text-xl font-bold text-white">{letter}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{letter} Shape</h4>
          <p className="text-muted-foreground text-sm">
            {majorScaleNoteCount} major scale notes across the position
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function MajorScaleArticle({ onEnterPreview }: MajorScaleArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12">
      <ArticleSection>
        <ArticleHeading>The Major Scale</ArticleHeading>
        <ArticleParagraph>
          The major scale is the foundation of Western music &mdash; 7 notes that define a key. You
          already know 5 of them from the pentatonic scale. Now it&apos;s time to add the final two
          and unlock the complete picture.
        </ArticleParagraph>

        <HighlightBox icon={Target} variant="important">
          <p className="text-foreground font-medium">What you&apos;ll learn</p>
          <p className="text-muted-foreground text-sm">
            By the end of this module, you&apos;ll know all seven degrees (1, 2, 3, 4, 5, 6, 7)
            across every CAGED position. This builds on your pentatonic knowledge by adding the 4th
            and 7th.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Building on Pentatonic</ArticleSubheading>
        <ArticleParagraph>
          You already know the pentatonic notes &mdash; root, second, third, fifth, and sixth. The
          major scale simply adds two more notes: the fourth and the seventh. These are the tension
          notes that the pentatonic deliberately avoids, and they unlock a whole new level of
          expressiveness.
        </ArticleParagraph>

        <div className="bg-muted/50 flex flex-wrap items-center justify-center gap-3 rounded-xl p-6">
          <div className="text-center">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">Foundation</div>
            <div className="font-display mt-1 text-lg font-semibold">Roots</div>
            <div className="text-muted-foreground text-xs">(degree 1)</div>
          </div>
          <ArrowRight className="text-muted-foreground size-5" />
          <div className="text-center">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">Then added</div>
            <div className="font-display mt-1 text-lg font-semibold">Chord Tones</div>
            <div className="text-muted-foreground text-xs">(degrees 1, 3, 5)</div>
          </div>
          <ArrowRight className="text-muted-foreground size-5" />
          <div className="text-center">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">Then added</div>
            <div className="font-display mt-1 text-lg font-semibold">Pentatonic</div>
            <div className="text-muted-foreground text-xs">(degrees 1, 2, 3, 5, 6)</div>
          </div>
          <ArrowRight className="text-muted-foreground size-5" />
          <div className="text-center">
            <div className="text-xs tracking-wide text-amber-500 uppercase">Now</div>
            <div className="font-display mt-1 text-lg font-semibold text-amber-500">
              Major Scale
            </div>
            <div className="text-xs text-amber-500/70">(degrees 1, 2, 3, 4, 5, 6, 7)</div>
          </div>
        </div>

        <ArticleParagraph>
          Notice the progression: each module builds on the last. Your pentatonic positions now
          become major scale positions with just two additional notes to learn.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>The Seven Degrees</ArticleSubheading>
        <ArticleParagraph>
          Each note in the major scale has a unique character and function. Understanding these
          roles helps you make expressive choices when improvising.
        </ArticleParagraph>

        <div className="grid gap-3">
          <MajorScaleDegreeCard
            degree="1"
            name="Root"
            description="Home base. The anchor that defines the key."
            color="bg-amber-500/10"
          />
          <MajorScaleDegreeCard
            degree="2"
            name="Second"
            description="Smooth passing tone. Adds melodic motion between root and third."
            color="bg-orange-500/10"
          />
          <MajorScaleDegreeCard
            degree="3"
            name="Third"
            description="Major quality. The bright, happy sound that defines major tonality."
            color="bg-orange-500/10"
          />
          <MajorScaleDegreeCard
            degree="4"
            name="Fourth"
            description="Tension against the third. Creates pull that wants to resolve."
            color="bg-amber-500/10"
            isNew
          />
          <MajorScaleDegreeCard
            degree="5"
            name="Fifth"
            description="Stability. A powerful, neutral tone reinforcing the foundation."
            color="bg-red-500/10"
          />
          <MajorScaleDegreeCard
            degree="6"
            name="Sixth"
            description="Soulful color. Adds warmth and expressiveness to phrases."
            color="bg-red-500/10"
          />
          <MajorScaleDegreeCard
            degree="7"
            name="Seventh"
            description="Leading tone. Creates the strongest pull back to the root."
            color="bg-red-500/10"
            isNew
          />
        </div>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>The New Tension Notes</ArticleSubheading>
        <ArticleParagraph>
          The 4th and 7th are the notes the pentatonic scale deliberately left out. They create
          tension and movement that add depth to your playing.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 size-5 flex-shrink-0 text-amber-500" />
              <div>
                <h4 className="font-display font-semibold">The 4th Degree</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Sits a half-step above the 3rd. This close proximity creates a gravitational pull
                  &mdash; the ear wants it to resolve down to the 3rd. Use it for melodic tension
                  and movement.
                </p>
              </div>
            </div>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 size-5 flex-shrink-0 text-amber-500" />
              <div>
                <h4 className="font-display font-semibold">The 7th Degree</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  The leading tone &mdash; sits a half-step below the root. It creates the strongest
                  pull in all of music: the desire to resolve up to the tonic. This is what gives
                  melodies their sense of arrival.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <HighlightBox icon={Lightbulb} variant="tip">
          <p className="text-foreground font-medium">Why master the full major scale?</p>
          <p className="text-muted-foreground text-sm">
            The major scale unlocks modes, jazz vocabulary, and more sophisticated melodic choices.
            Every mode (Dorian, Mixolydian, etc.) is just the major scale starting on a different
            degree. Master these 7 notes and you&apos;ve built the foundation for everything else.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Major Scale Notes in Each CAGED Shape</ArticleSubheading>
        <ArticleParagraph>
          Each CAGED position contains the full 7-note major scale across its span. Because
          we&apos;re adding the 4th and 7th to your existing pentatonic knowledge, you&apos;ll
          notice even more notes to work with in each shape.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ShapeMajorScaleCard letter="C" majorScaleNoteCount={14} />
          <ShapeMajorScaleCard letter="A" majorScaleNoteCount={14} />
          <ShapeMajorScaleCard letter="G" majorScaleNoteCount={17} />
          <ShapeMajorScaleCard letter="E" majorScaleNoteCount={13} />
          <ShapeMajorScaleCard letter="D" majorScaleNoteCount={13} />
        </div>

        <ArticleParagraph>
          With all 7 notes per position, you have complete melodic freedom. The major scale patterns
          create flowing lines that connect naturally across strings, with the added tension notes
          providing direction and resolution.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>How to Practice the Major Scale</ArticleSubheading>
        <ArticleParagraph>
          Building on your pentatonic foundation, here&apos;s how to integrate the 4th and 7th into
          your playing:
        </ArticleParagraph>

        <ul className="text-muted-foreground list-inside list-disc space-y-2 text-base sm:text-lg">
          <li>Start by identifying the new notes (4th and 7th) within shapes you already know</li>
          <li>
            Play ascending and descending through all seven major scale notes in each position
          </li>
          <li>Practice connecting major scale patterns between adjacent CAGED shapes</li>
          <li>Notice how the 4th resolves down to the 3rd, and the 7th resolves up to the root</li>
          <li>
            Try improvising over a backing track, using the 4th and 7th as passing tones that
            resolve to stable notes
          </li>
        </ul>

        <HighlightBox icon={Sparkles} variant="tip">
          <p className="text-foreground font-medium">Pro Tip</p>
          <p className="text-muted-foreground text-sm">
            The 7th degree (leading tone) is incredibly powerful for creating resolution. Try
            approaching the root from a half-step below &mdash; this is one of the most common
            melodic devices in all of Western music, from classical to jazz to pop.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Ready to See the Major Scale Positions?</ArticleSubheading>
        <ArticleParagraph>
          Now that you understand the major scale and its seven essential degrees, it&apos;s time to
          visualize them on the fretboard. Switch to the preview to see how all seven notes are
          distributed across each CAGED shape.
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
