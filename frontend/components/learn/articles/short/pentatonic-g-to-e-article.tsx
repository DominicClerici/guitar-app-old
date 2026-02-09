"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Zap } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const G_SHAPE_PENTATONIC: FretPosition[] = [
  { string: 5, fret: 2, degree: "5" },
  { string: 5, fret: 3, degree: "1" },
  { string: 4, fret: 0, degree: "2" },
  { string: 4, fret: 2, degree: "3" },
  { string: 3, fret: 0, degree: "5" },
  { string: 3, fret: 2, degree: "6" },
  { string: 2, fret: 0, degree: "1" },
  { string: 2, fret: 2, degree: "2" },
  { string: 1, fret: 0, degree: "3" },
  { string: 1, fret: 3, degree: "6" },
  { string: 0, fret: 0, degree: "2" },
  { string: 0, fret: 2, degree: "5" },
  { string: 0, fret: 3, degree: "1" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function PentatonicGToEArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>G Shape Pentatonic</ArticleHeading>
        <ArticleParagraph>
          The G shape is the largest pentatonic shape, spanning all 6 strings with 13 notes. It
          covers a wide stretch of the fretboard, giving you the most melodic territory to explore
          within a single position.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                CAGED_SHAPE_COLORS.G.color,
                CAGED_SHAPE_COLORS.G.shadowColor,
              )}
            >
              <span className="font-display text-lg font-bold text-white">G</span>
            </div>
            <div>
              <p className="text-sm font-medium">G Shape</p>
              <p className="text-muted-foreground text-xs">13 pentatonic notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={G_SHAPE_PENTATONIC}
            highlightFrets={[0, 4]}
            title="Pentatonic notes in G shape"
            showDegreeLabels
            compact
          />
        </div>
      </ArticleSection>

      <ArticleSection>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <p className="text-muted-foreground mb-5 text-center text-sm font-medium">
            Shape progress
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {SHAPES.map((letter, index) => {
              const colors = CAGED_SHAPE_COLORS[letter]
              const isCompleted = letter === "C" || letter === "A" || letter === "G"
              const isNext = letter === "E"
              return (
                <div key={letter} className="flex items-center gap-3 sm:gap-4">
                  <div
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg sm:size-14 sm:rounded-2xl",
                      colors.color,
                      colors.shadowColor,
                      !isCompleted && !isNext && "opacity-30",
                      isNext && "ring-2 ring-white/30",
                    )}
                  >
                    <span className="font-display text-lg font-bold text-white sm:text-xl">
                      {letter}
                    </span>
                  </div>
                  {index < SHAPES.length - 1 && (
                    <ArrowRight className="text-muted-foreground/50 size-4 sm:size-5" />
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs">
            <span className="text-muted-foreground">
              <strong className="text-foreground">C, A, G</strong> — completed
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">E</strong> — up next
            </span>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Zap} variant="note" title="Shapes connect across the neck">
          <p>
            Each pentatonic shape overlaps with its neighbors. The notes at the edge of one shape
            are shared with the next. This is how the 5 CAGED shapes tile together to cover the
            entire fretboard without any gaps.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
