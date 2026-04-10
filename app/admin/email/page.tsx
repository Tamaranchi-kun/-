'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type CampaignStats = {
  id: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  status: string;
  total_sent: number;
  created_at: string;
  sent_at: string | null;
  list_id: string | null;
  list_name: string;
  opened: number;
  bounced: number;
  open_rate: string;
  bounce_rate: string;
};

type ListGroup = {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
};

type Recipient = {
  email: string;
  name: string | null;
  company_name: string | null;
  created_at: string;
};

type Tab = 'send' | 'list' | 'stats';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

export default function EmailAdminPage() {
  const [tab, setTab] = useState<Tab>('send');
  const [form, setForm] = useState({
    subject: '',
    from_name: '',
    from_email: '',
    body_html: '',
    body_text: '',
    list_id: '',
    scheduled_at: '',
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">メール配信管理</h1>
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['send', 'list', 'stats'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'send' ? '送信' : t === 'list' ? '受信者リスト' : '効果検証'}
            </button>
          ))}
        </div>
        <div className={tab === 'send' ? '' : 'hidden'}><SendPanel form={form} setForm={setForm} /></div>
        <div className={tab === 'list' ? '' : 'hidden'}><ListPanel /></div>
        <div className={tab === 'stats' ? '' : 'hidden'}><StatsPanel /></div>
      </div>
    </div>
  );
}

// ── 送信パネル ──────────────────────────────────────────────
type FormState = { subject: string; from_name: string; from_email: string; body_html: string; body_text: string; list_id: string; scheduled_at: string };

function SendPanel({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [lists, setLists] = useState<ListGroup[]>([]);

  useEffect(() => {
    fetch('/api/email/lists', { headers: { 'x-admin-key': ADMIN_KEY } })
      .then((r) => r.json()).then((d) => setLists(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function handleSend() {
    setSending(true); setResult(null);
    try {
      const payload = { ...form, scheduled_at: form.scheduled_at || null };
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.scheduled) {
          setResult({ ok: true, message: `予約完了：${new Date(form.scheduled_at).toLocaleString('ja-JP')} に送信されます` });
        } else {
          setResult({ ok: true, message: `送信完了: ${json.total_sent}件` });
        }
        setForm({ ...form, subject: '', body_html: '', body_text: '', scheduled_at: '' });
      } else {
        setResult({ ok: false, message: json.error_detail ?? json.error ?? '送信失敗' });
      }
    } catch { setResult({ ok: false, message: '通信エラー' }); }
    finally { setSending(false); }
  }

  const isScheduled = !!form.scheduled_at && new Date(form.scheduled_at) > new Date();

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="送信者名" value={form.from_name} onChange={(v) => setForm({ ...form, from_name: v })} placeholder="クロボ" />
        <Field label="送信元メールアドレス" value={form.from_email} onChange={(v) => setForm({ ...form, from_email: v })} placeholder="noreply@crobo.co.jp" />
      </div>
      <Field label="件名" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="重要なお知らせ" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">送信先リスト</label>
        <select value={form.list_id} onChange={(e) => setForm({ ...form, list_id: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
          <option value="">すべての受信者</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}（{l.member_count}件）</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">本文 (HTML)</label>
        <textarea value={form.body_html} onChange={(e) => setForm({ ...form, body_html: e.target.value })} rows={8}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" placeholder="<p>こんにちは！</p>" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">本文 (テキスト・任意)</label>
        <textarea value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} rows={4}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" placeholder="プレーンテキスト版（迷惑メール対策に有効）" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          送信日時
          <span className="ml-2 text-xs text-gray-400 font-normal">（空白 = 即時送信）</span>
        </label>
        <input type="datetime-local" value={form.scheduled_at}
          onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        {isScheduled && (
          <p className="text-xs text-blue-600 mt-1">予約送信モード：{new Date(form.scheduled_at).toLocaleString('ja-JP')} に自動送信されます</p>
        )}
      </div>
      {result && (
        <div className={`rounded px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{result.message}</div>
      )}
      <button onClick={handleSend} disabled={sending || !form.subject || !form.body_html || !form.from_name || !form.from_email}
        className={`w-full text-white rounded py-2 px-4 font-medium disabled:opacity-50 transition-colors ${isScheduled ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
        {sending ? '処理中...' : isScheduled ? '配信を予約する' : '一括送信'}
      </button>
    </div>
  );
}

// ── 受信者リストパネル ────────────────────────────────────
function ListPanel() {
  const [lists, setLists] = useState<ListGroup[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  // インポートモード
  const [importMode, setImportMode] = useState<'text' | 'csv' | 'sheets'>('text');
  const [textInput, setTextInput] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLists = useCallback(async () => {
    const res = await fetch('/api/email/lists', { headers: { 'x-admin-key': ADMIN_KEY } });
    if (res.ok) { const d = await res.json(); setLists(Array.isArray(d) ? d : []); }
  }, []);

  const fetchRecipients = useCallback(async (listId: string) => {
    const url = listId ? `/api/email/recipients?list_id=${listId}` : '/api/email/recipients';
    const res = await fetch(url, { headers: { 'x-admin-key': ADMIN_KEY } });
    if (res.ok) setRecipients(await res.json());
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);
  useEffect(() => { fetchRecipients(selectedListId); }, [selectedListId, fetchRecipients]);

  async function createList() {
    if (!newListName.trim()) return;
    const res = await fetch('/api/email/lists', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ name: newListName.trim() }),
    });
    if (res.ok) { const d = await res.json(); setNewListName(''); await fetchLists(); setSelectedListId(d.id); }
  }

  async function deleteList(id: string) {
    if (!confirm('このリストを削除しますか？（受信者データは残ります）')) return;
    await fetch(`/api/email/lists/${id}`, { method: 'DELETE', headers: { 'x-admin-key': ADMIN_KEY } });
    if (selectedListId === id) setSelectedListId('');
    fetchLists();
  }

  async function deleteRecipient(email: string) {
    if (!confirm(`「${email}」を${selectedListId ? 'このリストから' : '完全に'}削除しますか？`)) return;
    await fetch('/api/email/recipients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ email, list_id: selectedListId || null }),
    });
    fetchRecipients(selectedListId);
    fetchLists();
  }

  // RFC4180準拠のCSVパーサー（ダブルクォート・改行含むフィールド対応）
  function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(field.trim()); field = ''; }
        else if (ch === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; }
        else if (ch !== '\r') { field += ch; }
      }
    }
    if (field || row.length > 0) { row.push(field.trim()); rows.push(row); }
    return rows.filter((r) => r.some((c) => c));
  }

  // CSVテキストをパースしてインポート
  async function importFromText(csv: string) {
    const rows = parseCsv(csv);
    if (rows.length === 0) { setMessage('有効なデータが見つかりません'); return; }

    const isEmailCol = (s: string) => /email|メールアドレス|mail/i.test(s);
    const isNameCol = (s: string) => /^(name|名前|氏名|担当者名)$/i.test(s);
    const isCompanyCol = (s: string) => /^(company|会社名|company_name)$/i.test(s);

    // ヘッダー行を検出
    let emailIdxList: number[] = [], nameIdx = -1, companyIdx = -1;
    let dataStart = 0;

    for (let li = 0; li < Math.min(5, rows.length); li++) {
      const cols = rows[li];
      const emailCols = cols.reduce<number[]>((acc, c, i) => { if (isEmailCol(c)) acc.push(i); return acc; }, []);
      if (emailCols.length > 0) {
        dataStart = li + 1;
        emailIdxList = emailCols;
        const ni = cols.findIndex((c) => isNameCol(c));
        const ci = cols.findIndex((c) => isCompanyCol(c));
        if (ni !== -1) nameIdx = ni;
        if (ci !== -1) companyIdx = ci;
        break;
      }
    }
    if (emailIdxList.length === 0) emailIdxList = [0];

    // メール列が複数ある場合は1行から複数の受信者を生成
    const recipients = rows.slice(dataStart).flatMap((cols) => {
      return emailIdxList.map((ei) => ({
        email: cols[ei] ?? '',
        name: nameIdx >= 0 ? (cols[nameIdx] || null) : null,
        company_name: companyIdx >= 0 ? (cols[companyIdx] || null) : null,
      }));
    }).filter((r) => r.email && r.email.includes('@'));
    if (recipients.length === 0) { setMessage('有効なメールアドレスが見つかりません'); return; }

    setLoading(true);
    const res = await fetch('/api/email/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ recipients, list_id: selectedListId || null }),
    });
    const json = await res.json();
    setMessage(res.ok ? `${json.inserted}件追加しました` : json.error ?? 'エラー');
    setTextInput(''); setSheetsUrl('');
    fetchRecipients(selectedListId); fetchLists();
    setLoading(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; importFromText(text); };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  async function handleSheetsImport() {
    setLoading(true);
    const res = await fetch('/api/email/import-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ url: sheetsUrl }),
    });
    const json = await res.json();
    if (!res.ok) { setMessage(json.error ?? 'エラー'); setLoading(false); return; }
    await importFromText(json.csv);
  }

  const selectedList = lists.find((l) => l.id === selectedListId);

  return (
    <div className="space-y-6">
      {/* リスト管理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">リスト管理</h2>
        <div className="flex gap-2 mb-4">
          <input type="text" value={newListName} onChange={(e) => setNewListName(e.target.value)}
            placeholder="新しいリスト名（例：営業先リスト）"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && createList()} />
          <button onClick={createList} disabled={!newListName.trim()}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-700">作成</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedListId('')}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedListId === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            すべて
          </button>
          {lists.map((l) => (
            <div key={l.id} className="flex items-center gap-1">
              <button onClick={() => setSelectedListId(l.id)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedListId === l.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                {l.name}（{l.member_count}）
              </button>
              <button onClick={() => deleteList(l.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* インポート */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            受信者を追加
            {selectedList && <span className="ml-2 text-blue-600">→ 「{selectedList.name}」に追加</span>}
            {!selectedListId && <span className="ml-2 text-gray-400">（リスト未選択）</span>}
          </h2>
          <div className="flex gap-1">
            {(['text', 'csv', 'sheets'] as const).map((m) => (
              <button key={m} onClick={() => setImportMode(m)}
                className={`px-3 py-1 text-xs rounded ${importMode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m === 'text' ? '手入力' : m === 'csv' ? 'CSVファイル' : 'Googleスプレッドシート'}
              </button>
            ))}
          </div>
        </div>

        {importMode === 'text' && (
          <>
            <p className="text-xs text-gray-500 mb-2">1行1件。カンマ区切りで入力（メールアドレス必須、名前・会社名は任意）</p>
            <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={6}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
              placeholder={"example@gmail.com, 山田太郎, 株式会社サンプル\nuser@company.com"} />
            <button onClick={() => importFromText(textInput)} disabled={loading || !textInput.trim()}
              className="mt-3 bg-blue-600 text-white rounded py-2 px-4 text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
              {loading ? '追加中...' : 'インポート'}
            </button>
          </>
        )}

        {importMode === 'csv' && (
          <>
            <p className="text-xs text-gray-500 mb-3">
              ヘッダー行がある場合は自動検出。ない場合は1列目をメールアドレスとして読み込みます。
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
              className="bg-blue-600 text-white rounded py-2 px-6 text-sm font-medium disabled:opacity-50 hover:bg-blue-700">
              {loading ? '取り込み中...' : 'CSVファイルを選択'}
            </button>
          </>
        )}

        {importMode === 'sheets' && (
          <>
            <div className="bg-blue-50 rounded p-3 mb-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">Googleスプレッドシートの準備手順：</p>
              <p>1. スプレッドシートを開く → ファイル → 共有 → <strong>ウェブに公開</strong></p>
              <p>2. 「シート全体」「カンマ区切りの値（.csv）」を選択して <strong>公開</strong></p>
              <p>3. 表示されたURLをコピーして下に貼り付け</p>
              <p className="text-blue-500">※ ヘッダー行（email/name/company等）があれば自動検出。なければ1列目をメールとして取り込みます。</p>
            </div>
            <input type="text" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-3" />
            <button onClick={handleSheetsImport} disabled={loading || !sheetsUrl.trim()}
              className="bg-green-600 text-white rounded py-2 px-4 text-sm font-medium disabled:opacity-50 hover:bg-green-700">
              {loading ? '取り込み中...' : 'スプレッドシートから取り込む'}
            </button>
          </>
        )}

        {message && <p className={`text-sm mt-3 ${message.includes('件') ? 'text-green-600' : 'text-red-500'}`}>{message}</p>}
      </div>

      {/* 受信者一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">受信者一覧</span>
          <span className="text-xs text-gray-400">{recipients.length}件</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500">メールアドレス</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">名前</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">会社名</th>
                <th className="text-left px-4 py-2 text-xs text-gray-500">登録日</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.email} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{r.email}</td>
                  <td className="px-4 py-2 text-gray-500">{r.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-500">{r.company_name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(r.created_at).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => deleteRecipient(r.email)}
                      className="text-gray-300 hover:text-red-500 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >削除</button>
                  </td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">受信者がいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 効果検証パネル ────────────────────────────────────────
function StatsPanel() {
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [lists, setLists] = useState<ListGroup[]>([]);
  const [filterListId, setFilterListId] = useState('');
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<CampaignStats | null>(null);

  useEffect(() => {
    fetch('/api/email/lists', { headers: { 'x-admin-key': ADMIN_KEY } })
      .then((r) => r.json()).then((d) => setLists(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = filterListId ? `/api/email/stats?list_id=${filterListId}` : '/api/email/stats';
    fetch(url, { headers: { 'x-admin-key': ADMIN_KEY } })
      .then((r) => r.json()).then((d) => { setCampaigns(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterListId]);

  return (
    <div className="space-y-4">
      {/* リスト絞り込み */}
      <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
        <span className="text-sm text-gray-600 font-medium">リストで絞り込み：</span>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterListId('')}
            className={`px-3 py-1 rounded-full text-sm border ${filterListId === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            すべて
          </button>
          {lists.map((l) => (
            <button key={l.id} onClick={() => setFilterListId(l.id)}
              className={`px-3 py-1 rounded-full text-sm border ${filterListId === l.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {/* キャンペーン一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? <div className="text-center py-12 text-gray-400">読み込み中...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-500">件名</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500">送信先リスト</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500">送信数</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500">開封率</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500">バウンス率</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500">送信日</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-500">状態</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{c.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.list_name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.total_sent.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{c.open_rate}</td>
                    <td className="px-4 py-3 text-right text-red-500">{c.bounce_rate}</td>
                    <td className="px-4 py-3 text-gray-400">{c.sent_at ? new Date(c.sent_at).toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setPreview(c)}
                        className="text-xs text-blue-500 hover:text-blue-700 underline">内容</button>
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">キャンペーンがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* メール内容プレビューモーダル */}
      {preview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <p className="font-semibold text-gray-800">{preview.subject}</p>
                <p className="text-xs text-gray-400 mt-0.5">{preview.list_name} ・ {preview.sent_at ? new Date(preview.sent_at).toLocaleDateString('ja-JP') : '-'}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <iframe srcDoc={preview.body_html} className="w-full border rounded" style={{ height: '400px' }} title="メールプレビュー" />
              {preview.body_text && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-1 font-medium">テキスト版</p>
                  <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 whitespace-pre-wrap">{preview.body_text}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { sent: 'bg-green-100 text-green-700', sending: 'bg-yellow-100 text-yellow-700', draft: 'bg-gray-100 text-gray-600', failed: 'bg-red-100 text-red-700' };
  const labels: Record<string, string> = { sent: '送信済', sending: '送信中', draft: '下書き', failed: '失敗' };
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>{labels[status] ?? status}</span>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
    </div>
  );
}
