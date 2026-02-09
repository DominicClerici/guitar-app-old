"use client"

import { cn } from "@/lib/utils"
import { ArrowRight, Lightbulb, Music } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  HighlightBox,
} from "../article-primitives"

const CAGED_LETTERS = ["C", "A", "G", "E", "D"] as const

export default function RootsRecapArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>Roots: The Foundation</ArticleHeading>
        <ArticleParagraph>
          Root notes are the anchor points of the CAGED system. Every chord, scale, and arpeggio is
          built from these positions. By knowing where the roots are in each shape, you can
          instantly find your bearings anywhere on the fretboard.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent_70%)]" />

          <div className="relative">
            <p className="text-muted-foreground mb-5 text-center text-sm font-medium">
              The 5 shapes in order, each covering a unique region of the neck
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {CAGED_LETTERS.map((letter, index) => {
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
                    {index < CAGED_LETTERS.length - 1 && (
                      <ArrowRight className="text-muted-foreground/50 size-4 sm:size-5" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {CAGED_LETTERS.map((letter, index) => {
                const colors = CAGED_SHAPE_COLORS[letter]
                return (
                  <div key={letter} className="rounded-xl bg-white/5 px-3 py-2.5 text-center">
                    <span
                      className={cn(
                        "font-display bg-gradient-to-br bg-clip-text text-lg font-bold text-transparent",
                        colors.color,
                      )}
                    >
                      {letter}
                    </span>
                    <p className="text-muted-foreground mt-0.5 text-xs">Shape {index + 1}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Music} variant="default" title="Each letter = one position">
          <p>
            As you move up the neck, the shapes appear in C-A-G-E-D order. Each shape has its own
            unique root note pattern. Together, the 5 shapes cover every root note across the entire
            fretboard.
          </p>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="Why this matters">
          <p>
            Once you can find root notes in all 5 shapes, you have a complete map of the fretboard.
            Chord tones, scale patterns, and arpeggios are all built on top of these same root
            positions.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
