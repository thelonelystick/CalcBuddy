# CalcBuddy 
## Prompt :-
Act as an expert Full-Stack Software Architect. I need a comprehensive technical blueprint and boilerplate implementation strategy for a web application called "CellBuddy," designed as an engineering student utility.

The application must features a student-facing portal and a secure Admin Dashboard that allows content management (notes, code blocks, math formulas) dynamically without requiring frontend redeployments.

Please provide the implementation specifications organized across the following requirements:

1. ARCHITECTURE & TECH STACK
- Frontend framework: React.js (or Next.js) with Tailwind CSS.
- Theming strategy: Tailwind-based global Dark/Light mode toggling stored in localStorage.
- Backend/Database: A decoupled system like Supabase (PostgreSQL) or Firebase (Firestore) handling user Authentication and content storage.
- Calculation Engines: Math.js for safe mathematical string parsing.

2. PORTAL MODES (STUDENT FRONTEND)
- Basic Mode: A scientific calculator grid that evaluates mathematical expressions via Math.js. Include an integration with the native browser Web Speech API for voice-to-text calculations (converting spoken words like "five plus square root of nine" into evaluated strings).
- Advanced Mode: UI panels supporting matrix algebra inputs (dynamic rows/columns dimensions) and algebraic formatting templates for calculus/theorems using KaTeX or MathQuill.
- Archive Mode: A content viewport that dynamically fetches data from the database. It must render Markdown text using a package like react-markdown and display multi-language syntax-highlighted code blocks (Python, MATLAB, C++) via a rendering component.

3. DYNAMIC ADMIN DASHBOARD (NO-REDEPLOYMENT ENGINE)
- Secure, role-protected interface (/admin layout) restricted via Database Security Rules.
- A CRUD management form that pushes updates instantly to the production database.
- Input configuration options including a Rich-Text/Markdown content creator, a dedicated LaTeX equation checker input, and multi-field inputs for writing multi-language programming code blocks.

4. DATABASE SCHEMA & STATE
- Provide a clean JSON database schema structure or relational tables design demonstrating how notes, syntax languages, categories, and raw formulas link together.
- Show a sample frontend data-fetching implementation snippet illustrating how the Student Frontend dynamically hooks into the live API to display content variations seamlessly.
