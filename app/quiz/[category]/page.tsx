'use client';
import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import ImageQuiz from '@/components/ImageQuiz';
import AudioQuiz from '@/components/AudioQuiz';
import FoodQuiz from '@/components/FoodQuiz';
import TextQuiz from '@/components/TextQuiz';

const TOTAL = 5;

const LABELS: Record<string, string> = {
  image: '画像クイズ', audio: '音楽クイズ', food: '料理クイズ', text: '文章クイズ',
};

export default function QuizPage() {
  const params = useParams();
  const category = params.category as string;
  const router = useRouter();
  const { score, total } = useGameStore();
  const [questionIdx, setQuestionIdx] = useState(0);

  function next() {
    if (questionIdx + 1 >= TOTAL) {
      router.push('/result');
    } else {
      setQuestionIdx(q => q + 1);
    }
  }

  const QuizComponent = {
    image: ImageQuiz,
    audio: AudioQuiz,
    food: FoodQuiz,
    text: TextQuiz,
  }[category];

  if (!QuizComponent) return <div>不明なカテゴリです</div>;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-sm">← 戻る</button>
          <span className="text-sm text-gray-400">{LABELS[category]}</span>
          <span className="text-yellow-400 font-bold">{score}/{total}</span>
        </div>
        <div className="w-full bg-gray-800 h-1 rounded-full">
          <div className="bg-yellow-400 h-1 rounded-full transition-all" style={{ width: `${(questionIdx / TOTAL) * 100}%` }} />
        </div>
        <div className="text-sm text-gray-400 text-center">問題 {questionIdx + 1} / {TOTAL}</div>
        <QuizComponent key={questionIdx} onNext={next} />
      </div>
    </main>
  );
}
