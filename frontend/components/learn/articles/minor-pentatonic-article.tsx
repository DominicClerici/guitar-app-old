"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ArrowRight, Eye, Lightbulb, Music, Sparkles, Target, XCircle } from "lucide-react"

interface MinorPentatonicArticleProps {
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

function PentatonicDegreeCard({
  degree,
  name,
  description,
  color,
}: {
  degree: string
  name: string
  description: string
  color: string
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
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700">
          <span className="font-display text-xl font-bold text-white">{degree}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{name}</h4>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </Card>
  )
}

function ShapePentatonicCard({
  letter,
  pentatonicNoteCount,
}: {
  letter: string
  pentatonicNoteCount: number
}) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-lg">
      <div className="absolute -top-4 -right-4 size-16 rounded-full bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 blur-2xl transition-all group-hover:scale-150" />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700">
          <span className="font-display text-xl font-bold text-white">{letter}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{letter} Shape</h4>
          <p className="text-muted-foreground text-sm">
            {pentatonicNoteCount} pentatonic notes across the position
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function MinorPentatonicArticle({ onEnterPreview }: MinorPentatonicArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12">
      <ArticleSection>
        <ArticleHeading>The Minor Pentatonic Scale</ArticleHeading>
        <ArticleParagraph>
          The pentatonic scale is one of the most widely used scales in music, and for good reason.
          With just five notes, it creates melodies that sound musical and natural across almost any
          chord progression. From blues legends to rock icons, this scale has been the foundation of
          countless memorable solos.
        </ArticleParagraph>

        <HighlightBox icon={Target} variant="important">
          <p className="text-foreground font-medium">What you&apos;ll learn</p>
          <p className="text-muted-foreground text-sm">
            By the end of this module, you&apos;ll know all five pentatonic notes (1, 2, 3, 5, 6)
            across every CAGED position. This builds directly on your chord tone knowledge, adding
            two more expressive notes to your vocabulary.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Building on Chord Tones</ArticleSubheading>
        <ArticleParagraph>
          You already know the chord tones &mdash; root, third, and fifth. The pentatonic scale
          simply adds two more notes: the second and the sixth. This creates a complete melodic
          toolkit that flows smoothly across the fretboard.
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
            <div className="text-xs tracking-wide text-rose-500 uppercase">Now</div>
            <div className="font-display mt-1 text-lg font-semibold text-rose-500">Pentatonic</div>
            <div className="text-xs text-rose-500/70">(degrees 1, 2, 3, 5, 6)</div>
          </div>
        </div>

        <ArticleParagraph>
          Notice the progression: each module builds on the last. Your chord tone positions now
          become pentatonic positions with just two additional notes to learn.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>The Five Degrees</ArticleSubheading>
        <ArticleParagraph>
          Each note in the pentatonic scale has a unique character and function. Understanding these
          roles helps you make expressive choices when improvising.
        </ArticleParagraph>

        <div className="grid gap-3">
          <PentatonicDegreeCard
            degree="1"
            name="Root"
            description="Home base. The anchor that defines the key and provides maximum resolution."
            color="bg-rose-500/10"
          />
          <PentatonicDegreeCard
            degree="2"
            name="Second"
            description="Melodic sweetness. Adds smooth motion and a gentle, lyrical quality to phrases."
            color="bg-pink-500/10"
          />
          <PentatonicDegreeCard
            degree="3"
            name="Third"
            description="Major quality. The bright, happy sound that defines the major character of the scale."
            color="bg-fuchsia-500/10"
          />
          <PentatonicDegreeCard
            degree="5"
            name="Fifth"
            description="Stability. A powerful, neutral tone that reinforces the harmonic foundation."
            color="bg-purple-500/10"
          />
          <PentatonicDegreeCard
            degree="6"
            name="Sixth"
            description="Soulful color. Adds warmth and expressiveness, a favorite for melodic phrases."
            color="bg-violet-500/10"
          />
        </div>

        <HighlightBox icon={Music} variant="default">
          <p className="text-foreground font-medium">Why pentatonic sounds so good</p>
          <p className="text-muted-foreground text-sm">
            These five notes are carefully chosen to avoid dissonance. No matter what order you play
            them, they create pleasant melodies. This is why pentatonic is often called a
            &ldquo;safe&rdquo; scale &mdash; it&apos;s hard to play a wrong note.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Why No 4th or 7th?</ArticleSubheading>
        <ArticleParagraph>
          The major scale has seven notes, but pentatonic only uses five. The 4th and 7th degrees
          are deliberately left out because they can create tension against common chord tones.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-5 flex-shrink-0 text-rose-500" />
              <div>
                <h4 className="font-display font-semibold">The 4th Degree</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Creates a half-step clash with the 3rd. Over a major chord, this can sound
                  unresolved or tense.
                </p>
              </div>
            </div>
          </Card>
          <Card className="border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 size-5 flex-shrink-0 text-rose-500" />
              <div>
                <h4 className="font-display font-semibold">The 7th Degree</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Creates strong tension wanting to resolve to the root. Great for jazz, but adds
                  complexity to simple phrases.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <HighlightBox icon={Sparkles} variant="tip">
          <p className="text-foreground font-medium">The &ldquo;avoid note&rdquo; concept</p>
          <p className="text-muted-foreground text-sm">
            Musicians call the 4th and 7th &ldquo;avoid notes&rdquo; over major chords &mdash; not
            because they&apos;re bad, but because they require more care to use effectively. The
            pentatonic scale removes them entirely, giving you a foolproof melodic palette.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Pentatonic Notes in Each CAGED Shape</ArticleSubheading>
        <ArticleParagraph>
          Each CAGED position contains multiple pentatonic notes spread across its span. Because
          we&apos;re adding the 2nd and 6th to your existing chord tone knowledge, you&apos;ll
          notice more notes to work with in each shape.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ShapePentatonicCard letter="C" pentatonicNoteCount={12} />
          <ShapePentatonicCard letter="A" pentatonicNoteCount={14} />
          <ShapePentatonicCard letter="G" pentatonicNoteCount={14} />
          <ShapePentatonicCard letter="E" pentatonicNoteCount={14} />
          <ShapePentatonicCard letter="D" pentatonicNoteCount={11} />
        </div>

        <ArticleParagraph>
          With more notes per position, you have greater melodic freedom. The pentatonic patterns
          create flowing lines that connect naturally across strings.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>How to Practice Pentatonic</ArticleSubheading>
        <ArticleParagraph>
          Building on your chord tone foundation, here&apos;s how to integrate the 2nd and 6th into
          your playing:
        </ArticleParagraph>

        <ul className="text-muted-foreground list-inside list-disc space-y-2 text-base sm:text-lg">
          <li>Start by identifying the new notes (2nd and 6th) within shapes you already know</li>
          <li>Play ascending and descending through all five pentatonic notes in each position</li>
          <li>Practice connecting pentatonic patterns between adjacent CAGED shapes</li>
          <li>Try simple improvisation over a backing track using only pentatonic notes</li>
          <li>
            Focus on targeting chord tones on strong beats, using 2nd and 6th as passing notes
          </li>
        </ul>

        <HighlightBox icon={Lightbulb} variant="tip">
          <p className="text-foreground font-medium">Pro Tip</p>
          <p className="text-muted-foreground text-sm">
            The 6th degree is especially expressive. Try ending phrases on it instead of the root
            for a more soulful, unresolved sound. Many blues and country licks feature the 6th
            prominently.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Ready to See the Pentatonic Positions?</ArticleSubheading>
        <ArticleParagraph>
          Now that you understand the pentatonic scale and its five essential degrees, it&apos;s
          time to visualize them on the fretboard. Switch to the preview to see how all five notes
          are distributed across each CAGED shape.
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
