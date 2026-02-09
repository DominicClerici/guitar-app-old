"use client"

import { Award, Lightbulb, Music, Sparkles } from "lucide-react"
import {
  ArticleHeading,
  ArticleParagraph,
  ArticleSection,
  HighlightBox,
} from "../article-primitives"

export default function ChordTonesRecapArticle() {
  return (
    <article className="space-y-8">
      <ArticleSection>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="from-primary to-primary/80 flex size-16 items-center justify-center rounded-full bg-gradient-to-br">
            <Award className="text-primary-foreground size-8" />
          </div>
          <ArticleHeading>Chord Tones Mastered!</ArticleHeading>
        </div>
        <ArticleParagraph>
          You can now locate the root, 3rd, and 5th within all 5 CAGED shapes. That means you have
          instant access to the notes that define any major chord, anywhere on the fretboard.
        </ArticleParagraph>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Music} variant="important" title="Practice is everything">
          <div className="space-y-3">
            <p>
              Knowing <em>where</em> the chord tones are is only half the battle. The real skill is
              being able to find them <strong>instantly</strong> while playing. Keep running through
              these shapes regularly — aim for the point where your fingers find the 1, 3, and 5
              without any conscious thought.
            </p>
            <p>
              Even 5 minutes of daily practice with these shapes will build the muscle memory that
              separates knowing from truly <strong>internalizing</strong> these positions.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Sparkles} variant="default" title="Next up: Minor Pentatonic">
          <div className="space-y-3">
            <p>
              You&apos;ve mastered the triad (1, 3, 5). The next step is the{" "}
              <strong>major pentatonic scale</strong>, which adds the <strong>2nd</strong> and{" "}
              <strong>6th</strong> scale degrees to your chord tone foundation.
            </p>
            <p>
              These two extra notes give you the melodic freedom to create flowing lines between
              your chord tone targets. It&apos;s the most popular scale in music for a reason.
            </p>
          </div>
        </HighlightBox>
      </ArticleSection>

      <ArticleSection>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900/50 to-zinc-950/80 p-6">
          <p className="text-muted-foreground mb-4 text-center text-sm font-medium">
            Your fretboard knowledge is growing
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4 text-center">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 shadow-md shadow-emerald-500/30">
                <span className="text-xs font-bold text-white">R</span>
              </div>
              <p className="text-foreground text-sm font-medium">Roots</p>
              <p className="text-muted-foreground mt-1 text-xs">Mastered</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center ring-2 ring-violet-500/30">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-600 shadow-md shadow-violet-500/30">
                <span className="text-xs font-bold text-white">1-3-5</span>
              </div>
              <p className="text-foreground text-sm font-medium">Chord Tones</p>
              <p className="text-muted-foreground mt-1 text-xs">Just completed!</p>
            </div>
            <div className="rounded-xl bg-white/5 p-4 text-center opacity-60">
              <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-500 shadow-md shadow-sky-500/30">
                <Music className="size-4 text-white" />
              </div>
              <p className="text-foreground text-sm font-medium">Pentatonic</p>
              <p className="text-muted-foreground mt-1 text-xs">Up next</p>
            </div>
          </div>
        </div>
      </ArticleSection>

      <ArticleSection>
        <HighlightBox icon={Lightbulb} variant="tip" title="Keep building">
          <p>
            The pentatonic scale builds directly on the chord tones you just learned. The stronger
            your chord tone foundation, the faster you&apos;ll master the pentatonic — so keep
            practicing!
          </p>
        </HighlightBox>
      </ArticleSection>
    </article>
  )
}
