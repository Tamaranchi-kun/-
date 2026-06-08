import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-yellow-400 text-sm font-bold tracking-widest uppercase">
            格付けチェック
          </p>
          <h1 className="text-6xl font-bold">404</h1>
          <h2 className="text-2xl font-bold">ページが見つかりません</h2>
          <p className="text-gray-400 text-sm">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
        </div>
        <Link
          href="/"
          className="inline-block bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-2xl px-6 py-3 transition-all"
        >
          ホームに戻る
        </Link>
      </div>
    </main>
  );
}
