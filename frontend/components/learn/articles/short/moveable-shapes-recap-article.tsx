"use client"

import { Lightbulb, Zap } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  FretboardDiagram,
  HighlightBox,
} from "../article-primitives"

export default function MoveableShapesRecapArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <ArticleHeading>Shapes Move, Order Stays</ArticleHeading>
        <ArticleParagraph>
          You just played the same 5 CAGED shapes in C, D#, and F major. Notice something? The shape
          order was always C-A-G-E-D. The only thing that changed was where the shapes started on
          the neck.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                <span className="font-display text-sm font-bold text-white">E</span>
              </div>
              <div>
                <p className="text-sm font-medium">C Major</p>
                <p className="text-muted-foreground text-xs">E shape at fret 8</p>
              </div>
            </div>
            <FretboardDiagram
              positions={[
                { string: 5, fret: 8, degree: "1" },
                { string: 3, fret: 10, degree: "1" },
                { string: 0, fret: 8, degree: "1" },
              ]}
              highlightFrets={[7, 11]}
              showOpenStrings={false}
              compact
            />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                <span className="font-display text-sm font-bold text-white">E</span>
              </div>
              <div>
                <p className="text-sm font-medium">D# Major</p>
                <p className="text-muted-foreground text-xs">E shape at fret 11</p>
              </div>
            </div>
            <FretboardDiagram
              positions={[
                { string: 5, fret: 11, degree: "1" },
                { string: 3, fret: 13, degree: "1" },
                { string: 0, fret: 11, degree: "1" },
              ]}
              highlightFrets={[10, 14]}
              showOpenStrings={false}
              compact
            />
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                <span className="font-display text-sm font-bold text-white">E</span>
              </div>
              <div>
                <p className="text-sm font-medium">F Major</p>
                <p className="text-muted-foreground text-xs">E shape at fret 1</p>
              </div>
            </div>
            <FretboardDiagram
              positions={[
                { string: 5, fret: 1, degree: "1" },
                { string: 3, fret: 3, degree: "1" },
                { string: 0, fret: 1, degree: "1" },
              ]}
              highlightFrets={[0, 4]}
              showOpenStrings={false}
              compact
            />
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Zap} variant="note" title="Same shapes, different positions">
          <p>
            The E shape always looks the same, whether you play it at fret 1 (F major), fret 8 (C
            major), or fret 11 (D# major). The root note position determines the key.
          </p>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="The power of moveable shapes">
          <p>
            This is why the CAGED system is so powerful: learn 5 shapes once, and you can play in
            all 12 keys. You just need to know where the root note lands for each key.
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
