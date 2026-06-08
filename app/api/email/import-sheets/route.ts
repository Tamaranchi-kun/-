import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB 上限（大容量レスポンスによるメモリ枯渇を防止）

// Google スプレッドシートのCSVをサーバー側でフェッチ（CORS回避）
// 認証は proxy.ts の Basic 認証で行う
export async function POST(req: Request) {
  const { url } = await req.json();
  if (typeof url !== 'string' || !url) {
    return NextResponse.json({ error: '有効なGoogle SheetsのURLを入力してください' }, { status: 400 });
  }

  // URLをパースしてホスト検証（文字列置換ベースだと `docs.google.com.evil.example` で通ってしまう）
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'URLの形式が不正です' }, { status: 400 });
  }
  if (parsed.hostname !== 'docs.google.com') {
    return NextResponse.json({ error: 'Google SheetsのURLのみ対応しています' }, { status: 400 });
  }

  // /spreadsheets/d/<ID>/... からIDを抽出
  const m = parsed.pathname.match(/\/spreadsheets\/d\/(?:e\/)?([A-Za-z0-9_-]+)/);
  if (!m) {
    return NextResponse.json({ error: 'スプレッドシートIDを取得できませんでした' }, { status: 400 });
  }
  const id = m[1];
  // gid（シート指定）があれば引き継ぐ
  const gid = parsed.searchParams.get('gid') ?? new URLSearchParams(parsed.hash.slice(1)).get('gid');
  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ''}`;

  try {
    // Googleのexportは googleusercontent.com へリダイレクトしてCSVを返すため follow は許容。
    // タイムアウトとサイズ上限で上流ハング・メモリ枯渇を防ぐ。
    const res = await fetch(csvUrl, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'シートの取得に失敗しました。「ウェブに公開」設定を確認してください。' },
        { status: 502 },
      );
    }
    const lenHeader = Number(res.headers.get('content-length') ?? '0');
    if (lenHeader && lenHeader > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'シートが大きすぎます（5MB以下にしてください）' }, { status: 413 });
    }
    const text = await res.text();
    if (text.length > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'シートが大きすぎます（5MB以下にしてください）' }, { status: 413 });
    }
    return NextResponse.json({ csv: text });
  } catch (err) {
    console.error('sheets fetch error:', err);
    return NextResponse.json({ error: 'シートの取得中にエラーが発生しました' }, { status: 502 });
  }
}
