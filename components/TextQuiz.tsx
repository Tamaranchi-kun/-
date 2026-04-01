'use client';
import { useState } from 'react';
import { useGameStore } from '@/lib/store';
import humanPoems from '@/data/human_poems.json';
import aiPoems from '@/data/ai_poems.json';

export default function TextQuiz({ onNext }: { onNext: () => void }) {
  const addScore = useGameStore((s) => s.addScore);
  const [selected, setSelected] = useState<'A' | 'B' | null>(null);

  const humanIdx = Math.floor(Math.random() * humanPoems.length);
  const aiIdx = Math.floor(Math.random() * aiPoems.length);
  const isHumanA = Math.random() > 0.5;

  const poemA = isHumanA ? humanPoems[humanIdx] : aiPoems[aiIdx];
  const poemB = isHumanA ? aiPoems[aiIdx] : humanPoems[humanIdx];
  const humanLabel = isHumanA ? 'A' : 'B';

  function choose(label: 'A' | 'B') {
    if (selected) return;
    setSelected(label);
    addScore(label === humanLabel);
  }

  const correct = selected === humanLabel;

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-gray-500">どちらが人間が書いた詩・文章？</p>
      <div className="space-y-4">
        {[{ label: 'A' as const, poem: poemA }, { label: 'B' as const, poem: poemB }].map(({ label, poem }) => (
          <button
            key={label}
            onClick={() => choose(label)}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
              selected === null
                ? 'border-gray-200 hover:border-yellow-400 cursor-pointer'
                : label === humanLabel
                ? 'border-green-400 bg-green-50'
                : selected === label
                ? 'border-red-400 bg-red-50'
                : 'border-gray-100 opacity-60'
            }`}
          >
            <p className="font-bold text-xs text-gray-400 mb-2">作品 {label}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed font-serif">
              {'text' in poem ? poem.text : ''}
            </p>
            {selected !== null && label === humanLabel && (
              <p className="mt-2 text-xs text-gray-500">
                — {'author' in poem ? (poem as { author: string }).author : 'AI生成'}
                {'source' in poem ? ` (${(poem as { source: string }).source})` : ''}
              </p>
            )}
          </button>
        ))}
      </div>
      {selected && (
        <div className="space-y-3">
          <div className={`text-center py-3 rounded-xl font-bold ${correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {correct ? '正解！人間の感性を見抜いた！' : `不正解... 人間作品は ${humanLabel} でした`}
          </div>
          <button onClick={onNext} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl">
            次の問題へ →
          </button>
        </div>
      )}
    </div>
  );
}
