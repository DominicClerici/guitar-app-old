"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Sparkles } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const E_SHAPE_MAJOR: FretPosition[] = [
  { string: 5, fret: 10, degree: "6" },
  { string: 5, fret: 12, degree: "7" },
  { string: 4, fret: 10, degree: "3" },
  { string: 4, fret: 12, degree: "4" },
  { string: 3, fret: 9, degree: "5" },
  { string: 3, fret: 11, degree: "6" },
  { string: 3, fret: 12, degree: "7" },
  { string: 2, fret: 10, degree: "3" },
  { string: 2, fret: 12, degree: "4" },
  { string: 1, fret: 10, degree: "6" },
  { string: 1, fret: 12, degree: "7" },
  { string: 0, fret: 10, degree: "3" },
  { string: 0, fret: 12, degree: "4" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function MajorScaleEToDArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>E Shape Major Scale</ArticleHeading>
        <ArticleParagraph>
          Almost there! The E shape at the 12th fret area mirrors the open position patterns an
          octave higher. One more shape to go &mdash; the D shape completes your major scale map.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                CAGED_SHAPE_COLORS.E.color,
                CAGED_SHAPE_COLORS.E.shadowColor,
              )}
            >
              <span className="font-display text-lg font-bold text-white">E</span>
            </div>
            <div>
              <p className="text-sm font-medium">E Shape</p>
              <p className="text-muted-foreground text-xs">13 major scale notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={E_SHAPE_MAJOR}
            highlightFrets={[9, 13]}
            title="Major scale notes in E shape"
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
              const isCompleted =
                letter === "C" || letter === "A" || letter === "G" || letter === "E"
              const isNext = letter === "D"
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
              <strong className="text-foreground">C, A, G, E</strong> — completed
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">D</strong> — one more to go!
            </span>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Sparkles} variant="default" title="Almost there">
          <p>
            One more shape to go. The D shape completes the full set of CAGED major scale positions.
            Once you have all five, you&apos;ll be able to play the complete major scale anywhere on
            the fretboard.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
