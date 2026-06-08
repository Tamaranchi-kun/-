'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console / any attached reporting tooling.
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-yellow-400 text-sm font-bold tracking-widest uppercase">
            格付けチェック
          </p>
          <h1 className="text-3xl font-bold">問題が発生しました</h1>
          <p className="text-gray-400 text-sm">
            予期しないエラーが発生しました。お手数ですが、もう一度お試しください。
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-2xl px-6 py-3 transition-all"
          >
            もう一度試す
          </button>
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition-all"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
