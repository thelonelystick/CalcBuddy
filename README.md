# CalcBuddy

CalcBuddy is a React + TypeScript + Vite engineering utility with Basic, Advanced, Theory, and Code workspaces.

## Included
- Scientific calculator using Math.js parsing/evaluation (no JavaScript `eval`).
- Browser Web Speech API voice input and spoken-number/operator normalization.
- Calculation history persisted in the browser.
- Google sign-in with private, account-synced calculation history.
- Student bookmarks and private notes for theory/code resources.
- Matrix multiplication panel with configurable dimensions.
- LaTeX preview using KaTeX.
- Theory notes and syntax-highlighted code examples.
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
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's URL and publishable key. `VITE_SUPABASE_ANON_KEY` is also supported for older setups. Never use a secret/service-role key in a `VITE_` variable.
4. For a new project, run `supabase/schema.sql` in Supabase SQL Editor. For an existing project, run `supabase/migrations/20261016_student_data_and_admin_email.sql`.
5. Start: `npm run dev`
6. Production build: `npm run build`

## Deploy to Vercel
In Vercel, open the project's **Settings → Environment Variables** and add these variables for Production (and Preview if you use preview deployments):

- `VITE_SUPABASE_URL`: your Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable key (never use the secret/service-role key).

Redeploy after adding or changing either variable. Vite embeds `VITE_` variables during the build, so changing them does not update an existing deployment. If the app says Supabase is not configured, verify both variables are present in the Vercel environment used by that deployment.

If Supabase is not configured, the calculator, matrix lab, LaTeX editor, and bundled demo archive still work. Admin CRUD and live sync require Supabase.

## Configure Google sign-in and administrator access
1. Enable the Google provider in Supabase Authentication and configure its OAuth credentials. In Google Cloud, add your app origin (for local development, `http://localhost:5173`) to **Authorized JavaScript origins** and `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` to **Authorized redirect URIs**.
2. Add your local and deployed app URLs to Supabase Authentication → URL Configuration → Redirect URLs (for example, `http://localhost:5173/**` and `https://your-app.vercel.app/**`).
3. Sign in from the app with Google. New accounts receive the `student` role and can sync calculation history, bookmarks, and personal resource notes.
4. The migration promotes `sooryavanshibhawishya@gmail.com` to `admin` and sets all other existing profiles to `student`. The auth trigger keeps new accounts as students and assigns admin only to that email.
5. Open `/admin` on the deployed site and continue with that Google account. The app checks the database role before showing the admin area.
6. Do not expose the Supabase secret/service-role key to the frontend.

## Data model
- `profiles`: auth user role (`student` / `admin`)
- `categories`: normalized category vocabulary
- `notes`: title, slug, Markdown body, tags, published state, category relation
- `note_formulas`: raw LaTeX formulas linked by `note_id`
- `note_code_blocks`: code + language + title linked by `note_id`
- `calculation_history`: per-user calculator expressions and results, protected by row-level security
- `user_resource_data`: per-user bookmarks and private study notes, protected by row-level security

## Publishing content without redeployment
Save a note with **Publish immediately** checked. The note and child rows are written to Supabase. The student archive fetches published notes from the live API and listens for changes to the `notes` table, refreshing its content after updates.

For production, enable Realtime for `notes` in Supabase Database → Replication (the initial fetch works without Realtime). Vercel is configured to serve the SPA entry point for routes such as `/admin`, including direct visits and refreshes. For strongest consistency, consider replacing separate note/formula/code writes with a PostgreSQL RPC transaction and add an audit log table.

## Important hardening before public launch
This is a functional starter, not a completed security audit:
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
