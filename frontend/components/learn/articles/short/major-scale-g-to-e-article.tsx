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

const G_SHAPE_MAJOR: FretPosition[] = [
  { string: 5, fret: 7, degree: "4" },
  { string: 5, fret: 9, degree: "5" },
  { string: 5, fret: 10, degree: "6" },
  { string: 4, fret: 7, degree: "1" },
  { string: 4, fret: 9, degree: "2" },
  { string: 4, fret: 10, degree: "3" },
  { string: 3, fret: 7, degree: "4" },
  { string: 3, fret: 9, degree: "5" },
  { string: 2, fret: 7, degree: "1" },
  { string: 2, fret: 9, degree: "2" },
  { string: 2, fret: 10, degree: "3" },
  { string: 1, fret: 7, degree: "4" },
  { string: 1, fret: 9, degree: "5" },
  { string: 1, fret: 10, degree: "6" },
  { string: 0, fret: 7, degree: "1" },
  { string: 0, fret: 9, degree: "2" },
  { string: 0, fret: 10, degree: "3" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function MajorScaleGToEArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>G Shape Major Scale</ArticleHeading>
        <ArticleParagraph>
          Halfway there! The G shape is one of the richest shapes with more notes. Notice the
          clusters of notes &mdash; the 4th always sits right above the 3rd, and the 7th just below
          the root. Next up: the E shape.
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
              <p className="text-muted-foreground text-xs">17 major scale notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={G_SHAPE_MAJOR}
            highlightFrets={[6, 10]}
            title="Major scale notes in G shape"
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
        <HighlightBox icon={Zap} variant="note" title="Tension note patterns">
          <p>
            The G shape clearly shows how the tension notes create clusters. On each string, the 4th
            sits one fret above the 3rd, and the 7th sits one fret below the root. These half-step
            pairs are the engine of melodic movement in the major scale.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
