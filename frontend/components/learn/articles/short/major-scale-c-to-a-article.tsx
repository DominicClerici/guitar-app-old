"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Lightbulb } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const C_SHAPE_MAJOR: FretPosition[] = [
  { string: 5, fret: 2, degree: "1" },
  { string: 5, fret: 4, degree: "2" },
  { string: 4, fret: 1, degree: "5" },
  { string: 4, fret: 2, degree: "6" },
  { string: 4, fret: 4, degree: "7" },
  { string: 3, fret: 1, degree: "2" },
  { string: 3, fret: 2, degree: "3" },
  { string: 3, fret: 4, degree: "4" },
  { string: 2, fret: 2, degree: "6" },
  { string: 2, fret: 4, degree: "7" },
  { string: 1, fret: 1, degree: "2" },
  { string: 1, fret: 2, degree: "3" },
  { string: 0, fret: 2, degree: "6" },
  { string: 0, fret: 4, degree: "7" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function MajorScaleCToAArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>C Shape Major Scale</ArticleHeading>
        <ArticleParagraph>
          Great job with the C shape! You&apos;ve learned all seven major scale degrees in this
          position. Notice how the 4th and 7th degrees fill in the gaps between the pentatonic
          notes. Now let&apos;s move up the neck to the A shape.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                CAGED_SHAPE_COLORS.C.color,
                CAGED_SHAPE_COLORS.C.shadowColor,
              )}
            >
              <span className="font-display text-lg font-bold text-white">C</span>
            </div>
            <div>
              <p className="text-sm font-medium">C Shape</p>
              <p className="text-muted-foreground text-xs">14 major scale notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={C_SHAPE_MAJOR}
            highlightFrets={[1, 5]}
            title="Major scale notes in C shape"
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
              const isCompleted = letter === "C"
              const isNext = letter === "A"
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
              <strong className="text-foreground">C</strong> — completed
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">A</strong> — up next
            </span>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="Spot the new notes">
          <p>
            The 4th and 7th degrees sit right next to pentatonic notes you already know. The 4th is
            always a half-step above the 3rd, and the 7th is always a half-step below the root. Use
            these relationships to find the new notes quickly.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
