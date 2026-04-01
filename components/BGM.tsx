'use client'

import { useEffect, useRef, useState } from 'react'

const NOTES: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
}

const MELODY = [
  { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 }, { note: 'A4', dur: 0.4 },
  { note: 'C5', dur: 0.6 }, { note: 'A4', dur: 0.3 }, { note: 'G4', dur: 0.3 },
  { note: 'E4', dur: 0.6 }, { note: 'D4', dur: 0.4 }, { note: 'E4', dur: 0.4 },
  { note: 'G4', dur: 0.8 }, { note: 'C4', dur: 0.4 }, { note: 'D4', dur: 0.4 },
  { note: 'E4', dur: 0.4 }, { note: 'G4', dur: 0.4 }, { note: 'A4', dur: 1.0 },
]

export default function BGM() {
  const ctxRef = useRef<AudioContext | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)

  const playMelody = (ctx: AudioContext, gain: GainNode, startTime: number) => {
    let t = startTime
    MELODY.forEach(({ note, dur }) => {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = NOTES[note]
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(0.18, t + 0.02)
      env.gain.linearRampToValueAtTime(0, t + dur - 0.02)
      osc.connect(env)
      env.connect(gain)
      osc.start(t)
      osc.stop(t + dur)
      t += dur
    })
    return MELODY.reduce((s, n) => s + n.dur, 0)
  }

  const start = () => {
    if (ctxRef.current) return
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.gain.value = 1
    gain.connect(ctx.destination)
    ctxRef.current = ctx
    gainRef.current = gain
    const loop = () => {
      if (!ctxRef.current) return
      const dur = playMelody(ctx, gain, ctx.currentTime)
      timeoutRef.current = setTimeout(loop, dur * 1000 - 100)
    }
    loop()
    setStarted(true)
  }

  const toggle = () => {
    if (!started) { start(); setMuted(false); return }
    const next = !muted
    if (gainRef.current) gainRef.current.gain.value = next ? 0 : 1
    setMuted(next)
  }

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    ctxRef.current?.close()
  }, [])

  return (
    <button
      onClick={toggle}
      aria-label={started && !muted ? 'BGMをミュート' : 'BGMを再生'}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg border border-gray-700 hover:border-yellow-400 transition-colors"
    >
      {started && !muted ? (
        <>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
          </span>
          BGM ON
        </>
      ) : (
        <>
          <span className="h-3 w-3 rounded-full bg-gray-600" />
          BGM OFF
        </>
      )}
    </button>
  )
}
