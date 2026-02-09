"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, RotateCcw } from "lucide-react"

import ChordTonesOverviewArticle from "../articles/short/chord-tones-overview-article"
import ChordTonesRecapArticle from "../articles/short/chord-tones-recap-article"
import ChordTonesReviewArticle from "../articles/short/chord-tones-review-article"
import MoveableShapesRecapArticle from "../articles/short/moveable-shapes-recap-article"
import NextChordTonesArticle from "../articles/short/next-chord-tones-article"
import PentatonicAToGArticle from "../articles/short/pentatonic-a-to-g-article"
import PentatonicCToAArticle from "../articles/short/pentatonic-c-to-a-article"
import PentatonicEToDArticle from "../articles/short/pentatonic-e-to-d-article"
import PentatonicGToEArticle from "../articles/short/pentatonic-g-to-e-article"
import PentatonicRecapArticle from "../articles/short/pentatonic-recap-article"
import RootsRecapArticle from "../articles/short/roots-recap-article"

const ARTICLE_COMPONENTS: Record<string, React.ComponentType> = {
  "roots-recap": RootsRecapArticle,
  "moveable-shapes-recap": MoveableShapesRecapArticle,
  "next-chord-tones": NextChordTonesArticle,
  "chord-tones-overview": ChordTonesOverviewArticle,
  "chord-tones-review": ChordTonesReviewArticle,
  "chord-tones-recap": ChordTonesRecapArticle,
  "pentatonic-c-to-a": PentatonicCToAArticle,
  "pentatonic-a-to-g": PentatonicAToGArticle,
  "pentatonic-g-to-e": PentatonicGToEArticle,
  "pentatonic-e-to-d": PentatonicEToDArticle,
  "pentatonic-recap": PentatonicRecapArticle,
}

interface ShortArticlePhaseProps {
  articleId: string
  onContinue: () => void
  onRetry?: () => void
}

export default function ShortArticlePhase({
  articleId,
  onContinue,
  onRetry,
}: ShortArticlePhaseProps) {
  const ArticleContent = ARTICLE_COMPONENTS[articleId]

  if (!ArticleContent) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">Article not found: {articleId}</p>
        <Button onClick={onContinue}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-y-auto">
          <ArticleContent />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {onRetry && (
          <Button variant="outline" size="lg" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Practice Again
          </Button>
        )}
        <Button size="lg" onClick={onContinue}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
