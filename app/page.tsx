'use client';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';

const CATEGORIES = [
  { id: 'image', emoji: '🖼️', title: '画像', desc: 'AI生成 vs 本物写真' },
  { id: 'audio', emoji: '🎵', title: '音楽', desc: '高音質 vs 低音質' },
  { id: 'food', emoji: '🍱', title: '料理', desc: '栄養スコア対決' },
  { id: 'text', emoji: '✍️', title: '文章', desc: 'AI詩 vs 人間の詩' },
];

export default function Home() {
  const router = useRouter();
  const { setCategory } = useGameStore();

  function start(id: string) {
    setCategory(id as any);
    router.push(`/quiz/${id}`);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <p className="text-yellow-400 text-sm font-bold tracking-widest uppercase">格付けチェック</p>
          <h1 className="text-4xl font-bold">本物を<br />見抜けるか？</h1>
          <p className="text-gray-400 text-sm">4カテゴリで本物と偽物を見極めろ</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => start(c.id)}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-yellow-400 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="text-3xl mb-2">{c.emoji}</div>
              <div className="font-bold">{c.title}</div>
              <div className="text-xs text-gray-400 group-hover:text-gray-300">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
