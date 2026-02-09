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

const C_SHAPE_PENTATONIC: FretPosition[] = [
  { string: 4, fret: 2, degree: "6" },
  { string: 4, fret: 3, degree: "1" },
  { string: 3, fret: 0, degree: "2" },
  { string: 3, fret: 2, degree: "5" },
  { string: 2, fret: 0, degree: "3" },
  { string: 2, fret: 2, degree: "6" },
  { string: 1, fret: 0, degree: "2" },
  { string: 1, fret: 1, degree: "1" },
  { string: 0, fret: 0, degree: "5" },
  { string: 0, fret: 3, degree: "2" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function PentatonicCToAArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>C Shape Pentatonic</ArticleHeading>
        <ArticleParagraph>
          The C shape pentatonic builds on the chord tones you already learned, adding the{" "}
          <strong>2nd</strong> and <strong>6th</strong> degrees to create a 5-note scale within this
          position. Where the chord tones gave you three notes to work with, the pentatonic fills in
          the gaps for smoother melodic movement.
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
              <p className="text-muted-foreground text-xs">10 pentatonic notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={C_SHAPE_PENTATONIC}
            highlightFrets={[0, 4]}
            title="Pentatonic notes in C shape"
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
        <HighlightBox icon={Lightbulb} variant="tip" title="Why pentatonic works so well">
          <p>
            These 5 notes (1, 2, 3, 5, 6) deliberately avoid the 4th and 7th scale degrees — the
            notes that create the most tension. That&apos;s what makes the pentatonic scale so
            forgiving and great for soloing. Almost any combination of these notes sounds good
            together.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
