'use client';
import { useState, useRef } from 'react';
import { useGameStore } from '@/lib/store';

const tracks = [
  { high: '/audio/track01_high.mp3', low: '/audio/track01_low.mp3', title: 'クラシック曲' },
  { high: '/audio/track02_high.mp3', low: '/audio/track02_low.mp3', title: 'ジャズ曲' },
];

export default function AudioQuiz({ onNext }: { onNext: () => void }) {
  const addScore = useGameStore((s) => s.addScore);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);
  const [playing, setPlaying] = useState<'A' | 'B' | null>(null);
  const trackIdx = Math.floor(Math.random() * tracks.length);
  const track = tracks[trackIdx];
  const isHighA = Math.random() > 0.5;
  const audioA = useRef<HTMLAudioElement>(null);
  const audioB = useRef<HTMLAudioElement>(null);

  function playAudio(which: 'A' | 'B') {
    setPlaying(which);
    if (which === 'A') {
      audioB.current?.pause();
      audioA.current?.play();
    } else {
      audioA.current?.pause();
      audioB.current?.play();
    }
  }

  function choose(which: 'A' | 'B') {
    if (selected) return;
    setSelected(which);
    const isCorrect = (which === 'A') === isHighA;
    addScore(isCorrect);
  }

  const highLabel = isHighA ? 'A' : 'B';
  const correct = selected && (selected === highLabel);

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-gray-500">どちらが高音質？ 聴き比べて答えてください</p>
      <p className="text-center font-medium">{track.title}</p>
      <audio ref={audioA} src={isHighA ? track.high : track.low} />
      <audio ref={audioB} src={isHighA ? track.low : track.high} />
      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B'] as const).map((label) => (
          <div key={label} className="space-y-2">
            <button
              onClick={() => playAudio(label)}
              className={`w-full py-4 rounded-xl border-2 font-bold text-2xl transition-all ${playing === label ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}
            >
              {playing === label ? '再生中' : `${label} を聴く`}
            </button>
            {playing !== null && (
              <button
                onClick={() => choose(label)}
                disabled={selected !== null}
                className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                  selected === null
                    ? 'bg-gray-800 text-white hover:bg-gray-700 cursor-pointer'
                    : selected === label
                    ? correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    : label === highLabel && selected !== null
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {selected !== null && label === highLabel ? '高音質' : `${label} が高音質`}
              </button>
            )}
          </div>
        ))}
      </div>
      {selected && (
        <div className="space-y-3">
          <div className={`text-center py-3 rounded-xl font-bold ${correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {correct ? '正解！聴き分けられた！' : `不正解... 高音質は ${highLabel} でした`}
          </div>
          <button onClick={onNext} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl">
            次の問題へ →
          </button>
        </div>
      )}
    </div>
  );
}
