"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Eye,
  Lightbulb,
  Music,
  Target,
  Zap,
} from "lucide-react"

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
  return <section className={cn("space-y-6", className)}>{children}</section>
}

function ArticleHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
      {children}
    </h2>
  )
}

function ArticleSubheading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{children}</h3>
  )
}

function ArticleParagraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-base leading-relaxed sm:text-lg sm:leading-relaxed">
      {children}
    </p>
  )
}

function HighlightBox({
  children,
  icon: Icon,
  variant = "default",
  title,
}: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  variant?: "default" | "tip" | "important" | "note"
  title?: string
}) {
  const variants = {
    default: "from-primary/5 to-primary/10 border-primary/20",
    tip: "from-emerald-500/5 to-emerald-500/10 border-emerald-500/20",
    important: "from-amber-500/5 to-amber-500/10 border-amber-500/20",
    note: "from-sky-500/5 to-sky-500/10 border-sky-500/20",
  }

  const iconColors = {
    default: "text-primary",
    tip: "text-emerald-500",
    important: "text-amber-500",
    note: "text-sky-500",
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6",
        variants[variant],
      )}
    >
      <div className="flex gap-4">
        {Icon && (
          <div className="flex-shrink-0">
            <Icon className={cn("size-5", iconColors[variant])} />
          </div>
        )}
        <div className="space-y-2">
          {title && <p className="text-foreground font-semibold">{title}</p>}
          <div className="text-muted-foreground text-sm sm:text-base">{children}</div>
        </div>
      </div>
    </div>
  )
}

const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21]
const STRING_NAMES = ["E", "B", "G", "D", "A", "E"]

interface FretboardDiagramProps {
  rootPositions: { string: number; fret: number }[]
  highlightFrets?: [number, number]
  showOpenStrings?: boolean
  title?: string
  className?: string
  compact?: boolean
}

function FretboardDiagram({
  rootPositions,
  highlightFrets = [0, 4],
  showOpenStrings = true,
  title,
  className,
  compact = false,
}: FretboardDiagramProps) {
  const [startFret, endFret] = highlightFrets
  const fretCount = endFret - startFret + 1

  return (
    <div className={cn("space-y-3", className)}>
      {title && <p className="text-muted-foreground text-center text-sm font-medium">{title}</p>}
      <div className="relative mx-auto w-full max-w-md">
        {/* Fret numbers */}
        <div
          className="mb-1 flex justify-between px-6"
          style={{ paddingLeft: showOpenStrings ? "2.5rem" : "0.5rem" }}
        >
          {Array.from({ length: fretCount }, (_, i) => startFret + i).map((fret) => (
            <span
              key={fret}
              className={cn(
                "text-muted-foreground/60 w-8 text-center text-xs",
                FRET_MARKERS.includes(fret) && "text-muted-foreground font-medium",
              )}
            >
              {fret === 0 ? "" : fret}
            </span>
          ))}
        </div>

        {/* Fretboard */}
        <div className="relative rounded-lg bg-gradient-to-b from-amber-900/90 to-amber-950 p-2 shadow-lg">
          {/* Nut (if showing open position) */}
          {startFret === 0 && (
            <div className="absolute top-0 bottom-0 left-6 w-1.5 rounded-l bg-gradient-to-b from-stone-200 to-stone-400" />
          )}

          {/* Strings and frets grid */}
          <div className="relative">
            {STRING_NAMES.map((stringName, stringIndex) => (
              <div key={stringIndex} className="flex items-center">
                {/* String name */}
                {showOpenStrings && (
                  <span className="text-muted-foreground/70 w-4 pr-1 text-right text-xs">
                    {stringName}
                  </span>
                )}

                {/* Frets for this string */}
                <div className="flex flex-1">
                  {Array.from({ length: fretCount }, (_, fretIndex) => {
                    const actualFret = startFret + fretIndex
                    const isRoot = rootPositions.some(
                      (pos) => pos.string === stringIndex && pos.fret === actualFret,
                    )

                    return (
                      <div
                        key={fretIndex}
                        className={cn(
                          "relative flex h-7 flex-1 items-center justify-center border-r border-amber-700/50",
                          fretIndex === 0 && startFret === 0 && "border-l-2 border-l-stone-300",
                          compact && "h-5",
                        )}
                      >
                        {/* String line */}
                        <div
                          className={cn(
                            "absolute top-1/2 right-0 left-0 h-px -translate-y-1/2",
                            stringIndex <= 1 && "bg-stone-300/80",
                            stringIndex === 2 && "bg-stone-400/80",
                            stringIndex >= 3 && "h-0.5 bg-stone-500/90",
                          )}
                        />

                        {/* Root note indicator */}
                        {isRoot && (
                          <div
                            className={cn(
                              "relative z-10 flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/30",
                              compact && "size-4",
                            )}
                          >
                            <span className="text-[10px] font-bold text-white">R</span>
                          </div>
                        )}

                        {/* Fret marker dots */}
                        {stringIndex === 2 &&
                          FRET_MARKERS.includes(actualFret) &&
                          actualFret !== 12 && (
                            <div className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full bg-stone-600/30" />
                          )}
                        {stringIndex === 1 && actualFret === 12 && (
                          <div className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full bg-stone-600/30" />
                        )}
                        {stringIndex === 3 && actualFret === 12 && (
                          <div className="absolute bottom-0 left-1/2 size-2 -translate-x-1/2 translate-y-4 rounded-full bg-stone-600/30" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const CAGED_SHAPES = {
  C: {
    letter: "C",
    color: "from-rose-500 to-pink-600",
    shadowColor: "shadow-rose-500/30",
    bgGlow: "from-rose-500/10 to-pink-500/10",
    description: "Based on the open C major chord shape",
    rootPositions: [
      { string: 1, fret: 1 },
      { string: 4, fret: 3 },
    ],
    highlightFrets: [0, 4] as [number, number],
    characteristics: [
      "Root on the 5th (A) string",
      "Also has a root on the 2nd (B) string",
      "Wide stretch between fingers",
    ],
    openChordNotes:
      "The open C chord has roots at the 3rd fret of the A string and 1st fret of the B string",
  },
  A: {
    letter: "A",
    color: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-500/30",
    bgGlow: "from-amber-500/10 to-orange-500/10",
    description: "Based on the open A major chord shape",
    rootPositions: [
      { string: 4, fret: 0 },
      { string: 2, fret: 2 },
    ],
    highlightFrets: [0, 4] as [number, number],
    characteristics: [
      "Root on the open 5th (A) string",
      "Also has a root on the 3rd (G) string, 2nd fret",
      "Compact shape, easy barre chord",
    ],
    openChordNotes:
      "The open A chord has the root as the open A string and another at the 2nd fret of the G string",
  },
  G: {
    letter: "G",
    color: "from-emerald-500 to-green-600",
    shadowColor: "shadow-emerald-500/30",
    bgGlow: "from-emerald-500/10 to-green-500/10",
    description: "Based on the open G major chord shape",
    rootPositions: [
      { string: 5, fret: 3 },
      { string: 2, fret: 0 },
      { string: 0, fret: 3 },
    ],
    highlightFrets: [0, 4] as [number, number],
    characteristics: [
      "Root on the 6th (E) string, 3rd fret",
      "Root on the open 3rd (G) string",
      "Root on the 1st (E) string, 3rd fret",
    ],
    openChordNotes:
      "The open G chord spans the entire fretboard width with roots on both E strings and the G string",
  },
  E: {
    letter: "E",
    color: "from-sky-500 to-blue-600",
    shadowColor: "shadow-sky-500/30",
    bgGlow: "from-sky-500/10 to-blue-500/10",
    description: "Based on the open E major chord shape",
    rootPositions: [
      { string: 5, fret: 0 },
      { string: 3, fret: 2 },
      { string: 0, fret: 0 },
    ],
    highlightFrets: [0, 4] as [number, number],
    characteristics: [
      "Root on the open 6th (low E) string",
      "Root on the 4th (D) string, 2nd fret",
      "Root on the open 1st (high E) string",
    ],
    openChordNotes: "The most common barre chord shape - roots on both E strings and the D string",
  },
  D: {
    letter: "D",
    color: "from-violet-500 to-purple-600",
    shadowColor: "shadow-violet-500/30",
    bgGlow: "from-violet-500/10 to-purple-500/10",
    description: "Based on the open D major chord shape",
    rootPositions: [
      { string: 3, fret: 0 },
      { string: 1, fret: 3 },
    ],
    highlightFrets: [0, 4] as [number, number],
    characteristics: [
      "Root on the open 4th (D) string",
      "Root on the 2nd (B) string, 3rd fret",
      "Highest position shape on the neck",
    ],
    openChordNotes:
      "The open D chord sits on the thinner strings with roots on the D and B strings",
  },
}

type ShapeLetter = keyof typeof CAGED_SHAPES

function ShapeDetailCard({ shapeLetter }: { shapeLetter: ShapeLetter }) {
  const shape = CAGED_SHAPES[shapeLetter]

  return (
    <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-zinc-900/50 to-zinc-950/50 p-0">
      {/* Background glow */}
      <div
        className={cn(
          "absolute -top-20 -right-20 size-40 rounded-full bg-gradient-to-br opacity-20 blur-3xl transition-all group-hover:scale-150 group-hover:opacity-30",
          shape.bgGlow,
        )}
      />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div
            className={cn(
              "flex size-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
              shape.color,
              shape.shadowColor,
            )}
          >
            <span className="font-display text-2xl font-bold text-white">{shape.letter}</span>
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold">{shape.letter} Shape</h4>
            <p className="text-muted-foreground text-sm">{shape.description}</p>
          </div>
        </div>

        {/* Fretboard diagram */}
        <FretboardDiagram
          rootPositions={shape.rootPositions}
          highlightFrets={shape.highlightFrets}
          title={`Root positions in ${shape.letter} shape`}
          className="mb-6"
        />

        {/* Characteristics */}
        <div className="space-y-2">
          <p className="text-foreground text-sm font-medium">Key characteristics:</p>
          <ul className="space-y-1">
            {shape.characteristics.map((char, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                <ChevronRight className="mt-0.5 size-3 flex-shrink-0 text-emerald-500" />
                {char}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

function ShapeSequenceVisual() {
  const shapes: ShapeLetter[] = ["C", "A", "G", "E", "D"]

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6 sm:p-8">
      {/* Background pattern */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent_70%)]" />

      <div className="relative">
        <p className="text-muted-foreground mb-6 text-center text-sm">
          The CAGED sequence repeats infinitely up the neck
        </p>

        {/* Main sequence */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          {shapes.map((letter, index) => {
            const shape = CAGED_SHAPES[letter]
            return (
              <div key={letter} className="flex items-center gap-3 sm:gap-4">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform hover:scale-110 sm:size-14 sm:rounded-2xl",
                    shape.color,
                    shape.shadowColor,
                  )}
                >
                  <span className="font-display text-lg font-bold text-white sm:text-xl">
                    {letter}
                  </span>
                </div>
                {index < shapes.length - 1 && (
                  <ArrowRight className="text-muted-foreground/50 size-4 sm:size-5" />
                )}
              </div>
            )
          })}
          <ArrowRight className="text-muted-foreground/50 size-4 sm:size-5" />
          <div className="text-muted-foreground/70 text-sm italic">repeats...</div>
        </div>

        {/* Additional context */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-foreground font-medium">5 Shapes</p>
            <p className="text-muted-foreground text-sm">Cover the entire fretboard</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-foreground font-medium">12 Frets</p>
            <p className="text-muted-foreground text-sm">Before the pattern repeats</p>
          </div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-foreground font-medium">Any Key</p>
            <p className="text-muted-foreground text-sm">Works for all 12 keys</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MoveableShapeDemo() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* E shape example */}
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600">
              <span className="font-display font-bold text-white">E</span>
            </div>
            <div>
              <p className="font-medium">E Shape at Fret 0</p>
              <p className="text-muted-foreground text-sm">This is an E major chord</p>
            </div>
          </div>
          <FretboardDiagram
            rootPositions={[
              { string: 5, fret: 0 },
              { string: 3, fret: 2 },
              { string: 0, fret: 0 },
            ]}
            highlightFrets={[0, 4]}
            compact
          />
        </div>

        {/* Same E shape moved */}
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600">
              <span className="font-display font-bold text-white">E</span>
            </div>
            <div>
              <p className="font-medium">E Shape at Fret 5</p>
              <p className="text-muted-foreground text-sm">
                This is an <strong>A major</strong> chord (root is now on the 5th fret)
              </p>
            </div>
          </div>
          <FretboardDiagram
            rootPositions={[
              { string: 5, fret: 5 },
              { string: 3, fret: 7 },
              { string: 0, fret: 5 },
            ]}
            highlightFrets={[4, 8]}
            showOpenStrings={false}
            compact
          />
        </div>
      </div>

      <HighlightBox icon={Lightbulb} variant="tip" title="The Key Insight">
        <p>
          The <strong>root note position determines the key</strong>. When you move the E shape so
          the root lands on A (5th fret of the low E string), you&apos;re now playing an A major
          chord using the E shape. This is why barre chords work!
        </p>
      </HighlightBox>
    </div>
  )
}

function RootNoteExplainer() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <ArticleParagraph>
          A root note is the <strong className="text-foreground">foundational tone</strong> that
          gives a chord or scale its name. When someone says &ldquo;play a C chord,&rdquo; the
          &ldquo;C&rdquo; refers to the root note.
        </ArticleParagraph>
        <ArticleParagraph>
          Think of root notes as <strong className="text-foreground">anchor points</strong> on the
          fretboard. Once you know where your root is, you can build any chord or scale from that
          position.
        </ArticleParagraph>
      </div>

      <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30">
            <span className="font-display text-3xl font-bold text-white">R</span>
          </div>
          <p className="text-foreground font-medium">Root Note</p>
          <p className="text-muted-foreground text-sm">
            The &ldquo;home base&rdquo; of any chord or scale
          </p>
        </div>
      </div>
    </div>
  )
}

function WhyRootsMatter() {
  const benefits = [
    {
      icon: Music,
      title: "Find any chord instantly",
      description: "Know where the root is, and you can form any chord shape around it",
    },
    {
      icon: Zap,
      title: "Navigate key changes",
      description: "Shift to a new root position and you're in a new key",
    },
    {
      icon: Target,
      title: "Build scales easily",
      description: "Scale patterns are built outward from root note positions",
    },
    {
      icon: BookOpen,
      title: "Understand music theory",
      description: "Roots are the foundation for understanding harmony and melody",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {benefits.map((benefit) => (
        <div
          key={benefit.title}
          className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <benefit.icon className="size-4 text-emerald-500" />
            </div>
            <p className="font-medium">{benefit.title}</p>
          </div>
          <p className="text-muted-foreground text-sm">{benefit.description}</p>
        </div>
      ))}
    </div>
  )
}

function LessonPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5 p-6 sm:p-8">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute -top-20 -right-20 size-40 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 size-40 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
            <Target className="size-6 text-white" />
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold">What&apos;s Next</h4>
            <p className="text-muted-foreground text-sm">Your practice session</p>
          </div>
        </div>

        <div className="mb-6 space-y-3">
          <p className="text-foreground">In this lesson, you will:</p>
          <ul className="space-y-2">
            {[
              "Learn the root note positions for all 5 CAGED shapes",
              "Practice identifying roots across the fretboard",
              "Build muscle memory for finding roots instantly",
              "Establish the foundation for chords, scales, and improvisation",
            ].map((item, i) => (
              <li key={i} className="text-muted-foreground flex items-start gap-3 text-sm">
                <div className="mt-1 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <span className="text-xs font-medium text-emerald-400">{i + 1}</span>
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HighlightBox icon={Lightbulb} variant="tip" title="Why start with roots?">
          <p>
            Everything in the CAGED system is built around root notes. Master the roots first, and
            adding chord tones, scale degrees, and arpeggios becomes intuitive. You&apos;re building
            a mental map of the fretboard that will serve you for life.
          </p>
        </HighlightBox>
      </div>
    </div>
  )
}

export default function CAGEDArticle({ onEnterPreview }: CAGEDArticleProps) {
  return (
    <article className="mx-auto max-w-4xl space-y-12 pb-16">
      {/* Hero Section */}
      <ArticleSection>
        <div className="space-y-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4" />
            <span>Fretboard Mastery</span>
            <span className="text-muted-foreground/50">·</span>
            <span>Foundation</span>
          </div>
          <ArticleHeading>The CAGED System: Your Roadmap to the Fretboard</ArticleHeading>
          <ArticleParagraph>
            The CAGED system is one of the most powerful frameworks for truly understanding the
            guitar fretboard. It transforms the seemingly random arrangement of notes into a
            logical, interconnected map that unlocks the ability to play in any key, anywhere on the
            neck.
          </ArticleParagraph>
        </div>

        <HighlightBox icon={Target} variant="important" title="What you'll learn">
          <p>
            By the end of this lesson, you&apos;ll understand how five simple chord shapes connect
            across the entire fretboard. You&apos;ll learn to identify root notes within each shape,
            forming the foundation for building chords, scales, and unlocking improvisation across
            the neck.
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Root Notes Section */}
      <ArticleSection>
        <ArticleSubheading>First, Let&apos;s Talk About Root Notes</ArticleSubheading>
        <RootNoteExplainer />

        <div className="pt-4">
          <p className="text-foreground mb-4 font-medium">Why are root notes so important?</p>
          <WhyRootsMatter />
        </div>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* The Five Shapes */}
      <ArticleSection>
        <ArticleSubheading>The Five CAGED Shapes</ArticleSubheading>
        <ArticleParagraph>
          CAGED stands for five open chord shapes you likely already know:{" "}
          <strong className="text-foreground">C</strong>,{" "}
          <strong className="text-foreground">A</strong>,{" "}
          <strong className="text-foreground">G</strong>,{" "}
          <strong className="text-foreground">E</strong>, and{" "}
          <strong className="text-foreground">D</strong>. Each shape has a unique pattern of root
          notes. When you learn these patterns, you can find any note anywhere on the fretboard.
        </ArticleParagraph>

        <div className="grid gap-6 pt-4 lg:grid-cols-2">
          {(["C", "A", "G", "E", "D"] as const).map((letter) => (
            <ShapeDetailCard key={letter} shapeLetter={letter} />
          ))}
        </div>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Moveable Shapes */}
      <ArticleSection>
        <ArticleSubheading>Shapes Are Moveable</ArticleSubheading>
        <ArticleParagraph>
          Here&apos;s where CAGED becomes powerful: these shapes aren&apos;t locked to one position.
          You can slide any shape up or down the neck, and the{" "}
          <strong className="text-foreground">root note tells you what key you&apos;re in</strong>.
        </ArticleParagraph>

        <MoveableShapeDemo />
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Shape Sequence */}
      <ArticleSection>
        <ArticleSubheading>The Shapes Connect in Sequence</ArticleSubheading>
        <ArticleParagraph>
          The real magic of CAGED is how the shapes link together. As you move up the neck, one
          shape naturally flows into the next in a specific order:{" "}
          <strong className="text-foreground">C → A → G → E → D</strong>, then back to C again.
        </ArticleParagraph>

        <ShapeSequenceVisual />

        <ArticleParagraph>
          This means that in any key, you have five different positions where you can play the same
          chord or scale. Want to play a C major chord? You can play it in the C shape (open
          position), A shape (3rd fret), G shape (5th fret), E shape (8th fret), or D shape (10th
          fret).
        </ArticleParagraph>

        <HighlightBox icon={Zap} variant="note" title="The pattern repeats every 12 frets">
          <p>
            After going through all five shapes, you&apos;ll end up 12 frets higher than where you
            started—which is exactly one octave. The pattern then repeats identically. This is why
            the 12th fret has double dots: it&apos;s where the pattern resets!
          </p>
        </HighlightBox>
      </ArticleSection>

      <Separator className="bg-border/50" />

      {/* Lesson Preview */}
      <ArticleSection>
        <ArticleSubheading>Ready to Master the Fretboard?</ArticleSubheading>
        <ArticleParagraph>
          Now that you understand the concept, it&apos;s time to put it into practice. In the
          interactive lesson, you&apos;ll learn the exact root positions for each shape and start
          building your fretboard map.
        </ArticleParagraph>

        <LessonPreview />

        <div className="flex justify-center pt-6">
          <Button
            size="lg"
            onClick={onEnterPreview}
            className="h-14 gap-3 bg-gradient-to-r from-emerald-500 to-teal-600 px-8 text-lg font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:shadow-emerald-500/40"
          >
            <Eye className="size-5" />
            Start Learning Root Positions
          </Button>
        </div>
      </ArticleSection>
    </article>
  )
}
