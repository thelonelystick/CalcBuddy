# CalcBuddy

CalcBuddy is a React + TypeScript + Vite starter for an engineering-student utility with Basic, Advanced, Archive, and role-protected content-management experiences.

## Included
- Scientific calculator using Math.js parsing/evaluation (no JavaScript `eval`).
- Browser Web Speech API voice input and spoken-number/operator normalization.
- Matrix multiplication panel with configurable dimensions.
- LaTeX preview using KaTeX.
- Markdown archive and syntax-highlighted code examples.
- Supabase Auth, PostgreSQL schema, Row Level Security policies, and realtime refresh subscription.
- Admin content form for Markdown, a LaTeX formula, and a language-labelled code block.
- Responsive dark/light theme persisted to localStorage.
- Demo notes shown locally until the Supabase project has published content.

## Requirements
- Node.js 20.19+ or 22.12+ recommended for Vite 7.
- Supabase project.

## Run locally
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's URL and publishable/anon key.
4. In Supabase SQL Editor, run `supabase/schema.sql`.
5. Start: `npm run dev`
6. Production build: `npm run build`

If Supabase is not configured, the calculator, matrix lab, LaTeX editor, and bundled demo archive still work. Admin CRUD and live sync require Supabase.

## Create the first administrator
1. In Supabase Authentication, create a user with email/password.
2. The database trigger creates a `profiles` row with role `student`.
3. Copy that user's Auth UUID, then run in SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
   ```
4. Sign in through Admin login. The app checks the authenticated user's database role and signs out non-admin users.
5. Do not expose the Supabase `service_role` key to the frontend.

## Data model
- `profiles`: auth user role (`student` / `admin`)
- `categories`: normalized category vocabulary
- `notes`: title, slug, Markdown body, tags, published state, category relation
- `note_formulas`: raw LaTeX formulas linked by `note_id`
- `note_code_blocks`: code + language + title linked by `note_id`

## Publishing content without redeployment
Save a note with **Publish immediately** checked. The note and child rows are written to Supabase. The student archive fetches published notes from the live API and listens for changes to the `notes` table, refreshing its content after updates.

For production, enable Realtime for `notes` in Supabase Database → Replication (the initial fetch works without Realtime). For strongest consistency, consider replacing separate note/formula/code writes with a PostgreSQL RPC transaction and add an audit log table.

## Important hardening before public launch
This is a functional starter, not a completed security audit:
- Replace `prompt()`-based admin login with a designed login page and add password reset / session UX.
- Add transactional RPC for note + formula + code updates; current UI writes related records as sequential requests.
- Add server-side validation and rate limits where needed; cap Markdown, code and formula sizes.
- Add audit logging, backups, error monitoring, automated tests, and deployment secrets management.
- Treat stored Markdown and code as untrusted. `react-markdown` does not enable raw HTML by default; do not add `rehype-raw` without sanitization.
- Math.js is safer than `eval`, but still restrict the accepted grammar and add limits for expression length/compute time for public input.
- Web Speech API support and recognition availability vary by browser and often require HTTPS.
- The current spoken-math converter is intentionally simple; it is not a full natural-language math parser.
- The matrix UI starter demonstrates multiplication; for non-square B output dimensions, extend the state model to track A rows, shared dimension, and B columns independently.
- The single-formula/single-code-block admin controls are a starter; expand to repeatable rows for full multi-block authoring.

## Architecture
`Browser (React UI) → Supabase Auth → Postgres + RLS → live content queries / Realtime notifications`

Static frontend hosting can be used because notes and content are loaded at runtime from Supabase. New frontend features still require a frontend deployment; content changes do not.
