import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { all, create, format, type MathNode } from "mathjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BlockMath, InlineMath } from "react-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { spokenMathToExpression } from "./lib/speech";

const math = create(all, { number: "BigNumber", precision: 64 });
const SAFE_SCOPE = Object.freeze({});
type Note = { id: string; title: string; slug: string; summary?: string; body_md: string; category?: string; tags?: string[]; formulas?: { latex: string; label?: string }[]; code_blocks?: { language: string; code: string; title?: string }[]; published?: boolean };
const demoNotes: Note[] = [
  { id: "demo-1", title: "Taylor Series", slug: "taylor-series", summary: "A quick reference for local polynomial approximations.", category: "Calculus", tags: ["series", "exam"], published: true, body_md: "The Taylor expansion of a sufficiently differentiable function around \\\\(a\\\\) is useful for approximating functions near a point.\\n\\n### Maclaurin series\\n\\nFor a Maclaurin series, set \\\\(a=0\\\\).", formulas: [{ label: "Taylor series", latex: "f(x)=\\\\sum_{n=0}^{\\\\infty}\\\\frac{f^{(n)}(a)}{n!}(x-a)^n" }, { label: "Exponential", latex: "e^x=1+x+\\\\frac{x^2}{2!}+\\\\frac{x^3}{3!}+\\\\cdots" }], code_blocks: [{ title: "Python approximation", language: "python", code: "import math\\nx = 0.2\\napprox = 1 + x + x**2 / 2 + x**3 / 6\\nprint(approx, math.exp(x))" }] },
  { id: "demo-2", title: "Matrix Multiplication", slug: "matrix-multiplication", summary: "Dimension rules and a simple implementation.", category: "Linear Algebra", tags: ["matrices"], published: true, body_md: "If \\\\(A\\\\) has dimensions \\\\(m\\\\times n\\\\) and \\\\(B\\\\) has dimensions \\\\(n\\\\times p\\\\), then \\\\(AB\\\\) has dimensions \\\\(m\\\\times p\\\\). The inner dimensions must match.", formulas: [{ label: "Element formula", latex: "C_{ij}=\\\\sum_{k=1}^{n} A_{ik}B_{kj}" }], code_blocks: [{ title: "C++ example", language: "cpp", code: "#include <iostream>\\nint main() {\\n  int a[2][2]={{1,2},{3,4}};\\n  std::cout << a[0][0] * 1 + a[0][1] * 3;\\n}" }] }
];
const buttons = ["7","8","9","÷","4","5","6","×","1","2","3","−","(", "0",")","+","sin(","cos(","tan(","√(","π","^","!","⌫","AC","log(","ln(",".","%","="];
function safeEvaluate(expression: string): string {
  if (!expression.trim()) return "";
  // Reject assignments, accessors, and function definitions; only evaluate a parsed math expression.
  const node: MathNode = math.parse(expression);
  node.traverse((n: any) => {
    if (n.type === "AssignmentNode" || n.type === "FunctionAssignmentNode" || n.type === "AccessorNode" || n.type === "BlockNode") {
      throw new Error("That expression type is not allowed.");
    }
  });
  const result = math.evaluate(expression, SAFE_SCOPE as Record<string, unknown>);
  if (typeof result === "function" || result === undefined) throw new Error("Unsupported expression.");
  return typeof result === "number" || (result && typeof result.toString === "function") ? format(result, { precision: 12 }) : String(result);
}
function normalizeInput(value: string) {
  return value.replaceAll("÷", "/").replaceAll("×", "*").replaceAll("−", "-").replaceAll("√(", "sqrt(").replaceAll("π", "pi");
}
function CodeBlock({ language, code, title }: { language: string; code: string; title?: string }) {
  return <div className="code-card"><div className="code-head"><span>{title || language}</span><span>{language}</span></div><SyntaxHighlighter language={language.toLowerCase()} style={vscDarkPlus} customStyle={{ margin: 0, background: "#101525", fontSize: ".85rem" }}>{code}</SyntaxHighlighter></div>;
}
function App() {
  const [theme, setTheme] = useState<"dark"|"light">(() => (localStorage.getItem("calcbuddy-theme") as "dark"|"light") || "dark");
  const [mode, setMode] = useState<"Basic"|"Advanced"|"Archive">("Basic");
  const [expression, setExpression] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Note[]>(demoNotes);
  const [activeNote, setActiveNote] = useState<Note>(demoNotes[0]);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [matrixA, setMatrixA] = useState<string[][]>([["1","2"],["3","4"]]);
  const [matrixB, setMatrixB] = useState<string[][]>([["5","6"],["7","8"]]);
  const [matrixResult, setMatrixResult] = useState("");
  const [latex, setLatex] = useState("f(x)=\\\\int_a^b f'(x)\\\\,dx");
  const [isListening, setIsListening] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [draft, setDraft] = useState<Partial<Note>>({ title: "", slug: "", summary: "", category: "Calculus", body_md: "", published: false, formulas: [], code_blocks: [] });
  const [adminMessage, setAdminMessage] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("calcbuddy-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const load = async () => {
      const { data, error: fetchError } = await supabase!.from("notes").select("id,title,slug,summary,body_md,category,tags,published,formulas:note_formulas(latex,label),code_blocks:note_code_blocks(language,code,title)").eq("published", true).order("updated_at", { ascending: false });
      if (!fetchError && data && alive && data.length) {
        const mapped = data as unknown as Note[];
        setNotes(mapped);
        setActiveNote(mapped[0]);
      }
    };
    void load();
    const channel = supabase.channel("published-notes").on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => void load()).subscribe();
    return () => { alive = false; void supabase!.removeChannel(channel); };
  }, []);
  const filteredNotes = useMemo(() => notes.filter(n => `${n.title} ${n.summary || ""} ${n.category || ""} ${(n.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())), [notes, search]);
  function press(key: string) {
    setError("");
    if (key === "AC") { setExpression(""); setAnswer(""); return; }
    if (key === "⌫") { setExpression(v => v.slice(0, -1)); return; }
    if (key === "=") { try { const out = safeEvaluate(normalizeInput(expression)); setAnswer(out); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Invalid expression"); } return; }
    setExpression(v => v + key);
  }
  function voiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Speech recognition is not supported in this browser. Try Chrome."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN"; recognition.interimResults = false; recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); setError("Could not recognize speech. Try again."); };
    recognition.onresult = (event: any) => {
      const spoken = event.results[0][0].transcript;
      setExpression(spokenMathToExpression(spoken)); setError("");
    };
    recognition.start();
  }
  function resizeMatrix(nextRows: number, nextCols: number) {
    const resize = (old: string[][]) => Array.from({ length: nextRows }, (_, r) => Array.from({ length: nextCols }, (_, c) => old[r]?.[c] ?? "0"));
    setRows(nextRows); setCols(nextCols); setMatrixA(a => resize(a)); setMatrixB(b => resize(b)); setMatrixResult("");
  }
  function multiplyMatrices() {
    try {
      const a = matrixA.map(row => row.map(Number)), b = matrixB.map(row => row.map(Number));
      if (a.some(row => row.some(Number.isNaN)) || b.some(row => row.some(Number.isNaN))) throw new Error("Enter valid numeric matrix values.");
      if (cols !== rows) throw new Error("Matrix A columns must equal Matrix B rows. Set dimensions to match.");
      const result = a.map(row => b[0].map((_, j) => row.reduce((sum, val, k) => sum + val * b[k][j], 0)));
      setMatrixResult(result.map(row => row.join("   ")).join("\n"));
    } catch (e) { setMatrixResult(e instanceof Error ? e.message : "Unable to multiply matrices."); }
  }
  async function signIn() {
    if (!supabase) { setAdminMessage("Configure Supabase environment variables and run the SQL setup first."); return; }
    const email = prompt("Admin email");
    const password = prompt("Password");
    if (!email || !password) return;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setAdminMessage(error?.message || "Sign-in failed."); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (profileError || profile?.role !== "admin") {
      await supabase.auth.signOut(); setAdminMessage("Access denied: this account is not an administrator."); return;
    }
    setSessionEmail(data.user.email || email); setAdmin(true); setAdminMessage("Signed in as verified administrator.");
  }
  async function saveNote() {
    if (!supabase) { setAdminMessage("Supabase is not configured."); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setAdminMessage("Please sign in again."); setAdmin(false); return; }
    const payload = { title: draft.title?.trim(), slug: draft.slug?.trim(), summary: draft.summary || "", category: draft.category || "General", body_md: draft.body_md || "", published: Boolean(draft.published), tags: [] };
    if (!payload.title || !payload.slug || !payload.body_md) { setAdminMessage("Title, slug, and Markdown body are required."); return; }
    const { data, error } = await supabase.from("notes").upsert(payload, { onConflict: "slug" }).select("id").single();
    if (error || !data) { setAdminMessage(error?.message || "Save failed."); return; }
    await supabase.from("note_formulas").delete().eq("note_id", data.id);
    await supabase.from("note_code_blocks").delete().eq("note_id", data.id);
    const formulas = (draft.formulas || []).filter(f => f.latex?.trim()).map(f => ({ note_id: data.id, latex: f.latex, label: f.label || "" }));
    const code = (draft.code_blocks || []).filter(c => c.code?.trim()).map(c => ({ note_id: data.id, language: c.language || "text", code: c.code, title: c.title || "" }));
    if (formulas.length) { const result = await supabase.from("note_formulas").insert(formulas); if (result.error) setAdminMessage("Note saved, but formulas failed: " + result.error.message); }
    if (code.length) { const result = await supabase.from("note_code_blocks").insert(code); if (result.error) setAdminMessage("Note saved, but code blocks failed: " + result.error.message); }
    setAdminMessage("Saved to the database. Published notes update in the student archive without a frontend redeploy.");
    const { data: saved } = await supabase.from("notes").select("id,title,slug,summary,body_md,category,tags,published,formulas:note_formulas(latex,label),code_blocks:note_code_blocks(language,code,title)").eq("published", true).order("updated_at", { ascending: false });
    if (saved?.length) { const mapped = saved as unknown as Note[]; setNotes(mapped); setActiveNote(mapped[0]); }
  }
  async function deleteNote(id: string) {
    if (!supabase || !confirm("Delete this note and its related formulas/code blocks?")) return;
    const { error } = await supabase.from("notes").delete().eq("id", id);
    setAdminMessage(error ? error.message : "Deleted.");
  }
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setMode("Basic"); }}><span className="brand-icon">∑</span><span>CalcBuddy<small>ENGINEERING TOOLKIT</small></span></a>
      <nav className="main-nav">{(["Basic","Advanced","Archive"] as const).map(m => <button key={m} className={mode === m ? "nav-btn active" : "nav-btn"} onClick={() => setMode(m)}>{m}</button>)}</nav>
      <div className="header-actions"><button className="icon-btn" title="Toggle theme" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button><button className="admin-link" onClick={() => { setMode("Archive"); if (!admin) void signIn(); else setAdmin(v => !v); }}>{admin ? "Admin panel" : "Admin login"} ↗</button></div>
    </header>
    <main>
      <section className="hero"><div><div className="eyebrow"><span className="live-dot"></span> YOUR EVERYDAY ENGINEERING COMPANION</div><h1>Think clearly.<br/><span>Calculate anything.</span></h1><p>From quick calculations to the concepts you need to master. One focused workspace for engineering students.</p></div><div className="hero-stat"><span className="stat-icon">⌘</span><strong>3 modes</strong><span>One smarter workflow</span><div className="stat-rule"></div><strong>Always in sync</strong><span>Live academic resources</span></div></section>
      {admin ? <section className="panel admin-panel"><div className="section-heading"><div><div className="eyebrow">CONTENT STUDIO</div><h2>Admin dashboard</h2><p>Signed in as {sessionEmail}. Changes are stored in Supabase.</p></div><button className="secondary-btn" onClick={async () => { await supabase?.auth.signOut(); setAdmin(false); setAdminMessage("Signed out."); }}>Sign out</button></div>
        <div className="admin-grid"><div className="field"><label>Title</label><input value={draft.title || ""} onChange={e => setDraft(d => ({...d,title:e.target.value,slug:d.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}))} placeholder="e.g. Fourier Transform"/></div><div className="field"><label>Slug</label><input value={draft.slug || ""} onChange={e => setDraft(d => ({...d,slug:e.target.value}))} placeholder="fourier-transform"/></div><div className="field"><label>Category</label><input value={draft.category || ""} onChange={e => setDraft(d => ({...d,category:e.target.value}))} placeholder="Calculus"/></div><div className="field"><label>Short summary</label><input value={draft.summary || ""} onChange={e => setDraft(d => ({...d,summary:e.target.value}))} placeholder="One-line description"/></div></div>
        <div className="field"><label>Markdown content</label><textarea rows={7} value={draft.body_md || ""} onChange={e => setDraft(d => ({...d,body_md:e.target.value}))} placeholder={"## Concept\\nWrite notes in Markdown..."} /></div>
        <div className="admin-grid"><div className="field"><label>LaTeX formula</label><textarea rows={3} value={draft.formulas?.[0]?.latex || ""} onChange={e => setDraft(d => ({...d,formulas:[{label:d.formulas?.[0]?.label || "Formula",latex:e.target.value}]}))} placeholder="\\int_a^b f(x) dx"/><div className="latex-preview">{(draft.formulas?.[0]?.latex || "").trim() ? <InlineMath math={draft.formulas![0].latex} errorColor="#ff7373"/> : <span>Formula preview appears here</span>}</div></div><div className="field"><label>Code language</label><select value={draft.code_blocks?.[0]?.language || "python"} onChange={e => setDraft(d => ({...d,code_blocks:[{title:d.code_blocks?.[0]?.title || "Example",language:e.target.value,code:d.code_blocks?.[0]?.code || ""}]}))}><option value="python">Python</option><option value="matlab">MATLAB</option><option value="cpp">C++</option><option value="javascript">JavaScript</option><option value="java">Java</option></select><label className="sub-label">Code block</label><textarea rows={5} value={draft.code_blocks?.[0]?.code || ""} onChange={e => setDraft(d => ({...d,code_blocks:[{title:d.code_blocks?.[0]?.title || "Example",language:d.code_blocks?.[0]?.language || "python",code:e.target.value}]}))} placeholder="Paste code..."/></div></div>
        <label className="check-row"><input type="checkbox" checked={Boolean(draft.published)} onChange={e => setDraft(d => ({...d,published:e.target.checked}))}/> Publish immediately to student archive</label><div className="button-row"><button className="primary-btn" onClick={() => void saveNote()}>Save content ↗</button><button className="secondary-btn" onClick={() => setDraft({title:"",slug:"",summary:"",category:"Calculus",body_md:"",published:false,formulas:[],code_blocks:[]})}>Clear form</button></div>{adminMessage && <p className="status-message">{adminMessage}</p>}<h3>Published content</h3><div className="admin-list">{notes.map(n => <div key={n.id} className="admin-list-row"><span><strong>{n.title}</strong><small>{n.category || "General"} · {n.slug}</small></span><button className="danger-btn" onClick={() => void deleteNote(n.id)}>Delete</button></div>)}</div>
      </section> : <>
      {mode === "Basic" && <section className="workspace"><div className="panel calculator-panel"><div className="section-heading"><div><div className="eyebrow">BASIC MODE</div><h2>Scientific calculator</h2></div><button className={isListening ? "voice-btn listening" : "voice-btn"} onClick={voiceInput}>{isListening ? "● Listening…" : "🎙 Voice input"}</button></div><div className="calc-display"><div className="expression">{expression || "Enter an expression"}</div><div className="answer">{error ? <span className="error-text">{error}</span> : answer ? <><span className="equals">=</span> {answer}</> : <span className="placeholder">Your answer appears here</span>}</div></div><div className="keypad">{buttons.map((key,i) => <button key={`${key}-${i}`} className={`${["=","AC"].includes(key) ? "key special" : ["÷","×","−","+","^","⌫"].includes(key) ? "key operator" : "key"} ${key==="="?"equals-key":""}`} onClick={() => press(key)}>{key}</button>)}</div><p className="hint">Tip: use <code>sqrt(9)</code>, <code>pi</code>, <code>sin(pi/2)</code>, or dictate “five plus square root of nine”.</p></div><aside className="panel side-panel"><div className="eyebrow">QUICK REFERENCE</div><h3>Built for your workflow.</h3><div className="feature-row"><span>01</span><div><strong>Safe expression parsing</strong><p>Evaluate maths without JavaScript eval.</p></div></div><div className="feature-row"><span>02</span><div><strong>Voice-first input</strong><p>Speak expressions when your hands are busy.</p></div></div><div className="feature-row"><span>03</span><div><strong>Study resources</strong><p>Jump into curated engineering notes.</p></div></div><button className="text-link" onClick={() => setMode("Archive")}>Explore the archive →</button></aside></section>}
      {mode === "Advanced" && <section className="panel advanced-panel"><div className="section-heading"><div><div className="eyebrow">ADVANCED MODE</div><h2>Matrix lab & equation pad</h2><p>Explore matrix operations and preview mathematical notation.</p></div></div><div className="dimension-row"><label>Rows in A <select value={rows} onChange={e => resizeMatrix(Number(e.target.value),cols)}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label><label>Columns in A / rows in B <select value={cols} onChange={e => resizeMatrix(rows,Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label><label>Columns in B <select defaultValue={cols} onChange={e => { const n=Number(e.target.value); setMatrixB(old=>Array.from({length:cols},(_,r)=>Array.from({length:n},(_,c)=>old[r]?.[c]??"0"))); setMatrixResult(""); }} >{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></label></div><div className="matrix-grid"><MatrixEditor title="Matrix A" values={matrixA} onChange={setMatrixA}/><MatrixEditor title="Matrix B" values={matrixB} onChange={setMatrixB}/></div><button className="primary-btn" onClick={multiplyMatrices}>Multiply A × B</button>{matrixResult && <pre className="matrix-result">{matrixResult}</pre>}<div className="field equation-field"><label>LaTeX equation template</label><textarea rows={2} value={latex} onChange={e=>setLatex(e.target.value)}/><div className="formula-preview"><BlockMath math={latex} errorColor="#ff7373"/></div></div><div className="template-row">{[{name:"Definite integral",value:"\\\\int_a^b f(x)\\\\,dx"},{name:"Derivative",value:"\\\\frac{dy}{dx}"},{name:"Limit",value:"\\\\lim_{x\\\\to 0}\\\\frac{\\\\sin x}{x}"},{name:"Quadratic formula",value:"x=\\\\frac{-b\\\\pm\\\\sqrt{b^2-4ac}}{2a}"}].map(t=><button className="template-chip" key={t.name} onClick={()=>setLatex(t.value)}>{t.name}</button>)}</div></section>}
      {mode === "Archive" && <section className="archive-layout"><aside className="panel archive-sidebar"><div className="eyebrow">KNOWLEDGE BASE</div><h2>Study archive</h2><p>Notes, formulas, and practical code examples.</p><input className="search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search topics..."/><div className="note-list">{filteredNotes.map(note=><button key={note.id} className={activeNote.id===note.id?"note-item selected":"note-item"} onClick={()=>setActiveNote(note)}><span className="note-category">{note.category || "General"}</span><strong>{note.title}</strong><small>{note.summary}</small></button>)}{!filteredNotes.length&&<p>No matching notes.</p>}</div><span className="sync-label"><span className="live-dot"></span>{isSupabaseConfigured ? "Connected to live archive" : "Preview content · connect Supabase to sync"}</span></aside><article className="panel note-content"><div className="note-topline"><span className="note-category">{activeNote.category || "General"}</span><span className="updated-label">CALCBUDDY RESOURCE</span></div><h2>{activeNote.title}</h2><p className="note-summary">{activeNote.summary}</p><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNote.body_md || ""}</ReactMarkdown></div>{activeNote.formulas?.length ? <div className="formula-section"><h3>Key formulas</h3>{activeNote.formulas.map((f,i)=><div className="formula-card" key={i}><span>{f.label || "Formula"}</span><BlockMath math={f.latex}/></div>)}</div>:null}{activeNote.code_blocks?.length ? <div className="code-section"><h3>Code examples</h3>{activeNote.code_blocks.map((c,i)=><CodeBlock key={i} language={c.language} code={c.code} title={c.title}/>)}</div>:null}</article></section>}
      </>}
    </main><footer><span>∑ CalcBuddy</span><span>Made for curious minds. Built for engineering.</span><span>© 2026</span></footer>
  </div>;
}
function MatrixEditor({title,values,onChange}:{title:string;values:string[][];onChange:Dispatch<SetStateAction<string[][]>>}) {
 return <div className="matrix-card"><h3>{title}</h3><div className="matrix-input-grid" style={{gridTemplateColumns:`repeat(${Math.max(1,values[0]?.length||1)}, minmax(42px,1fr))`}}>{values.map((row,r)=>row.map((v,c)=><input aria-label={`${title} row ${r+1} column ${c+1}`} key={`${r}-${c}`} value={v} onChange={e=>onChange(old=>old.map((oldRow,rr)=>oldRow.map((oldVal,cc)=>rr===r&&cc===c?e.target.value:oldVal)))} />))}</div></div>;
}
export default App;
