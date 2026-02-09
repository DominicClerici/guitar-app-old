"use client"

import { cn } from "@/lib/utils"
import { Lightbulb, Music } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  CAGED_SHAPE_COLORS,
  FretboardDiagram,
  HighlightBox,
  type FretPosition,
} from "../article-primitives"

const C_SHAPE_CHORD_TONES: FretPosition[] = [
  { string: 4, fret: 3, degree: "1" },
  { string: 3, fret: 2, degree: "5" },
  { string: 2, fret: 0, degree: "3" },
  { string: 1, fret: 1, degree: "1" },
  { string: 0, fret: 0, degree: "5" },
]

const A_SHAPE_CHORD_TONES: FretPosition[] = [
  { string: 4, fret: 0, degree: "1" },
  { string: 3, fret: 2, degree: "5" },
  { string: 2, fret: 2, degree: "1" },
  { string: 1, fret: 2, degree: "3" },
  { string: 0, fret: 0, degree: "5" },
]

export default function ChordTonesOverviewArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>Chord Tones in C & A Shapes</ArticleHeading>
        <ArticleParagraph>
          You just practiced finding the chord tones (1, 3, 5) within the C and A shapes. These
          positions come directly from the open chord fingerings you already know — the same notes
          that ring out when you strum an open C or A major chord.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="grid gap-6 sm:grid-cols-2">
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
                <p className="text-muted-foreground text-xs">5 chord tones</p>
              </div>
            </div>
            <FretboardDiagram
              positions={C_SHAPE_CHORD_TONES}
              highlightFrets={[0, 4]}
              title="Chord tones in C shape"
              showDegreeLabels
              compact
            />
          </div>

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
                <p className="text-muted-foreground text-xs">5 chord tones</p>
              </div>
            </div>
            <FretboardDiagram
              positions={A_SHAPE_CHORD_TONES}
              highlightFrets={[0, 4]}
              title="Chord tones in A shape"
              showDegreeLabels
              compact
            />
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Music} variant="default" title="Where do chord tones come from?">
          <div className="space-y-3">
            <p>
              Each CAGED shape is based on an open chord fingering. The chord tones — the{" "}
              <strong>root (1)</strong>, <strong>3rd</strong>, and <strong>5th</strong> — are the
              exact notes that make up that chord. When you move the shape up the neck, these same
              relative positions hold true in every key.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="Spotting the pattern">
          <p>
            Notice how the root notes anchor each shape, while the 3rds and 5ths fill in around
            them. You already know the roots — now the 3rds and 5ths give you more melodic options
            within each position.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
