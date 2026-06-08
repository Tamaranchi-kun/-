import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const BUCKET = 'email-images';
const MAX_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// 拡張子はクライアント由来のファイル名ではなく、検証済みのMIMEタイプから決定する
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

// 認証は middleware.ts の Basic 認証で行う
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `対応形式: ${ALLOWED_TYPES.map((t) => t.split('/')[1]).join(', ')}` },
      { status: 400 },
    );
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `ファイルサイズは ${MAX_MB}MB 以下にしてください` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const ext = EXT_BY_TYPE[file.type] ?? 'bin';
  // パスにタイムスタンプとランダム値を入れて衝突を防ぐ
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error('storage upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicData.publicUrl });
}
