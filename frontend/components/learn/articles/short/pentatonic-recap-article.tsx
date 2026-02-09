"use client"

import { Award, Lightbulb, Music, Sparkles } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  HighlightBox,
} from "../article-primitives"

export default function PentatonicRecapArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="from-primary to-primary/80 flex size-16 items-center justify-center rounded-full bg-gradient-to-br">
            <Award className="text-primary-foreground size-8" />
          </div>
          <ArticleHeading>Minor Pentatonic Mastered!</ArticleHeading>
        </div>
        <ArticleParagraph>
          Congratulations! You can now play the minor pentatonic scale across all 5 CAGED shapes.
          That means you have access to the most widely used scale in guitar music, in every
          position on the fretboard and in every key.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Music} variant="important" title="Practice is everything">
          <div className="space-y-3">
            <p>
              Knowing the shapes is the first step. The real skill is being able to move through
              them <strong>fluently</strong> while playing. Regular practice builds the muscle
              memory that makes these patterns second nature.
            </p>
            <p>
              Even 5 minutes of daily practice with these shapes will make a big difference. Aim to
              reach the point where your fingers find the notes without any conscious effort.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Sparkles} variant="default" title="Next up: Major Scale">
          <div className="space-y-3">
            <p>
              The major scale adds the <strong>4th</strong> and <strong>7th</strong> degrees to give
              you the complete 7-note scale. These are the tension notes that the pentatonic
              deliberately avoids.
            </p>
            <p>
              Mastering the major scale unlocks even more expressive possibilities — from resolving
              melodies to understanding harmony at a deeper level.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <p className="text-muted-foreground mb-4 text-center text-sm font-medium">
            Your fretboard knowledge is growing
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/30">
                <span className="text-xs font-bold text-white">R</span>
              </div>
              <p className="text-foreground text-sm font-medium">Roots</p>
              <p className="text-muted-foreground mt-1 text-xs">Mastered</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 shadow-md shadow-violet-500/30">
                <span className="text-xs font-bold text-white">1-3-5</span>
              </div>
              <p className="text-foreground text-sm font-medium">Chord Tones</p>
              <p className="text-muted-foreground mt-1 text-xs">Mastered</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center ring-2 ring-violet-500/30">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-500/30">
                <Music className="size-4 text-white" />
              </div>
              <p className="text-foreground text-sm font-medium">Pentatonic</p>
              <p className="text-muted-foreground mt-1 text-xs">Just completed!</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center opacity-60">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30">
                <Music className="size-4 text-white" />
              </div>
              <p className="text-foreground text-sm font-medium">Major Scale</p>
              <p className="text-muted-foreground mt-1 text-xs">Up next</p>
            </div>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="Keep building">
          <p>
            The major scale builds directly on the pentatonic patterns you just learned. The
            stronger your pentatonic foundation, the faster you&apos;ll master the full scale — so
            keep practicing!
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
