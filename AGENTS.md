<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Definition of Done — 完了の定義（必須）

コードを変更したら、**「完了」と報告する前に必ず**以下を実行し、すべて通ったことを確認する。**通っていないのに「できました」と言わない。**

1. `npm run typecheck` — 型エラー0（必須・毎回）
2. `npm run lint` — lintエラー0（コードを足した時）
3. `npm run build` — 些細でない変更・新機能のときはビルドが通ることを確認
4. **実際の挙動確認** — 画面に出る変更なら preview/dev サーバで実機確認（preview_* ツール）。「動くはず」で終わらせない

エラーが出たら**自分で直して再実行**。クリーンになるまで繰り返す（同じエラーが3回直らない時だけ、状況を添えて報告で止める）。
APIは「あるはず」で書かない。Next.js 16系は別物なので `node_modules/next/dist/docs/` で確認してから書く。

# プロジェクト固有ルール / 決定事項（ここに書いたことは毎回必ず守る）

> 「前に言ったのに無視された」を無くすための場所。口頭で言うと消えるので、**繰り返し守ってほしい指示・過去の決定は全部ここに追記**する。

- **既存コードを読んでから変更する**：修正・追加の前に、関連ファイルと「それを使っている側（呼び出し元・依存先）」を確認し、壊さないこと。影響範囲を見ずに書かない。
- **過去の決定を勝手に元に戻さない**：このファイルやコードにある既存の方針・実装を、明示の指示なく変更・削除しない。
- **機能追加は既存の挙動を壊さないこと**（リグレッション禁止）。変更した機能は実際に動かして確認する（Definition of Done参照）。

<!-- 以下、繰り返し守ってほしいルールを追記していく -->

# Commands
- `npm run dev` — 開発サーバ
- `npm run build` — 本番ビルド（型・lintも走る）
- `npm run typecheck` — 型チェックのみ（速い・編集後の確認に使う）
- `npm run lint` — eslint
- `npm run verify` — typecheck + lint をまとめて

# Stack
Next.js 16.2 (App Router) / React 19 / TypeScript strict / Supabase / Zustand / Resend / Tailwind v4
