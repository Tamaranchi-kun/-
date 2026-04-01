'use client';
import { useState, useRef } from 'react';
import { useGameStore } from '@/lib/store';

type TrackDef = { title: string; highFreq: number; lowFreq: number };

const tracks: TrackDef[] = [
  { title: 'ジャズ風メロディ', highFreq: 440, lowFreq: 220 },
  { title: 'クラシック風メロディ', highFreq: 523.25, lowFreq: 261.63 },
];

function generateAudio(ctx: AudioContext, quality: 'high' | 'low', baseFreq: number): AudioBufferSourceNode {
  const duration = 3;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // ハーモニクスで音色を作る
    let sample = Math.sin(2 * Math.PI * baseFreq * t) * 0.5;
    sample += Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.25;
    sample += Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.15;
    // フェードイン・アウト
    const fade = Math.min(t / 0.1, 1) * Math.min((duration - t) / 0.3, 1);
    if (quality === 'low') {
      // 低音質：量子化ノイズを加える
      sample = Math.round(sample * 8) / 8;
      sample += (Math.random() - 0.5) * 0.08;
    }
    data[i] = sample * fade * 0.6;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

export default function AudioQuiz({ onNext }: { onNext: () => void }) {
  const addScore = useGameStore((s) => s.addScore);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [playing, setPlaying] = useState<'A' | 'B' | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [trackIdx] = useState(() => Math.floor(Math.random() * tracks.length));
  const [isHighA] = useState(() => Math.random() > 0.5);
  const track = tracks[trackIdx];
  const humanLabel = isHighA ? 'A' : 'B';
  const correct = selected === humanLabel;

  function playAudio(which: 'A' | 'B') {
    sourceRef.current?.stop();
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    const quality = (which === 'A') === isHighA ? 'high' : 'low';
    const source = generateAudio(ctx, quality, track.highFreq);
    source.connect(ctx.destination);
    source.start();
    sourceRef.current = source;
    setPlaying(which);
    source.onended = () => setPlaying(null);
  }

  function choose(label: 'A' | 'B') {
    if (selected) return;
    sourceRef.current?.stop();
    setSelected(label);
    addScore(label === humanLabel);
  }

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-gray-500">どちらが高音質？ 聴き比べて答えてください</p>
      <p className="text-center font-medium">{track.title}</p>
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((label) => (
          <div key={label} className="space-y-2">
            <button
              onClick={() => playAudio(label)}
              className={`w-full py-4 rounded-xl border-2 font-bold text-2xl transition-all ${
                playing === label
                  ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                  : 'border-gray-600 hover:border-gray-400 text-white'
              }`}
            >
              {playing === label ? '♪ 再生中' : `${label} を聴く`}
            </button>
            {playing !== null || selected !== null ? (
              <button
                onClick={() => choose(label)}
                disabled={selected !== null}
                className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                  selected === null
                    ? 'bg-gray-700 text-white hover:bg-gray-600 cursor-pointer'
                    : selected === label
                    ? correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    : label === humanLabel && selected !== null
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {selected !== null && label === humanLabel ? '◎ 高音質' : `${label} が高音質`}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {selected && (
        <div className="space-y-3">
          <div className={`text-center py-3 rounded-xl font-bold ${correct ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {correct ? '正解！聴き分けられた！' : `不正解... 高音質は ${humanLabel} でした`}
          </div>
          <button onClick={onNext} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl">
            次の問題へ →
          </button>
        </div>
      )}
    </div>
  );
}
