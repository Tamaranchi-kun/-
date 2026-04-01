'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useGameStore } from '@/lib/store';

type Food = { name: string; imageUrl: string; nutriScore: string; brand: string };

const FOOD_QUERIES = ['chocolate', 'biscuit', 'yogurt', 'juice', 'chips'];

export default function FoodQuiz({ onNext }: { onNext: () => void }) {
  const addScore = useGameStore((s) => s.addScore);
  const [foods, setFoods] = useState<[Food, Food] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const query = FOOD_QUERIES[Math.floor(Math.random() * FOOD_QUERIES.length)];

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSelected(null);
      try {
        const res = await fetch(`/api/food-question?query=${query}`);
        const data = await res.json();
        setFoods(data.foods);
      } catch {
        setFoods(null);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">食品データを取得中...</div>;
  if (!foods) return <div className="text-center py-20 text-gray-400">データを取得できませんでした</div>;

  const betterIdx = foods[0].nutriScore < foods[1].nutriScore ? 0 : 1;

  function choose(i: number) {
    if (selected !== null) return;
    setSelected(i);
    addScore(i === betterIdx);
  }

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-gray-500">どちらが栄養スコア（Nutri-Score）が高い？</p>
      <div className="grid grid-cols-2 gap-4">
        {foods.map((f, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            className={`rounded-2xl overflow-hidden border-4 transition-all text-left ${
              selected === null
                ? 'border-transparent hover:border-yellow-400 cursor-pointer'
                : i === betterIdx
                ? 'border-green-400'
                : selected === i
                ? 'border-red-400'
                : 'border-transparent opacity-60'
            }`}
          >
            <div className="aspect-square relative bg-gray-100">
              <Image src={f.imageUrl} alt={f.name} fill className="object-contain p-2" unoptimized />
            </div>
            <div className="p-3 bg-white">
              <p className="font-bold text-sm line-clamp-2">{f.name}</p>
              <p className="text-xs text-gray-400">{f.brand}</p>
              {selected !== null && (
                <p className="mt-1 font-bold text-sm">
                  Nutri-Score: <span className="uppercase">{f.nutriScore}</span>
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="space-y-3">
          <div className={`text-center py-3 rounded-xl font-bold ${selected === betterIdx ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {selected === betterIdx ? '正解！栄養を見抜いた！' : '不正解... もう一方が栄養豊富でした'}
          </div>
          <p className="text-xs text-center text-gray-400">Data: Open Food Facts (ODbL License)</p>
          <button onClick={onNext} className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl">
            次の問題へ →
          </button>
        </div>
      )}
    </div>
  );
}
