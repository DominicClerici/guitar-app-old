"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Sparkles, Zap } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const G_SHAPE_CHORD_TONES: FretPosition[] = [
  { string: 5, fret: 3, degree: "1" },
  { string: 4, fret: 2, degree: "3" },
  { string: 3, fret: 0, degree: "5" },
  { string: 2, fret: 0, degree: "1" },
  { string: 1, fret: 0, degree: "3" },
  { string: 0, fret: 3, degree: "1" },
]

const E_SHAPE_CHORD_TONES: FretPosition[] = [
  { string: 5, fret: 0, degree: "1" },
  { string: 4, fret: 2, degree: "5" },
  { string: 3, fret: 2, degree: "1" },
  { string: 2, fret: 1, degree: "3" },
  { string: 1, fret: 0, degree: "5" },
  { string: 0, fret: 0, degree: "1" },
]

const D_SHAPE_CHORD_TONES: FretPosition[] = [
  { string: 3, fret: 0, degree: "1" },
  { string: 2, fret: 2, degree: "5" },
  { string: 1, fret: 3, degree: "1" },
  { string: 0, fret: 2, degree: "3" },
]

const SHAPES_DATA = [
  { letter: "G" as const, tones: G_SHAPE_CHORD_TONES, count: 6 },
  { letter: "E" as const, tones: E_SHAPE_CHORD_TONES, count: 6 },
  { letter: "D" as const, tones: D_SHAPE_CHORD_TONES, count: 4 },
]

export default function ChordTonesReviewArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>G, E & D Shape Chord Tones</ArticleHeading>
        <ArticleParagraph>
          You now know the chord tones for the remaining three shapes. Combined with C and A, you
          have a complete map of chord tone positions across the entire fretboard.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="grid gap-5">
          {SHAPES_DATA.map(({ letter, tones, count }) => {
            const colors = CAGED_SHAPE_COLORS[letter]
            return (
              <div
                key={letter}
                className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                      colors.color,
                      colors.shadowColor,
                    )}
                  >
                    <span className="font-display text-lg font-bold text-white">{letter}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{letter} Shape</p>
                    <p className="text-muted-foreground text-xs">{count} chord tones</p>
                  </div>
                </div>
                <FretboardDiagram
                  positions={tones}
                  highlightFrets={[0, 4]}
                  title={`Chord tones in ${letter} shape`}
                  showDegreeLabels
                  compact
                />
              </div>
            )
          })}
        </div>
      </ArticleSection>

      <ArticleSection>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent_70%)]" />

          <div className="relative">
            <p className="text-muted-foreground mb-5 text-center text-sm font-medium">
              All 5 shapes&apos; chord tones — now in your toolkit
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {(["C", "A", "G", "E", "D"] as const).map((letter, index) => {
                const colors = CAGED_SHAPE_COLORS[letter]
                return (
                  <div key={letter} className="flex items-center gap-3 sm:gap-4">
                    <div
                      className={cn(
                        "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform hover:scale-110 sm:size-14 sm:rounded-2xl",
                        colors.color,
                        colors.shadowColor,
                      )}
                    >
                      <span className="font-display text-lg font-bold text-white sm:text-xl">
                        {letter}
                      </span>
                    </div>
                    {index < 4 && (
                      <ArrowRight className="text-muted-foreground/50 size-4 sm:size-5" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Zap} variant="note" title="Shapes connect across the neck">
          <p>
            Each shape&apos;s chord tones overlap with the neighboring shapes. The 5th of one shape
            often becomes the root of the next. This is how experienced players move fluidly across
            the entire fretboard.
          </p>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Sparkles} variant="tip" title="Time to put it all together">
          <p>
            Next, you&apos;ll practice all 5 shapes in a single run. This is where everything clicks
            — seeing how the shapes chain together across the neck with their chord tones connecting
            seamlessly.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
