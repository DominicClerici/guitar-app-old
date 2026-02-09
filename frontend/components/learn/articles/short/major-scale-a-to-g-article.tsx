"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Music } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const A_SHAPE_MAJOR: FretPosition[] = [
  { string: 5, fret: 4, degree: "2" },
  { string: 5, fret: 5, degree: "3" },
  { string: 5, fret: 7, degree: "4" },
  { string: 4, fret: 4, degree: "6" },
  { string: 4, fret: 5, degree: "7" },
  { string: 4, fret: 7, degree: "1" },
  { string: 3, fret: 4, degree: "2" },
  { string: 3, fret: 6, degree: "3" },
  { string: 3, fret: 7, degree: "4" },
  { string: 2, fret: 5, degree: "7" },
  { string: 2, fret: 7, degree: "1" },
  { string: 1, fret: 5, degree: "3" },
  { string: 1, fret: 7, degree: "4" },
  { string: 0, fret: 5, degree: "7" },
]

const SHAPES = ["C", "A", "G", "E", "D"] as const

export default function MajorScaleAToGArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>A Shape Major Scale</ArticleHeading>
        <ArticleParagraph>
          Two shapes down! The A shape shows how the 7th degree (leading tone) naturally resolves up
          to the root. You&apos;re building a complete map of the major scale across the neck. Next:
          the G shape.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
          <div className="mb-4 flex items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                CAGED_SHAPE_COLORS.A.color,
                CAGED_SHAPE_COLORS.A.shadowColor,
              )}
            >
              <span className="font-display text-lg font-bold text-white">A</span>
            </div>
            <div>
              <p className="text-sm font-medium">A Shape</p>
              <p className="text-muted-foreground text-xs">14 major scale notes</p>
            </div>
          </div>
          <FretboardDiagram
            positions={A_SHAPE_MAJOR}
            highlightFrets={[4, 8]}
            title="Major scale notes in A shape"
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
              const isCompleted = letter === "C" || letter === "A"
              const isNext = letter === "G"
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
              <strong className="text-foreground">C, A</strong> — completed
            </span>
            <span className="text-muted-foreground">
              <strong className="text-foreground">G</strong> — up next
            </span>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Music} variant="default" title="The leading tone in action">
          <p>
            In the A shape, notice how the 7th degree appears just one fret below the root on
            several strings. This half-step relationship is the strongest resolution in music
            &mdash; your ear naturally expects the 7th to move up to the root.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
