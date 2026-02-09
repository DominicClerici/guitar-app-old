"use client"

import { Award, Sparkles } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  HighlightBox,
} from "../article-primitives"

export default function NextChordTonesArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="from-primary to-primary/80 flex size-16 items-center justify-center rounded-full bg-gradient-to-br">
            <Award className="text-primary-foreground size-8" />
          </div>
          <ArticleHeading>Roots Mastered!</ArticleHeading>
        </div>
        <ArticleParagraph>
          Congratulations! You now know the root note positions across all 5 CAGED shapes and can
          find them in any key. This is the foundation that everything else builds on.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Sparkles} variant="default" title="Next up: Chord Tones">
          <div className="space-y-3">
            <p>
              So far you have been locating the <strong>root (1st)</strong> in each shape. Chord
              tones add the <strong>3rd</strong> and <strong>5th</strong> scale degrees to the
              picture.
            </p>
            <p>
              Together, the root, 3rd, and 5th form a <strong>major triad</strong>. These are the
              notes that outline any chord, making them essential for both rhythm and lead guitar.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <p className="text-muted-foreground mb-4 text-center text-sm font-medium">
            What chord tones will teach you
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/30">
                <span className="text-xs font-bold text-white">R</span>
              </div>
              <p className="text-foreground text-sm font-medium">Root (1st)</p>
              <p className="text-muted-foreground mt-1 text-xs">You know this one!</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30">
                <span className="text-xs font-bold text-white">3</span>
              </div>
              <p className="text-foreground text-sm font-medium">3rd</p>
              <p className="text-muted-foreground mt-1 text-xs">Major or minor quality</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-500/30">
                <span className="text-xs font-bold text-white">5</span>
              </div>
              <p className="text-foreground text-sm font-medium">5th</p>
              <p className="text-muted-foreground mt-1 text-xs">Stability and fullness</p>
            </div>
          </div>
        </div>
      </ArticleSection>
    </article>
  )
}
