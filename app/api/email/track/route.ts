import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// 1x1 透明GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('cid');
  const email = searchParams.get('email');

  if (campaignId && email) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('email_events').insert({
        campaign_id: campaignId,
        email,
        event_type: 'opened',
      });
    } catch {
      // トラッキング失敗はサイレント
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
