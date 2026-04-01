'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useGameStore } from '@/lib/store';

type Choice = {
  url: string;
  isReal: boolean;
  label: string;
  credit?: string;
};

export default function ImageQuiz({ onNext }: { onNext: () => void }) {
  const addScore = useGameStore((s) => s.addScore);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelected(null);
      try {
        const res = await fetch('/api/image-question');
        const data = await res.json();
        setChoices(data.choices);
      } catch {
        setChoices([
          { url: 'https://picsum.photos/seed/real1/400', isReal: true, label: 'A', credit: 'Sample Photo' },
          { url: 'https://picsum.photos/seed/ai1/400', isReal: false, label: 'B' },
        ]);
      }
      setLoading(false);
    }
    load();
  }, []);

  function choose(i: number) {
    if (selected !== null) return;
    setSelected(i);
    addScore(choices[i].isReal);
  }

  if (loading) return <div className="text-center py-20 text-gray-400">問題を読み込み中...</div>;

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-gray-500">どちらが本物の写真？</p>
      <div className="grid grid-cols-2 gap-4">
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={`relative rounded-2xl overflow-hidden border-4 transition-all ${
              selected === null
                ? 'border-transparent hover:border-yellow-400 cursor-pointer'
                : c.isReal
                ? 'border-green-400'
                : selected === i
                ? 'border-red-400'
                : 'border-transparent opacity-60'
            }`}
          >
            <div className="aspect-square relative">
              <Image src={c.url} alt={c.label} fill className="object-cover" unoptimized />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-center py-2 font-bold text-lg">
              {c.label}
            </div>
            {selected !== null && c.isReal && (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                本物 ✓
              </div>
            )}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="space-y-3">
          <div className={`text-center py-3 rounded-xl font-bold ${choices[selected].isReal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {choices[selected].isReal ? '正解！本物の写真を見抜いた！' : '不正解... AI生成画像でした'}
          </div>
          {choices.find(c => c.isReal)?.credit && (
            <p className="text-xs text-center text-gray-400">
              Photo by {choices.find(c => c.isReal)?.credit} on Unsplash
            </p>
          )}
          <button onClick={onNext} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors">
            次の問題へ →
          </button>
        </div>
      )}
    </div>
  );
}
