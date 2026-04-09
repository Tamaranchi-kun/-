'use client';

import { useState, useEffect, useCallback } from 'react';

type Campaign = {
  id: string;
  subject: string;
  status: string;
  total_sent: number;
  created_at: string;
  sent_at: string | null;
};

type CampaignStats = Campaign & {
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

type Tab = 'send' | 'list' | 'stats';

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

export default function EmailAdminPage() {
  const [tab, setTab] = useState<Tab>('send');

  // 送信フォームの状態をここで管理（タブ切り替えで消えないようにする）
  const [form, setForm] = useState({
    subject: '',
    from_name: '',
    from_email: '',
    body_html: '',
    body_text: '',
    list_id: '',
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
                tab === t
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'send' ? '送信' : t === 'list' ? '受信者リスト' : '効果検証'}
            </button>
          ))}
        </div>

        {/* タブを全部レンダリングしてCSSで表示切り替え（状態保持のため） */}
        <div className={tab === 'send' ? '' : 'hidden'}>
          <SendPanel form={form} setForm={setForm} />
        </div>
        <div className={tab === 'list' ? '' : 'hidden'}>
          <ListPanel />
        </div>
        <div className={tab === 'stats' ? '' : 'hidden'}>
          <StatsPanel />
        </div>
      </div>
    </div>
  );
}

// ── 送信パネル ──────────────────────────────────────────────
type FormState = {
  subject: string;
  from_name: string;
  from_email: string;
  body_html: string;
  body_text: string;
  list_id: string;
};

function SendPanel({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [lists, setLists] = useState<ListGroup[]>([]);

  useEffect(() => {
    fetch('/api/email/lists', { headers: { 'x-admin-key': ADMIN_KEY } })
      .then((r) => r.json())
      .then((data) => setLists(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: `送信完了: ${json.total_sent}件` });
        setForm({ ...form, subject: '', body_html: '', body_text: '' });
      } else {
        setResult({ ok: false, message: json.error_detail ?? json.error ?? '送信失敗' });
      }
    } catch {
      setResult({ ok: false, message: '通信エラー' });
    } finally {
      setSending(false);
    }
  }

  const selectedList = lists.find((l) => l.id === form.list_id);

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="送信者名" value={form.from_name} onChange={(v) => setForm({ ...form, from_name: v })} placeholder="クロボ" />
        <Field label="送信元メールアドレス" value={form.from_email} onChange={(v) => setForm({ ...form, from_email: v })} placeholder="noreply@crobo.co.jp" />
      </div>
      <Field label="件名" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="重要なお知らせ" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">送信先リスト</label>
        <select
          value={form.list_id}
          onChange={(e) => setForm({ ...form, list_id: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">すべての受信者</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}（{l.member_count}件）</option>
          ))}
        </select>
        {form.list_id && selectedList && (
          <p className="text-xs text-gray-400 mt-1">対象: {selectedList.member_count}件</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">本文 (HTML)</label>
        <textarea
          value={form.body_html}
          onChange={(e) => setForm({ ...form, body_html: e.target.value })}
          rows={8}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          placeholder="<p>こんにちは！</p>"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">本文 (テキスト・任意)</label>
        <textarea
          value={form.body_text}
          onChange={(e) => setForm({ ...form, body_text: e.target.value })}
          rows={4}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          placeholder="プレーンテキスト版（迷惑メール対策に有効）"
        />
      </div>
      {result && (
        <div className={`rounded px-4 py-3 text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.message}
        </div>
      )}
      <button
        onClick={handleSend}
        disabled={sending || !form.subject || !form.body_html || !form.from_name || !form.from_email}
        className="w-full bg-blue-600 text-white rounded py-2 px-4 font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
      >
        {sending ? '送信中...' : '一括送信'}
      </button>
    </div>
  );
}

// ── 受信者リストパネル ────────────────────────────────────
function ListPanel() {
  const [lists, setLists] = useState<ListGroup[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<{ email: string; name: string | null; created_at: string }[]>([]);

  const fetchLists = useCallback(async () => {
    const res = await fetch('/api/email/lists', { headers: { 'x-admin-key': ADMIN_KEY } });
    if (res.ok) {
      const data = await res.json();
      setLists(Array.isArray(data) ? data : []);
    }
  }, []);

  const fetchRecipients = useCallback(async (listId: string) => {
    const url = listId ? `/api/email/recipients?list_id=${listId}` : '/api/email/recipients';
    const res = await fetch(url, { headers: { 'x-admin-key': ADMIN_KEY } });
    if (res.ok) setRecipients(await res.json());
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);
  useEffect(() => { fetchRecipients(selectedListId); }, [selectedListId, fetchRecipients]);

  async function handleCreateList() {
    if (!newListName.trim()) return;
    const res = await fetch('/api/email/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ name: newListName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewListName('');
      await fetchLists();
      setSelectedListId(data.id);
    }
  }

  async function handleDeleteList(id: string) {
    if (!confirm('このリストを削除しますか？（受信者データは残ります）')) return;
    await fetch(`/api/email/lists/${id}`, { method: 'DELETE', headers: { 'x-admin-key': ADMIN_KEY } });
    setSelectedListId('');
    fetchLists();
  }

  async function handleImport() {
    setLoading(true);
    const lines = emails.split('\n').map((l) => l.trim()).filter(Boolean);
    const list = lines.map((line) => {
      const [email, name] = line.split(',').map((s) => s.trim());
      return { email, name: name || null, list_id: selectedListId || null };
    });
    const res = await fetch('/api/email/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
      body: JSON.stringify({ recipients: list }),
    });
    const json = await res.json();
    setMessage(res.ok ? `${json.inserted}件追加しました` : json.error ?? 'エラー');
    setEmails('');
    fetchRecipients(selectedListId);
    fetchLists();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* リスト管理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">リスト管理</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="新しいリスト名（例：営業先リスト）"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
          />
          <button
            onClick={handleCreateList}
            disabled={!newListName.trim()}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            作成
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedListId('')}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              selectedListId === '' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            すべて
          </button>
          {lists.map((l) => (
            <div key={l.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedListId(l.id)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  selectedListId === l.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                }`}
              >
                {l.name}（{l.member_count}）
              </button>
              <button onClick={() => handleDeleteList(l.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* メールアドレス追加 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">メールアドレスを追加</h2>
        <p className="text-xs text-gray-500 mb-2">
          1行1件。「メール, 名前」の形式でも可。
          {selectedListId ? ` → 「${lists.find(l => l.id === selectedListId)?.name}」に追加` : ' → すべての受信者として追加'}
        </p>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
          placeholder={"example@gmail.com\nuser@company.com, 山田太郎"}
        />
        {message && <p className="text-sm text-green-600 mt-2">{message}</p>}
        <button
          onClick={handleImport}
          disabled={loading || !emails.trim()}
          className="mt-3 bg-blue-600 text-white rounded py-2 px-4 text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {loading ? '追加中...' : 'インポート'}
        </button>
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
                <th className="text-left px-4 py-2 text-xs text-gray-500">登録日</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.email} className="border-t border-gray-50">
                  <td className="px-4 py-2 text-gray-700">{r.email}</td>
                  <td className="px-4 py-2 text-gray-500">{r.name ?? '-'}</td>
                  <td className="px-4 py-2 text-gray-400">{new Date(r.created_at).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">受信者がいません</td></tr>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/email/stats', { headers: { 'x-admin-key': ADMIN_KEY } })
      .then((r) => r.json())
      .then((data) => { setCampaigns(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-500">件名</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">送信数</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">開封数</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">開封率</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">バウンス</th>
              <th className="text-right px-4 py-3 text-xs text-gray-500">バウンス率</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500">送信日</th>
              <th className="text-center px-4 py-3 text-xs text-gray-500">状態</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{c.subject}</td>
                <td className="px-4 py-3 text-right text-gray-700">{c.total_sent.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-700">{c.opened.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">{c.open_rate}</td>
                <td className="px-4 py-3 text-right text-gray-700">{c.bounced.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-red-500">{c.bounce_rate}</td>
                <td className="px-4 py-3 text-gray-400">{c.sent_at ? new Date(c.sent_at).toLocaleDateString('ja-JP') : '-'}</td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">キャンペーンがありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: 'bg-green-100 text-green-700',
    sending: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-gray-100 text-gray-600',
    failed: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = { sent: '送信済', sending: '送信中', draft: '下書き', failed: '失敗' };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
    </div>
  );
}
