import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { all, create, format, type MathNode } from "mathjs";
import type { User } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { spokenMathToExpression } from "./lib/speech";

const math = create(all, { number: "BigNumber", precision: 64 });
const SAFE_SCOPE = Object.freeze({});
type Note = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  body_md: string;
  category?: string;
  tags?: string[];
  formulas?: { latex: string; label?: string }[];
  code_blocks?: { language: string; code: string; title?: string }[];
  published?: boolean;
};
type Mode = "Basic" | "Advanced" | "Theory" | "Code";
type HistoryEntry = { expression: string; answer: string; timestamp: number };

const demoNotes: Note[] = [
  {
    id: "demo-1",
    title: "Taylor Series",
    slug: "taylor-series",
    summary: "A quick reference for local polynomial approximations.",
    category: "Calculus",
    tags: ["series", "exam"],
    published: true,
    body_md: "The Taylor expansion of a sufficiently differentiable function around \\\\(a\\\\) is useful for approximating functions near a point.\n\n### Maclaurin series\n\nFor a Maclaurin series, set \\\\(a=0\\\\).",
    formulas: [
      { label: "Taylor series", latex: "f(x)=\\sum_{n=0}^{\\infty}\\frac{f^{(n)}(a)}{n!}(x-a)^n" },
      { label: "Exponential", latex: "e^x=1+x+\\frac{x^2}{2!}+\\frac{x^3}{3!}+\\cdots" },
    ],
    code_blocks: [{
      title: "Python approximation",
      language: "python",
      code: "import math\nx = 0.2\napprox = 1 + x + x**2 / 2 + x**3 / 6\nprint(approx, math.exp(x))",
    }],
  },
  {
    id: "demo-2",
    title: "Matrix Multiplication",
    slug: "matrix-multiplication",
    summary: "Dimension rules and a simple implementation.",
    category: "Linear Algebra",
    tags: ["matrices"],
    published: true,
    body_md: "If \\\\(A\\\\) has dimensions \\\\(m\\\\times n\\\\) and \\\\(B\\\\) has dimensions \\\\(n\\\\times p\\\\), then \\\\(AB\\\\) has dimensions \\\\(m\\\\times p\\\\). The inner dimensions must match.",
    formulas: [{ label: "Element formula", latex: "C_{ij}=\\sum_{k=1}^{n} A_{ik}B_{kj}" }],
    code_blocks: [{
      title: "C++ example",
      language: "cpp",
      code: "#include <iostream>\nint main() {\n  int a[2][2]={{1,2},{3,4}};\n  std::cout << a[0][0] * 1 + a[0][1] * 3;\n}",
    }],
  },
];

const buttons = [
  "AC", "⌫", "%", "÷",
  "7", "8", "9", "×",
  "4", "5", "6", "−",
  "1", "2", "3", "+",
  "(", "0", ")", "=",
  "sin(", "cos(", "tan(", "√(",
  "log(", "ln(", "π", "^",
  "!", "e", "exp(", "abs(",
];

function safeEvaluate(expression: string): string {
  if (!expression.trim()) return "";
  const node: MathNode = math.parse(expression);
  node.traverse((n: any) => {
    if (n.type === "AssignmentNode" || n.type === "FunctionAssignmentNode" || n.type === "AccessorNode" || n.type === "BlockNode") {
      throw new Error("That expression type is not allowed.");
    }
  });
  const result = math.evaluate(expression, SAFE_SCOPE as Record<string, unknown>);
  if (typeof result === "function" || result === undefined) throw new Error("Unsupported expression.");
  return typeof result === "number" || (result && typeof result.toString === "function")
    ? format(result, { precision: 12 })
    : String(result);
}

function normalizeInput(value: string) {
  return value.replaceAll("÷", "/").replaceAll("×", "*").replaceAll("−", "-").replaceAll("√(", "sqrt(").replaceAll("π", "pi");
}

function CodeBlock({ language, code, title }: { language: string; code: string; title?: string }) {
  return <div className="code-card">
    <div className="code-head"><span>{title || language}</span><span>{language}</span></div>
    <SyntaxHighlighter language={language.toLowerCase()} style={vscDarkPlus} customStyle={{ margin: 0, background: "#101525", fontSize: ".85rem" }}>{code}</SyntaxHighlighter>
  </div>;
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("calcbuddy-theme") as "dark" | "light") || "light");
  const [mode, setMode] = useState<Mode>("Basic");
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem("calcbuddy-history");
      return saved ? JSON.parse(saved) as HistoryEntry[] : [];
    } catch {
      return [];
    }
  });
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [activeNote, setActiveNote] = useState<Note>(demoNotes[0]);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [outputCols, setOutputCols] = useState(2);
  const [matrixA, setMatrixA] = useState<string[][]>([["1", "2"], ["3", "4"]]);
  const [matrixB, setMatrixB] = useState<string[][]>([["5", "6"], ["7", "8"]]);
  const [matrixResult, setMatrixResult] = useState("");
  const [latex, setLatex] = useState("f(x)=\\int_a^b f'(x)\\,dx");
  const [isListening, setIsListening] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [draft, setDraft] = useState<Partial<Note>>({
    title: "", slug: "", summary: "", category: "Calculus", body_md: "", published: false, formulas: [], code_blocks: [],
  });
  const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("calcbuddy-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("calcbuddy-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let alive = true;
    const load = async () => {
      const { data, error: fetchError } = await client.from("notes")
        .select("id,title,slug,summary,body_md,category,tags,published,formulas:note_formulas(latex,label),code_blocks:note_code_blocks(language,code,title)")
        .eq("published", true).order("updated_at", { ascending: false });
      if (!fetchError && data && alive && data.length) {
        const mapped = data as unknown as Note[];
        setNotes(mapped);
        setActiveNote(mapped[0]);
      }
    };
    void load();
    const channel = client.channel("published-notes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => void load())
      .subscribe();
    return () => { alive = false; void client.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!isAdminRoute) {
      setAdmin(false);
      return;
    }
    const client = supabase;
    if (!client) return;
    let alive = true;
    const verifyAdmin = async (user: User | null) => {
      if (!user) {
        if (alive) {
          setAdmin(false);
          setSessionEmail("");
        }
        return;
      }
      const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", user.id).single();
      if (!alive) return;
      if (profileError || profile?.role !== "admin") {
        await client.auth.signOut();
        if (alive) {
          setAdmin(false);
          setAdminMessage("This Google account is not configured as an administrator.");
        }
        return;
      }
      setSessionEmail(user.email || "");
      setAdmin(true);
      setAdminMessage("");
    };
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setAdminMessage(sessionError.message);
        return;
      }
      void verifyAdmin(data.session?.user ?? null);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void verifyAdmin(session?.user ?? null), 0);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [isAdminRoute]);

  const filteredNotes = useMemo(
    () => notes.filter(n => `${n.title} ${n.summary || ""} ${n.category || ""} ${(n.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())),
    [notes, search],
  );
  const visibleNotes = useMemo(
    () => mode === "Code" ? filteredNotes.filter(note => note.code_blocks?.length) : filteredNotes,
    [filteredNotes, mode],
  );
  const selectedNote = visibleNotes.find(note => note.id === activeNote.id) || visibleNotes[0];

  function press(key: string) {
    setError("");
    if (key === "AC") {
      setExpression("");
      setAnswer("");
      return;
    }
    if (key === "⌫") {
      setExpression(value => value.slice(0, -1));
      return;
    }
    if (key === "=") {
      try {
        const result = safeEvaluate(normalizeInput(expression));
        setAnswer(result);
        setHistory(current => [{ expression, answer: result, timestamp: Date.now() }, ...current].slice(0, 20));
      } catch (evaluationError) {
        setError(evaluationError instanceof Error ? evaluationError.message : "Invalid expression");
      }
      return;
    }
    setExpression(value => value + key);
  }

  function voiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setError("Could not recognize speech. Try again.");
    };
    recognition.onresult = (event: any) => {
      setExpression(spokenMathToExpression(event.results[0][0].transcript));
      setError("");
    };
    recognition.start();
  }

  function resizeMatrix(nextRows: number, nextCols: number) {
    const resize = (old: string[][], nextMatrixRows: number, nextMatrixCols: number) => Array.from(
      { length: nextMatrixRows },
      (_, row) => Array.from({ length: nextMatrixCols }, (_, col) => old[row]?.[col] ?? "0"),
    );
    setRows(nextRows);
    setCols(nextCols);
    setMatrixA(old => resize(old, nextRows, nextCols));
    setMatrixB(old => resize(old, nextCols, outputCols));
    setMatrixResult("");
  }

  function multiplyMatrices() {
    try {
      const a = matrixA.map(row => row.map(Number));
      const b = matrixB.map(row => row.map(Number));
      if (a.some(row => row.some(Number.isNaN)) || b.some(row => row.some(Number.isNaN))) {
        throw new Error("Enter valid numeric matrix values.");
      }
      if (matrixA[0].length !== matrixB.length) throw new Error("Matrix A columns must equal Matrix B rows. Set dimensions to match.");
      const result = a.map(row => b[0].map((_, col) => row.reduce((sum, value, k) => sum + value * b[k][col], 0)));
      setMatrixResult(result.map(row => row.join("   ")).join("\n"));
    } catch (matrixError) {
      setMatrixResult(matrixError instanceof Error ? matrixError.message : "Unable to multiply matrices.");
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setAdminMessage("Configure Supabase and enable Google sign-in to access the admin area.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    if (signInError) setAdminMessage(signInError.message);
  }

  async function saveNote() {
    if (!supabase) {
      setAdminMessage("Supabase is not configured.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setAdminMessage("Please sign in again.");
      setAdmin(false);
      return;
    }
    const payload = {
      title: draft.title?.trim(),
      slug: draft.slug?.trim(),
      summary: draft.summary || "",
      category: draft.category || "General",
      body_md: draft.body_md || "",
      published: Boolean(draft.published),
      tags: [],
    };
    if (!payload.title || !payload.slug || !payload.body_md) {
      setAdminMessage("Title, slug, and Markdown body are required.");
      return;
    }
    const { data, error: saveError } = await supabase.from("notes").upsert(payload, { onConflict: "slug" }).select("id").single();
    if (saveError || !data) {
      setAdminMessage(saveError?.message || "Save failed.");
      return;
    }
    await supabase.from("note_formulas").delete().eq("note_id", data.id);
    await supabase.from("note_code_blocks").delete().eq("note_id", data.id);
    const formulas = (draft.formulas || []).filter(formula => formula.latex?.trim())
      .map(formula => ({ note_id: data.id, latex: formula.latex, label: formula.label || "" }));
    const code = (draft.code_blocks || []).filter(block => block.code?.trim())
      .map(block => ({ note_id: data.id, language: block.language || "text", code: block.code, title: block.title || "" }));
    if (formulas.length) {
      const result = await supabase.from("note_formulas").insert(formulas);
      if (result.error) {
        setAdminMessage(`Note saved, but formulas failed: ${result.error.message}`);
        return;
      }
    }
    if (code.length) {
      const result = await supabase.from("note_code_blocks").insert(code);
      if (result.error) {
        setAdminMessage(`Note saved, but code blocks failed: ${result.error.message}`);
        return;
      }
    }
    setAdminMessage("Saved.");
    const { data: saved } = await supabase.from("notes")
      .select("id,title,slug,summary,body_md,category,tags,published,formulas:note_formulas(latex,label),code_blocks:note_code_blocks(language,code,title)")
      .eq("published", true).order("updated_at", { ascending: false });
    if (saved?.length) {
      const mapped = saved as unknown as Note[];
      setNotes(mapped);
      setActiveNote(mapped[0]);
    }
  }

  async function deleteNote(id: string) {
    if (!supabase || !confirm("Delete this note and its related formulas/code blocks?")) return;
    const { error: deleteError } = await supabase.from("notes").delete().eq("id", id);
    setAdminMessage(deleteError ? deleteError.message : "Deleted.");
  }

  function renderResources() {
    return <section className="resource-layout">
      <aside className="panel resource-sidebar">
        <div className="resource-toolbar">
          <h2>{mode === "Code" ? "Code" : "Theory"}</h2>
          <input className="search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search" aria-label="Search resources" />
        </div>
        <div className="note-list">
          {visibleNotes.map(note => <button key={note.id} className={selectedNote?.id === note.id ? "note-item selected" : "note-item"} onClick={() => setActiveNote(note)}>
            <span className="note-category">{note.category || "General"}</span>
            <strong>{note.title}</strong>
          </button>)}
          {!visibleNotes.length && <p className="empty-state">No resources found.</p>}
        </div>
        <span className="sync-label"><span className="live-dot"></span>{isSupabaseConfigured ? "Live resources" : "Demo resources"}</span>
      </aside>
      {selectedNote ? <article className="panel note-content">
        <div className="note-topline"><span className="note-category">{selectedNote.category || "General"}</span></div>
        <h2>{selectedNote.title}</h2>
        {selectedNote.summary && <p className="note-summary">{selectedNote.summary}</p>}
        {mode === "Theory" && <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.body_md || ""}</ReactMarkdown></div>}
        {mode === "Theory" && selectedNote.formulas?.length ? <div className="formula-section">
          {selectedNote.formulas.map((formula, index) => <div className="formula-card" key={index}>
            <span>{formula.label || "Formula"}</span><BlockMath math={formula.latex} />
          </div>)}
        </div> : null}
        {selectedNote.code_blocks?.length ? <div className="code-section">
          {selectedNote.code_blocks.map((block, index) => <CodeBlock key={index} language={block.language} code={block.code} title={block.title} />)}
        </div> : null}
      </article> : <div className="panel empty-state">Choose a resource to view.</div>}
    </section>;
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="CalcBuddy home">
        <img src="/calcbuddy-logo.png" alt="CalcBuddy Engineering Utility Companion" />
      </a>
      {!isAdminRoute && <nav className="main-nav" aria-label="Main navigation">
        {(["Basic", "Advanced", "Theory", "Code"] as const).map(tab => <button
          key={tab}
          className={mode === tab ? "nav-btn active" : "nav-btn"}
          onClick={() => setMode(tab)}
        >{tab}</button>)}
      </nav>}
      <div className="header-actions">
        {isAdminRoute && <a className="back-link" href="/">Back to calculator</a>}
        <button className="icon-btn" title="Toggle theme" aria-label="Toggle theme" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☼" : "☾"}
        </button>
      </div>
    </header>

    <main>
      {isAdminRoute ? (admin ? <section className="panel admin-panel">
        <div className="section-heading">
          <div><h1>Admin</h1><p>Signed in as {sessionEmail}</p></div>
          <button className="secondary-btn" onClick={async () => {
            await supabase?.auth.signOut();
            setAdmin(false);
            setAdminMessage("Signed out.");
          }}>Sign out</button>
        </div>
        <div className="admin-grid">
          <div className="field"><label>Title</label><input value={draft.title || ""} onChange={event => setDraft(current => ({
            ...current,
            title: event.target.value,
            slug: current.slug || event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          }))} placeholder="e.g. Fourier Transform" /></div>
          <div className="field"><label>Slug</label><input value={draft.slug || ""} onChange={event => setDraft(current => ({ ...current, slug: event.target.value }))} placeholder="fourier-transform" /></div>
          <div className="field"><label>Category</label><input value={draft.category || ""} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} placeholder="Calculus" /></div>
          <div className="field"><label>Summary</label><input value={draft.summary || ""} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} placeholder="Short description" /></div>
        </div>
        <div className="field"><label>Markdown content</label><textarea rows={7} value={draft.body_md || ""} onChange={event => setDraft(current => ({ ...current, body_md: event.target.value }))} placeholder={"## Concept\nWrite notes in Markdown..."} /></div>
        <div className="admin-grid">
          <div className="field">
            <label>LaTeX formula</label>
            <textarea rows={3} value={draft.formulas?.[0]?.latex || ""} onChange={event => setDraft(current => ({
              ...current,
              formulas: [{ label: current.formulas?.[0]?.label || "Formula", latex: event.target.value }],
            }))} placeholder="\\int_a^b f(x) dx" />
            <div className="latex-preview">{(draft.formulas?.[0]?.latex || "").trim() ? <InlineMath math={draft.formulas![0].latex} errorColor="#ff7373" /> : <span>Formula preview</span>}</div>
          </div>
          <div className="field">
            <label>Code language</label>
            <select value={draft.code_blocks?.[0]?.language || "python"} onChange={event => setDraft(current => ({
              ...current,
              code_blocks: [{ title: current.code_blocks?.[0]?.title || "Example", language: event.target.value, code: current.code_blocks?.[0]?.code || "" }],
            }))}>
              <option value="python">Python</option><option value="matlab">MATLAB</option><option value="cpp">C++</option><option value="javascript">JavaScript</option><option value="java">Java</option>
            </select>
            <label className="sub-label">Code block</label>
            <textarea rows={5} value={draft.code_blocks?.[0]?.code || ""} onChange={event => setDraft(current => ({
              ...current,
              code_blocks: [{ title: current.code_blocks?.[0]?.title || "Example", language: current.code_blocks?.[0]?.language || "python", code: event.target.value }],
            }))} placeholder="Paste code..." />
          </div>
        </div>
        <label className="check-row"><input type="checkbox" checked={Boolean(draft.published)} onChange={event => setDraft(current => ({ ...current, published: event.target.checked }))} /> Publish</label>
        <div className="button-row">
          <button className="primary-btn" onClick={() => void saveNote()}>Save</button>
          <button className="secondary-btn" onClick={() => setDraft({ title: "", slug: "", summary: "", category: "Calculus", body_md: "", published: false, formulas: [], code_blocks: [] })}>Clear</button>
        </div>
        {adminMessage && <p className="status-message">{adminMessage}</p>}
        <h2>Published content</h2>
        <div className="admin-list">{notes.map(note => <div key={note.id} className="admin-list-row">
          <span><strong>{note.title}</strong><small>{note.category || "General"} · {note.slug}</small></span>
          <button className="danger-btn" onClick={() => void deleteNote(note.id)}>Delete</button>
        </div>)}</div>
      </section> : <section className="panel login-panel">
        <h1>Admin</h1>
        <p>Sign in with an authorized Google account.</p>
        <button className="google-btn" onClick={() => void signInWithGoogle()}>
          <span aria-hidden="true">G</span> Continue with Google
        </button>
        {adminMessage && <p className="status-message">{adminMessage}</p>}
      </section>) : <>
        {mode === "Basic" && <section className="workspace">
          <div className="panel calculator-panel">
            <div className="section-heading">
              <h1>Calculator</h1>
              <button className={isListening ? "voice-btn listening" : "voice-btn"} onClick={voiceInput}>{isListening ? "Listening…" : "Voice input"}</button>
            </div>
            <div className="calc-display">
              <div className="expression">{expression || "Enter an expression"}</div>
              <div className="answer">{error ? <span className="error-text">{error}</span> : answer ? <><span className="equals">=</span> {answer}</> : <span className="placeholder">Answer</span>}</div>
            </div>
            <div className="keypad">{buttons.map((key, index) => <button
              key={`${key}-${index}`}
              className={`key ${["÷", "×", "−", "+", "^", "%", "!"].includes(key) ? "operator" : ""} ${["AC", "⌫"].includes(key) ? "special" : ""} ${key === "=" ? "equals-key" : ""}`}
              onClick={() => press(key)}
            >{key}</button>)}</div>
          </div>
          <aside className="panel history-panel">
            <div className="history-heading"><h2>History</h2><button className="clear-history" onClick={() => setHistory([])} disabled={!history.length}>Clear</button></div>
            {history.length ? <div className="history-list">{history.map((entry, index) => <button className="history-item" key={`${entry.timestamp}-${index}`} onClick={() => {
              setExpression(entry.expression);
              setAnswer(entry.answer);
              setError("");
            }}>
              <span>{entry.expression}</span><strong>= {entry.answer}</strong>
            </button>)}</div> : <p className="empty-state">Your calculations will appear here.</p>}
          </aside>
        </section>}

        {mode === "Advanced" && <section className="panel advanced-panel">
          <div className="section-heading"><h1>Advanced</h1></div>
          <div className="dimension-row">
            <label>Rows in A <select value={rows} onChange={event => resizeMatrix(Number(event.target.value), cols)}>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Columns in A / rows in B <select value={cols} onChange={event => resizeMatrix(rows, Number(event.target.value))}>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Columns in B <select value={outputCols} onChange={event => {
              const nextCols = Number(event.target.value);
              setOutputCols(nextCols);
              setMatrixB(old => Array.from({ length: cols }, (_, row) => Array.from({ length: nextCols }, (_, col) => old[row]?.[col] ?? "0")));
              setMatrixResult("");
            }}>{[1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label>
          </div>
          <div className="matrix-grid">
            <MatrixEditor title="Matrix A" values={matrixA} onChange={setMatrixA} />
            <MatrixEditor title="Matrix B" values={matrixB} onChange={setMatrixB} />
          </div>
          <button className="primary-btn" onClick={multiplyMatrices}>Multiply A × B</button>
          {matrixResult && <pre className="matrix-result">{matrixResult}</pre>}
          <div className="field equation-field">
            <label>LaTeX equation</label>
            <textarea rows={2} value={latex} onChange={event => setLatex(event.target.value)} />
            <div className="formula-preview"><BlockMath math={latex} errorColor="#ff7373" /></div>
          </div>
          <div className="template-row">{[
            { name: "Definite integral", value: "\\int_a^b f(x)\\,dx" },
            { name: "Derivative", value: "\\frac{dy}{dx}" },
            { name: "Limit", value: "\\lim_{x\\to 0}\\frac{\\sin x}{x}" },
            { name: "Quadratic formula", value: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}" },
          ].map(template => <button className="template-chip" key={template.name} onClick={() => setLatex(template.value)}>{template.name}</button>)}</div>
        </section>}

        {(mode === "Theory" || mode === "Code") && renderResources()}
      </>}
    </main>
  </div>;
}

function MatrixEditor({ title, values, onChange }: { title: string; values: string[][]; onChange: Dispatch<SetStateAction<string[][]>> }) {
  return <div className="matrix-card">
    <h2>{title}</h2>
    <div className="matrix-input-grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, values[0]?.length || 1)}, minmax(42px,1fr))` }}>
      {values.map((row, rowIndex) => row.map((value, colIndex) => <input
        aria-label={`${title} row ${rowIndex + 1} column ${colIndex + 1}`}
        key={`${rowIndex}-${colIndex}`}
        value={value}
        onChange={event => onChange(old => old.map((oldRow, oldRowIndex) => oldRow.map((oldValue, oldColIndex) => (
          oldRowIndex === rowIndex && oldColIndex === colIndex ? event.target.value : oldValue
        ))))}
      />))}
    </div>
  </div>;
}

export default App;
