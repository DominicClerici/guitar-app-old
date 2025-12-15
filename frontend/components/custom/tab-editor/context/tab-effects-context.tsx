"use client"
import { PartialNullable } from "@/lib/utils"
import { TabDataEffectsSettings } from "@guitar/db"
import React, { createContext, useContext, useRef, useState } from "react"
import * as Tone from "tone"

export type EffectsSettings = Exclude<TabDataEffectsSettings, string>

const DEFAULT_EFFECTS: EffectsSettings = {
  reverb: {
    enabled: true,
    presetId: "", // Will be set to first available preset on load
    wet: 0.3,
    preDelay: 0.02,
    decay: 1.0,
    highCut: 8000,
  },
  sampler: {
    volume: -6,
  },
  limiter: {
    enabled: true,
    threshold: -1,
  },
  compressor: {
    enabled: true,
    threshold: -12,
    ratio: 4,
    attack: 0.003,
    release: 0.25,
  },
  master: {
    gain: 0.8,
  },
  velocityScale: 0.5,
}

const TabEffectsContext = createContext<{
  effects: EffectsSettings
  setEffects: React.Dispatch<React.SetStateAction<EffectsSettings>>
  buildEffectsChain: (settings: EffectsSettings, irUrl: string | undefined) => Promise<EffectsChain>
  resetEffects: () => void
} | null>(null)

export type EffectsChain = {
  dryGain: Tone.Gain
  preDelay: Tone.Delay
  convolver: Tone.Convolver
  highCut: Tone.Filter
  reverbGain: Tone.Gain
  compressor: Tone.Compressor
  limiter: Tone.Limiter
  masterGain: Tone.Gain
}

function disposeEffectsChain(chain: PartialNullable<EffectsChain>): void {
  if (!chain) return

  const nodes = [
    chain.dryGain,
    chain.preDelay,
    chain.convolver,
    chain.highCut,
    chain.reverbGain,
    chain.compressor,
    chain.limiter,
    chain.masterGain,
  ]

  nodes.forEach((node) => {
    if (node) {
      node.disconnect()
      node.dispose()
    }
  })
}

export default function TabEffectsContextProvider({ children }: { children: React.ReactNode }) {
  const [effects, setEffects] = useState<EffectsSettings>(DEFAULT_EFFECTS)
  const convolverRef = useRef<Tone.Convolver | null>(null)
  const reverbGainRef = useRef<Tone.Gain | null>(null) // Wet gain for convolver
  const dryGainRef = useRef<Tone.Gain | null>(null) // Dry signal path
  const preDelayRef = useRef<Tone.Delay | null>(null) // Pre-delay before reverb
  const reverbHighCutRef = useRef<Tone.Filter | null>(null) // High cut filter on reverb
  const limiterRef = useRef<Tone.Limiter | null>(null)
  const compressorRef = useRef<Tone.Compressor | null>(null)
  const masterGainRef = useRef<Tone.Gain | null>(null)

  const resetEffects = () => {
    disposeEffectsChain({
      dryGain: dryGainRef.current,
      preDelay: preDelayRef.current,
      convolver: convolverRef.current,
      highCut: reverbHighCutRef.current,
      reverbGain: reverbGainRef.current,
      compressor: compressorRef.current,
      limiter: limiterRef.current,
      masterGain: masterGainRef.current,
    })
  }

  async function buildEffectsChain(
    settings: EffectsSettings,
    irUrl: string | undefined,
  ): Promise<EffectsChain> {
    resetEffects()
    // 1. Master gain (final volume control)
    const masterGain = new Tone.Gain(settings.master.gain)
    masterGain.toDestination()

    // 2. Limiter (prevents clipping)
    const limiter = new Tone.Limiter(settings.limiter.threshold)
    limiter.connect(masterGain)

    // 3. Compressor (dynamic range control)
    const compressor = new Tone.Compressor({
      threshold: settings.compressor.threshold,
      ratio: settings.compressor.ratio,
      attack: settings.compressor.attack,
      release: settings.compressor.release,
    })

    // Connect compressor to limiter if enabled
    if (settings.compressor.enabled) {
      compressor.connect(limiter)
    }

    // Mix point is where dry and wet signals combine
    const mixPoint = settings.compressor.enabled ? compressor : limiter

    // 4. Dry signal path
    const dryGain = new Tone.Gain(settings.reverb.enabled ? 1 - settings.reverb.wet : 1)
    dryGain.connect(mixPoint)

    // 5. Wet signal path - Pre-delay
    const preDelay = new Tone.Delay(settings.reverb.preDelay)

    // 6. Convolver (impulse response reverb)
    const convolver = new Tone.Convolver(irUrl)

    // 7. High cut filter (removes harsh high frequencies from reverb tail)
    const highCut = new Tone.Filter({
      frequency: settings.reverb.highCut,
      type: "lowpass",
      rolloff: -12,
    })

    // 8. Reverb wet gain
    const reverbGain = new Tone.Gain(settings.reverb.enabled ? settings.reverb.wet : 0)
    reverbGain.connect(mixPoint)

    // Connect wet signal chain: preDelay -> convolver -> highCut -> reverbGain
    preDelay.connect(convolver)
    convolver.connect(highCut)
    highCut.connect(reverbGain)

    return {
      dryGain,
      preDelay,
      convolver,
      highCut,
      reverbGain,
      compressor,
      limiter,
      masterGain,
    }
  }

  return (
    <TabEffectsContext.Provider value={{ effects, setEffects, buildEffectsChain, resetEffects }}>
      {children}
    </TabEffectsContext.Provider>
  )
}

export function useTabEffectsContext() {
  const context = useContext(TabEffectsContext)
  if (!context) {
    throw new Error("useTabEffectsContext must be used within TabEffectsContextProvider")
  }
  return context
}
