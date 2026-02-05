"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  BookOpen,
  Eye,
  Headphones,
  Lightbulb,
  Music,
  Sparkles,
  Target,
  Zap,
} from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  ArticleSubheading,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type CagedShapeLetter,
  type FretPosition,
} from "./article-primitives"

interface ChordTonesArticleProps {
  onEnterPreview: () => void
}

function MajorScaleIntervals() {
  const intervals = [
    { degree: "1", name: "Root", isChordTone: true, semitones: 0 },
    { degree: "2", name: "Second", isChordTone: false, semitones: 2 },
    { degree: "3", name: "Third", isChordTone: true, semitones: 4 },
    { degree: "4", name: "Fourth", isChordTone: false, semitones: 5 },
    { degree: "5", name: "Fifth", isChordTone: true, semitones: 7 },
    { degree: "6", name: "Sixth", isChordTone: false, semitones: 9 },
    { degree: "7", name: "Seventh", isChordTone: false, semitones: 11 },
  ]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 p-6 sm:p-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -top-32 -right-32 size-64 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 size-64 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 blur-3xl" />

      <div className="relative">
        <p className="text-muted-foreground mb-6 text-center text-sm font-medium">
          The Major Scale &mdash; Chord Tones Highlighted
        </p>

        {/* Scale degrees visual */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {intervals.map((interval, index) => (
            <div key={interval.degree} className="flex items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "relative flex size-12 items-center justify-center rounded-xl transition-all sm:size-14 sm:rounded-2xl",
                  interval.isChordTone
                    ? "bg-gradient-to-br shadow-lg ring-2 ring-white/20"
                    : "bg-white/5 ring-1 ring-white/10",
                  interval.degree === "1" && "from-emerald-500 to-teal-600 shadow-emerald-500/30",
                  interval.degree === "3" && "from-amber-500 to-orange-600 shadow-amber-500/30",
                  interval.degree === "5" && "from-sky-500 to-blue-600 shadow-sky-500/30",
                )}
              >
                <span
                  className={cn(
                    "font-display text-lg font-bold sm:text-xl",
                    interval.isChordTone ? "text-white" : "text-muted-foreground",
                  )}
                >
                  {interval.degree}
                </span>
                {interval.isChordTone && (
                  <div className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-white shadow-sm">
                    <Sparkles className="size-2.5 text-violet-600" />
                  </div>
                )}
              </div>
              {index < intervals.length - 1 && (
                <div className="text-muted-foreground/30 hidden sm:block">—</div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-gradient-to-br from-emerald-500 to-teal-600" />
            <span className="text-muted-foreground text-sm">Root (1)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-gradient-to-br from-amber-500 to-orange-600" />
            <span className="text-muted-foreground text-sm">Third (3)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-gradient-to-br from-sky-500 to-blue-600" />
            <span className="text-muted-foreground text-sm">Fifth (5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-white/10 ring-1 ring-white/20" />
            <span className="text-muted-foreground text-sm">Other scale degrees</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TriadConstruction() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <ArticleParagraph>
          A <strong className="text-foreground">triad</strong> is the simplest form of a chord
          &mdash; just three notes stacked together. These aren&apos;t random notes; they&apos;re
          the 1st, 3rd, and 5th degrees of a scale.
        </ArticleParagraph>
        <ArticleParagraph>
          When you play a C major chord, you&apos;re playing the notes C, E, and G. That&apos;s the
          root (C), the major third (E), and the perfect fifth (G). Every major chord follows this
          exact formula.
        </ArticleParagraph>
      </div>

      <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground text-sm font-medium">C Major Triad Example</p>
          <div className="flex items-end justify-center gap-3">
            <div className="space-y-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <span className="font-display text-xl font-bold text-white">C</span>
              </div>
              <p className="text-muted-foreground text-xs">Root</p>
            </div>
            <div className="text-muted-foreground/50 pb-6">+</div>
            <div className="space-y-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <span className="font-display text-xl font-bold text-white">E</span>
              </div>
              <p className="text-muted-foreground text-xs">Third</p>
            </div>
            <div className="text-muted-foreground/50 pb-6">+</div>
            <div className="space-y-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/25">
                <span className="font-display text-xl font-bold text-white">G</span>
              </div>
              <p className="text-muted-foreground text-xs">Fifth</p>
            </div>
            <div className="text-muted-foreground/50 pb-6">=</div>
            <div className="space-y-2">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <span className="font-display text-lg font-bold text-white">C</span>
              </div>
              <p className="text-muted-foreground text-xs">Chord</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChordToneCard({
  degree,
  name,
  description,
  color,
  shadowColor,
}: {
  degree: string
  name: string
  description: string
  color: string
  shadowColor: string
}) {
  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 p-0">
      <div
        className={cn(
          "absolute -top-10 -right-10 size-24 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-all group-hover:scale-150 group-hover:opacity-30",
          color,
        )}
      />
      <div className="relative z-10 flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
            color,
            shadowColor,
          )}
        >
          <span className="font-display text-2xl font-bold text-white">{degree}</span>
        </div>
        <div className="flex-1">
          <h4 className="font-display text-lg font-semibold">{name}</h4>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
    </Card>
  )
}

function BuildingOnRoots() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent_70%)]" />

      <div className="relative">
        <p className="text-muted-foreground mb-6 text-center text-sm font-medium">
          Your CAGED Knowledge Evolution
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 ring-2 ring-emerald-500/30">
              <span className="font-display text-2xl font-bold text-emerald-400">R</span>
            </div>
            <p className="text-foreground font-medium">Roots</p>
            <p className="text-muted-foreground text-xs">You know this!</p>
          </div>

          <ArrowRight className="text-muted-foreground/50 size-6" />

          <div className="text-center">
            <div className="flex gap-2">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                <span className="font-display text-2xl font-bold text-white">1</span>
              </div>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
                <span className="font-display text-2xl font-bold text-white">3</span>
              </div>
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/25">
                <span className="font-display text-2xl font-bold text-white">5</span>
              </div>
            </div>
            <p className="text-foreground mt-3 font-medium">Full Triads</p>
            <p className="text-muted-foreground text-xs">Learning now</p>
          </div>

          <ArrowRight className="text-muted-foreground/50 size-6" />

          <div className="text-center">
            <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 ring-2 ring-violet-500/30">
              <Music className="size-7 text-violet-400" />
            </div>
            <p className="text-foreground font-medium">Melodic Freedom</p>
            <p className="text-muted-foreground text-xs">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const CAGED_CHORD_TONES: Record<CagedShapeLetter, FretPosition[]> = {
  C: [
    { string: 4, fret: 3, degree: "1" },
    { string: 3, fret: 2, degree: "5" },
    { string: 2, fret: 0, degree: "3" },
    { string: 1, fret: 1, degree: "1" },
    { string: 0, fret: 0, degree: "5" },
  ],
  A: [
    { string: 4, fret: 0, degree: "1" },
    { string: 3, fret: 2, degree: "5" },
    { string: 2, fret: 2, degree: "1" },
    { string: 1, fret: 2, degree: "3" },
    { string: 0, fret: 0, degree: "5" },
  ],
  G: [
    { string: 5, fret: 3, degree: "1" },
    { string: 4, fret: 2, degree: "3" },
    { string: 3, fret: 0, degree: "5" },
    { string: 2, fret: 0, degree: "1" },
    { string: 1, fret: 0, degree: "3" },
    { string: 0, fret: 3, degree: "1" },
  ],
  E: [
    { string: 5, fret: 0, degree: "1" },
    { string: 4, fret: 2, degree: "5" },
    { string: 3, fret: 2, degree: "1" },
    { string: 2, fret: 1, degree: "3" },
    { string: 1, fret: 0, degree: "5" },
    { string: 0, fret: 0, degree: "1" },
  ],
  D: [
    { string: 3, fret: 0, degree: "1" },
    { string: 2, fret: 2, degree: "5" },
    { string: 1, fret: 3, degree: "1" },
    { string: 0, fret: 2, degree: "3" },
  ],
}

const SHAPE_DESCRIPTIONS: Record<CagedShapeLetter, string> = {
  C: "Roots on A and B strings, wide stretch shape",
  A: "Compact barre shape, roots on A and G strings",
  G: "Wide span with roots on both E strings and G",
  E: "Most common barre chord, roots on E and D strings",
  D: "Upper register shape, roots on D and B strings",
}

function CAGEDChordToneCard({ letter }: { letter: CagedShapeLetter }) {
  const colors = CAGED_SHAPE_COLORS[letter]
  const positions = CAGED_CHORD_TONES[letter]
  const description = SHAPE_DESCRIPTIONS[letter]

  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 p-0">
      <div
        className={cn(
          "absolute -top-20 -right-20 size-40 rounded-full bg-gradient-to-br opacity-20 blur-3xl transition-all group-hover:scale-150 group-hover:opacity-30",
          colors.bgGlow,
        )}
      />

      <div className="relative z-10 p-6">
        <div className="mb-5 flex items-start gap-4">
          <div
            className={cn(
              "flex size-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
              colors.color,
              colors.shadowColor,
            )}
          >
            <span className="font-display text-2xl font-bold text-white">{letter}</span>
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold">{letter} Shape</h4>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>

        <FretboardDiagram
          positions={positions}
          highlightFrets={[0, 4]}
          title={`Chord tones in ${letter} shape`}
          showDegreeLabels={true}
        />

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {(["1", "3", "5"] as const).map((degree) => {
            const count = positions.filter((p) => p.degree === degree).length
            const label = degree === "1" ? "Roots" : degree === "3" ? "Thirds" : "Fifths"
            const colors =
              degree === "1"
                ? "bg-emerald-500/20 text-emerald-400"
                : degree === "3"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-sky-500/20 text-sky-400"
            return (
              <div
                key={degree}
                className={cn("rounded-full px-3 py-1 text-xs font-medium", colors)}
              >
                {count} {label}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function WhyChordTonesMatter() {
  const reasons = [
    {
      icon: Target,
      title: "Target notes for solos",
      description:
        "Land on chord tones during strong beats to make your solos sound intentional and connected to the harmony",
    },
    {
      icon: Headphones,
      title: "Hear the changes",
      description:
        "Training your ear to recognize chord tones helps you navigate chord progressions by sound, not just shapes",
    },
    {
      icon: Zap,
      title: "Foundation for arpeggios",
      description:
        "Chord tones are arpeggios. Master these, and you're already soloing with the most powerful melodic tool",
    },
    {
      icon: Sparkles,
      title: "Create melodic tension",
      description:
        "Knowing where chord tones are lets you intentionally create and resolve tension in your playing",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reasons.map((reason) => (
        <div
          key={reason.title}
          className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
              <reason.icon className="size-5 text-violet-400" />
            </div>
            <p className="font-semibold">{reason.title}</p>
          </div>
          <p className="text-muted-foreground text-sm">{reason.description}</p>
        </div>
      ))}
    </div>
  )
}

function PracticePreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-indigo-500/5 p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-20 -right-20 size-40 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 size-40 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
            <Target className="size-6 text-white" />
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold">Your Practice Session</h4>
            <p className="text-muted-foreground text-sm">What you&apos;ll master</p>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-foreground">In this interactive lesson, you will:</p>
          <ul className="space-y-2">
            {[
              "Learn chord tone positions for all 5 CAGED shapes",
              "Practice identifying roots, thirds, and fifths by color",
              "Build visual memory for instant chord tone recognition",
              "Connect shapes across the fretboard using chord tones as anchors",
            ].map((item, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-3 text-sm">
                <div className="mt-1 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/20">
                  <span className="text-xs font-medium text-violet-400">{i + 1}</span>
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HighlightBox icon={Lightbulb} variant="tip" title="Pro tip for practice">
          <p>
            When you play a chord shape, sing the chord tones out loud: &ldquo;root, third,
            fifth.&rdquo; This connects your ears to your fingers and accelerates internalization.
            You&apos;ll start hearing chord tones in every song you listen to.
          </p>
        </HighlightBox>
      </div>
    </div>
  )
}

export default function ChordTonesArticle({ onEnterPreview }: ChordTonesArticleProps) {
  return (
    <article className="mx-auto max-w-4xl space-y-12 pb-16">
      {/* Hero Section */}
      <ArticleSection>
        <div className="space-y-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4" />
            <span>Fretboard Mastery</span>
            <span className="text-muted-foreground/50">·</span>
            <span>Chord Tones</span>
          </div>
          <ArticleHeading>Chord Tones: The Notes That Define Harmony</ArticleHeading>
          <ArticleParagraph>
            You&apos;ve learned to find root notes across the fretboard using the CAGED system. Now
            it&apos;s time to expand that foundation by adding two more essential notes: the{" "}
            <strong className="text-foreground">third</strong> and the{" "}
            <strong className="text-foreground">fifth</strong>. Together, these three notes form a
            triad &mdash; the fundamental building block of Western harmony.
          </ArticleParagraph>
        </div>

        <HighlightBox icon={Target} variant="important" title="What you'll learn">
          <p>
            By the end of this lesson, you&apos;ll know the root, third, and fifth positions for
            every CAGED shape. These chord tones are your melodic targets &mdash; the notes that
            always sound &ldquo;right&rdquo; when improvising over any chord. Master them, and
            you&apos;ll never feel lost during a solo again.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Building on Roots */}
      <ArticleSection>
        <ArticleSubheading>Building on Your CAGED Foundation</ArticleSubheading>
        <ArticleParagraph>
          You already know where the roots are in each CAGED shape. Those roots are your anchor
          points &mdash; they tell you what chord you&apos;re playing. Now we&apos;re upgrading from
          single anchor points to a complete harmonic map.
        </ArticleParagraph>

        <BuildingOnRoots />

        <ArticleParagraph>
          Think of it like this: roots tell you <em>where</em> you are, but chord tones tell you{" "}
          <em>what</em> you can play. Every melody that sounds good over a chord is fundamentally
          built around these three notes.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* What Are Chord Tones */}
      <ArticleSection>
        <ArticleSubheading>What Exactly Are Chord Tones?</ArticleSubheading>
        <ArticleParagraph>
          Chord tones are the notes that make up a chord. For major chords, these are the 1st, 3rd,
          and 5th degrees of the major scale. Each one has a distinct sound and function in the
          harmony.
        </ArticleParagraph>

        <div className="grid gap-4 pt-2">
          <ChordToneCard
            degree="1"
            name="Root"
            description="The home base. Maximum stability. This note names the chord and always sounds resolved."
            color="from-emerald-500 to-teal-600"
            shadowColor="shadow-emerald-500/30"
          />
          <ChordToneCard
            degree="3"
            name="Third"
            description="The quality definer. This note determines whether a chord is major (bright, happy) or minor (dark, sad)."
            color="from-amber-500 to-orange-600"
            shadowColor="shadow-amber-500/30"
          />
          <ChordToneCard
            degree="5"
            name="Fifth"
            description="The supporter. Adds fullness and stability without adding strong character. A safe, neutral tone."
            color="from-sky-500 to-blue-600"
            shadowColor="shadow-sky-500/30"
          />
        </div>

        <HighlightBox icon={Music} variant="note" title="The Third is the Most Important">
          <p>
            If you only target one chord tone besides the root, make it the third. It&apos;s what
            makes a major chord sound major and a minor chord sound minor. Landing on the third
            during a solo immediately tells the listener you&apos;re playing <em>with</em> the
            harmony, not just over it.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* How Triads Are Built */}
      <ArticleSection>
        <ArticleSubheading>How Triads Are Built From the Scale</ArticleSubheading>
        <ArticleParagraph>
          Chord tones come from the major scale. When you take every other note starting from the
          root &mdash; the 1st, 3rd, and 5th &mdash; you get a triad. This pattern is called{" "}
          <strong className="text-foreground">tertian harmony</strong>, and it&apos;s the foundation
          of nearly all Western music.
        </ArticleParagraph>

        <MajorScaleIntervals />

        <TriadConstruction />

        <ArticleParagraph>
          This is why the CAGED system is so powerful for learning chord tones. Each shape already
          contains the 1, 3, and 5 of the chord &mdash; you just need to learn where they are within
          the shapes you already know.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Why Chord Tones Matter */}
      <ArticleSection>
        <ArticleSubheading>Why Chord Tones Matter for Improvisation</ArticleSubheading>
        <ArticleParagraph>
          When you solo using only pentatonic scales, you&apos;re playing notes that sound
          &ldquo;okay&rdquo; over most chords. But when you target chord tones, you&apos;re playing
          notes that sound <strong className="text-foreground">perfect</strong> for{" "}
          <em>that specific chord</em>. This is what separates intermediate players from advanced
          musicians.
        </ArticleParagraph>

        <WhyChordTonesMatter />

        <HighlightBox icon={Lightbulb} variant="tip" title="The Strong Beat Rule">
          <p>
            Here&apos;s a game-changing tip: land on chord tones on strong beats (beats 1 and 3 in
            4/4 time). Use scale notes and passing tones on weak beats to connect your chord tone
            targets. This simple rule instantly makes your solos sound more professional and
            intentional.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Chord Tones in CAGED */}
      <ArticleSection>
        <ArticleSubheading>Chord Tones Across the CAGED System</ArticleSubheading>
        <ArticleParagraph>
          Each CAGED shape has its own unique arrangement of chord tones. By learning where the 1,
          3, and 5 fall within each shape, you gain instant access to melodic target notes anywhere
          on the fretboard. Here&apos;s how they&apos;re distributed:
        </ArticleParagraph>

        <div className="grid gap-6 pt-4 lg:grid-cols-2">
          {(["C", "A", "G", "E", "D"] as const).map((letter) => (
            <CAGEDChordToneCard key={letter} letter={letter} />
          ))}
        </div>

        <ArticleParagraph>
          Notice how some shapes have more chord tones than others. This depends on how many strings
          the shape spans and where it sits on the fretboard. The E and G shapes are particularly
          rich with chord tones because they cover all six strings.
        </ArticleParagraph>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Practice Section */}
      <ArticleSection>
        <ArticleSubheading>Ready to Master Chord Tones?</ArticleSubheading>
        <ArticleParagraph>
          Understanding the theory is just the first step. Now it&apos;s time to internalize these
          positions until they become second nature. In the interactive practice session,
          you&apos;ll drill chord tones across all five CAGED shapes until you can find them
          instantly.
        </ArticleParagraph>

        <PracticePreview />

        <div className="flex justify-center pt-6">
          <Button
            size="lg"
            onClick={onEnterPreview}
            className="h-14 gap-3 bg-gradient-to-r from-violet-500 to-purple-600 px-8 text-lg font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-105 hover:shadow-violet-500/40"
          >
            <Eye className="size-5" />
            Start Practicing Chord Tones
          </Button>
        </div>
      </ArticleSection>
    </article>
  )
}
