import { createHmac, timingSafeEqual } from 'crypto';

// ============================================================================
// メール法令対応の共通ユーティリティ
//  - 特定電子メール法: 配信停止（オプトアウト）導線・送信者表示の強制
//  - HMAC 署名トークン: 配信停止リンク／開封トラッキングの改竄防止
// サーバー専用（crypto / 環境変数を使用）。クライアントから import しないこと。
// ============================================================================

// 署名用シークレット。専用の UNSUBSCRIBE_SECRET を優先し、未設定なら
// サーバー専用のサービスロールキーにフォールバック（必ず存在するため）。
function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!s) {
    console.error('email-compliance: no signing secret configured (UNSUBSCRIBE_SECRET / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return s;
}

function sign(purpose: string, value: string): string {
  return createHmac('sha256', getSecret()).update(`${purpose}:${value}`).digest('base64url');
}

export function makeToken(purpose: string, value: string): string {
  return sign(purpose, value);
}

export function verifyToken(purpose: string, value: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(sign(purpose, value));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

// HTML 属性／本文への安全な埋め込み
export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 送信時に絶対 https URL であることを保証する（相対 URL だとメール内のリンク・
// トラッキングピクセルが受信側で解決できず無音で壊れる）。
export function requireAbsoluteBaseUrl(): string {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? '').trim().replace(/\/$/, '');
  if (!/^https:\/\/.+/.test(baseUrl)) {
    throw new Error('NEXT_PUBLIC_BASE_URL must be set to an absolute https URL for email sending');
  }
  return baseUrl;
}

export function getCompanyInfo() {
  return {
    name: process.env.COMPANY_NAME || 'クロボ株式会社',
    address: process.env.COMPANY_ADDRESS || '',
    contact: process.env.COMPANY_CONTACT_EMAIL || '',
  };
}

export function buildUnsubscribeUrl(baseUrl: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  const token = makeToken('unsub', normalized);
  return `${baseUrl}/api/email/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

// 開封トラッキング用の署名付き URL
export function buildTrackingUrl(baseUrl: string, campaignId: string, email: string): string {
  const token = makeToken('track', `${campaignId}:${email.trim().toLowerCase()}`);
  return `${baseUrl}/api/email/track?cid=${encodeURIComponent(campaignId)}&email=${encodeURIComponent(email)}&t=${token}`;
}

// 特定電子メール法 第3条・第4条対応: 全送信メールに必ず付与する
// 「送信者表示 + 配信停止導線」フッター（管理者の手入力に依存しない）。
export function buildComplianceFooter(baseUrl: string, email: string): { html: string; text: string } {
  const c = getCompanyInfo();
  const unsub = buildUnsubscribeUrl(baseUrl, email);
  const html = `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.7;font-family:sans-serif;">
  <p style="margin:0 0 4px;">${escapeHtml(c.name)}${c.address ? `　${escapeHtml(c.address)}` : ''}</p>
  ${c.contact ? `<p style="margin:0 0 4px;">お問い合わせ：<a href="mailto:${escapeHtml(c.contact)}" style="color:#6b7280;">${escapeHtml(c.contact)}</a></p>` : ''}
  <p style="margin:0;">本メールの配信停止をご希望の場合は <a href="${escapeHtml(unsub)}" style="color:#2563eb;">こちら</a> よりお手続きください。</p>
</div>`.trim();
  const text =
    `\n\n--\n${c.name}${c.address ? ` ${c.address}` : ''}\n` +
    (c.contact ? `お問い合わせ：${c.contact}\n` : '') +
    `配信停止：${unsub}\n`;
  return { html, text };
}

// RFC 8058 ワンクリック配信停止ヘッダー
export function listUnsubscribeHeaders(baseUrl: string, email: string): Record<string, string> {
  const unsub = buildUnsubscribeUrl(baseUrl, email);
  return {
    'List-Unsubscribe': `<${unsub}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
