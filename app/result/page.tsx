'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { saveScore } from '@/lib/supabase';

function getRank(score: number, total: number) {
  // Guard against division by zero (e.g. direct navigation with no result).
  if (total <= 0) return { title: '', emoji: '❓' };
  const pct = score / total;
  if (pct === 1) return { title: '真の一流品を知る人', emoji: '👑' };
  if (pct >= 0.8) return { title: '上流階級の素養あり', emoji: '✨' };
  if (pct >= 0.6) return { title: 'なかなかの目利き', emoji: '👍' };
  if (pct >= 0.4) return { title: '庶民的センスの持ち主', emoji: '😅' };
  return { title: '格付けチェック失格', emoji: '🥲' };
}

function parseScoreParam(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : null;
}

function ResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { score: storeScore, total: storeTotal, category: storeCategory, nickname, setNickname, reset } = useGameStore();
  const [saved, setSaved] = useState(false);

  // Prefer values from the URL (shared links) when present, otherwise fall back
  // to the in-memory store from a just-completed quiz.
  const paramScore = parseScoreParam(searchParams.get('score'));
  const paramTotal = parseScoreParam(searchParams.get('total'));
  const paramCategory = searchParams.get('category');

  const hasUrlResult = paramTotal !== null && paramTotal > 0 && paramScore !== null && paramScore <= paramTotal;

  const score = hasUrlResult ? paramScore! : storeScore;
  const total = hasUrlResult ? paramTotal! : storeTotal;
  const category = hasUrlResult ? paramCategory : storeCategory;

  // No result available from either source — show a friendly prompt home.
  if (total <= 0) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="text-6xl">🎲</div>
          <h1 className="text-2xl font-bold">結果がありません</h1>
          <p className="text-gray-400 text-sm">まだ挑戦していないか、結果が見つかりませんでした。<br />カテゴリを選んで格付けチェックに挑戦しましょう。</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-xl transition-colors"
          >
            ホームへ戻る
          </button>
        </div>
      </main>
    );
  }

  const rank = getRank(score, total);
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/result?score=${score}&total=${total}&category=${category ?? ''}`;

  async function handleSave() {
    if (!nickname.trim()) return;
    await saveScore(nickname, category || 'unknown', score, total);
    setSaved(true);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <div className="text-6xl">{rank.emoji}</div>
          <h1 className="text-3xl font-bold">{score}<span className="text-gray-400 text-xl">/{total}</span></h1>
          <p className="text-yellow-400 font-bold">{rank.title}</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-gray-400">ニックネームを入力してスコアを保存</p>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="あなたの名前"
            className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
          />
          <button
            onClick={handleSave}
            disabled={saved || !nickname.trim()}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold rounded-xl transition-colors"
          >
            {saved ? '保存しました' : 'スコアを保存する'}
          </button>
        </div>
        <div className="bg-gray-900 rounded-2xl p-5 space-y-2">
          <p className="text-sm text-gray-400">友達にシェアして比べよう</p>
          <p className="text-xs font-mono text-yellow-400 break-all">{shareUrl}</p>
          <button
            onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="w-full py-2 border border-gray-600 hover:border-yellow-400 rounded-xl text-sm transition-colors"
          >
            URLをコピー
          </button>
        </div>
        <button
          onClick={() => { reset(); router.push('/'); }}
          className="w-full py-3 border border-gray-600 hover:border-white rounded-xl transition-colors"
        >
          別のカテゴリに挑戦
        </button>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
          <p className="text-gray-400">読み込み中...</p>
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
