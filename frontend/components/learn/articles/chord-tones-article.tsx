"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { ArrowRight, Eye, Lightbulb, Music, Target } from "lucide-react"

interface ChordTonesArticleProps {
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

function ChordToneCard({
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
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700">
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

function ShapeChordToneCard({
  letter,
  chordToneCount,
}: {
  letter: string
  chordToneCount: number
}) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-all hover:shadow-lg">
      <div className="absolute -top-4 -right-4 size-16 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 blur-2xl transition-all group-hover:scale-150" />
      <div className="relative z-10 flex items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700">
          <span className="font-display text-xl font-bold text-white">{letter}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{letter} Shape</h4>
          <p className="text-muted-foreground text-sm">
            {chordToneCount} chord tones across the position
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function ChordTonesArticle({ onEnterPreview }: ChordTonesArticleProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12">
      <ArticleSection>
        <ArticleHeading>Understanding Chord Tones</ArticleHeading>
        <ArticleParagraph>
          Chord tones are the essential notes that define a chord&apos;s sound. They&apos;re your
          harmonic anchors when improvising, composing, or navigating chord changes. Mastering chord
          tones transforms how you hear and play music on the guitar.
        </ArticleParagraph>

        <HighlightBox icon={Target} variant="important">
          <p className="text-foreground font-medium">What you&apos;ll learn</p>
          <p className="text-muted-foreground text-sm">
            By the end of this module, you&apos;ll be able to locate the root, third, and fifth of
            any major chord across all five CAGED positions. These three notes form the foundation
            of melodic playing over chord changes.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Building on CAGED Roots</ArticleSubheading>
        <ArticleParagraph>
          You&apos;ve already learned to find root notes using the CAGED system. Now we&apos;re
          expanding that knowledge by adding two more essential notes: the third and the fifth.
          Together with the root, these three notes form a triad &mdash; the building block of
          Western harmony.
        </ArticleParagraph>

        <div className="bg-muted/50 flex items-center justify-center gap-3 rounded-xl p-6">
          <div className="text-center">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">You know</div>
            <div className="font-display mt-1 text-lg font-semibold">Roots</div>
          </div>
          <ArrowRight className="text-muted-foreground size-5" />
          <div className="text-center">
            <div className="text-muted-foreground text-xs tracking-wide uppercase">Now adding</div>
            <div className="font-display mt-1 text-lg font-semibold">3rds & 5ths</div>
          </div>
          <ArrowRight className="text-muted-foreground size-5" />
          <div className="text-center">
            <div className="text-xs tracking-wide text-violet-500 uppercase">Result</div>
            <div className="font-display mt-1 text-lg font-semibold text-violet-500">
              Full Triads
            </div>
          </div>
        </div>

        <ArticleParagraph>
          Think of it as upgrading from a single anchor point to a complete harmonic map. Every
          chord shape you learned now reveals multiple target notes for your melodies.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>The Major Triad</ArticleSubheading>
        <ArticleParagraph>
          A major triad consists of three notes, each with a specific function and sound quality.
          Understanding these roles helps you make musical choices when improvising.
        </ArticleParagraph>

        <div className="grid gap-3">
          <ChordToneCard
            degree="1"
            name="Root"
            description="The home base. The note that names the chord and provides maximum stability."
            color="bg-violet-500/10"
          />
          <ChordToneCard
            degree="3"
            name="Third"
            description="Defines major vs minor quality. This is the 'happy' or 'bright' sound in a major chord."
            color="bg-purple-500/10"
          />
          <ChordToneCard
            degree="5"
            name="Fifth"
            description="Adds stability and fullness. A neutral, supportive tone that reinforces the chord."
            color="bg-indigo-500/10"
          />
        </div>

        <HighlightBox icon={Music} variant="default">
          <p className="text-foreground font-medium">Why chord tones matter for improvisation</p>
          <p className="text-muted-foreground text-sm">
            When you land on chord tones during a solo, your phrases sound intentional and connected
            to the harmony. They&apos;re safe landing spots that always sound good over the
            underlying chord.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Chord Tones in Each CAGED Shape</ArticleSubheading>
        <ArticleParagraph>
          Each CAGED shape contains multiple chord tones spread across its position. Learning where
          these notes fall within each shape gives you instant access to melodic target notes
          anywhere on the fretboard.
        </ArticleParagraph>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ShapeChordToneCard letter="C" chordToneCount={8} />
          <ShapeChordToneCard letter="A" chordToneCount={9} />
          <ShapeChordToneCard letter="G" chordToneCount={9} />
          <ShapeChordToneCard letter="E" chordToneCount={9} />
          <ShapeChordToneCard letter="D" chordToneCount={7} />
        </div>

        <ArticleParagraph>
          Notice how the number of chord tones varies slightly between shapes. This is because each
          shape covers a different span of the fretboard with varying string coverage.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>How to Practice Chord Tones</ArticleSubheading>
        <ArticleParagraph>
          Effective practice builds both visual recognition and aural familiarity. Here&apos;s a
          proven approach:
        </ArticleParagraph>

        <ul className="text-muted-foreground list-inside list-disc space-y-2 text-base sm:text-lg">
          <li>Start with one shape and one key until the positions feel automatic</li>
          <li>Play the chord tones in order: root, third, fifth (this is called an arpeggio)</li>
          <li>Practice ascending and descending through the position</li>
          <li>Sing or hum each note as you play to internalize the sound</li>
          <li>Move to different keys using the same shape before learning new shapes</li>
        </ul>

        <HighlightBox icon={Lightbulb} variant="tip">
          <p className="text-foreground font-medium">Pro Tip</p>
          <p className="text-muted-foreground text-sm">
            When improvising, try targeting chord tones on strong beats (beats 1 and 3). Use other
            scale notes as passing tones to connect your chord tone targets. This creates phrases
            that sound melodic and intentional.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="my-8" />

      <ArticleSection>
        <ArticleSubheading>Ready to See the Chord Tones?</ArticleSubheading>
        <ArticleParagraph>
          Now that you understand what chord tones are and why they matter, it&apos;s time to
          visualize them on the fretboard. Switch to the preview to see how the root, third, and
          fifth are distributed across each CAGED shape.
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
