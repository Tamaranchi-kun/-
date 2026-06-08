'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    // global-error replaces the root layout, so it must define its own
    // <html> and <body> tags.
    <html lang="ja">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          backgroundColor: '#000',
          color: '#fff',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <title>エラーが発生しました - 格付けチェック</title>
        <div style={{ maxWidth: '28rem', width: '100%' }}>
          <p
            style={{
              color: '#facc15',
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 0.5rem',
            }}
          >
            格付けチェック
          </p>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            問題が発生しました
          </h1>
          <p
            style={{
              color: '#9ca3af',
              fontSize: '0.875rem',
              margin: '0 0 2rem',
            }}
          >
            予期しないエラーが発生しました。お手数ですが、もう一度お試しください。
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#facc15',
              color: '#000',
              fontWeight: 700,
              borderRadius: '1rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            もう一度試す
          </button>
        </div>
      </body>
    </html>
  );
}
