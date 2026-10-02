# CalcBuddy: Comprehensive Technical Blueprint

## Executive Summary
CalcBuddy is a full-stack engineering student utility featuring a dual-interface system: a student-facing portal with advanced calculator capabilities and an admin dashboard for dynamic content management without frontend redeployment.

---

## 1. ARCHITECTURE & TECH STACK

### 1.1 Technology Selection Matrix

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 13+ (React 18) | Server-side rendering, API routes, optimized performance |
| **UI Framework** | Tailwind CSS v3+ | Utility-first, responsive design, built-in dark mode |
| **State Management** | Zustand + TanStack Query | Lightweight, performant, excellent caching |
| **Backend/Database** | Supabase (PostgreSQL) | Real-time updates, built-in auth, RLS policies |
| **Math Engine** | Math.js v12+ | Safe expression evaluation, matrix support |
| **LaTeX Rendering** | KaTeX v0.16+ | Fast client-side math rendering |
| **Code Highlighting** | Prism.js + react-markdown | Multi-language syntax highlighting |
| **Voice API** | Web Speech API (native) | Browser-native, no additional dependencies |
| **Rich Text Editor** | Slate.js or TipTap | Extensible, markdown-capable |
| **Deployment** | Vercel + Supabase | Seamless Next.js integration, auto-scaling |

### 1.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React Components (Portal, Admin, Shared UI)         │   │
│  │  ├─ Student Portal (3 Modes)                         │   │
│  │  ├─ Admin Dashboard                                  │   │
│  │  └─ Theme Provider (Dark/Light Toggle)               │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  State Management (Zustand + TanStack Query)         │   │
│  │  ├─ Calculator State (expression, history)           │   │
│  │  ├─ Admin State (auth, crud operations)              │   │
│  │  └─ UI State (theme, modal, notifications)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
         ┌─────────▼────────┐  ┌────────▼──────────┐
         │  API Routes      │  │  Web Speech API   │
         │  (Next.js)       │  │  (Browser Native) │
         └─────────┬────────┘  └────────────────────┘
                   │
         ┌─────────▼────────────────────┐
         │  BACKEND LAYER               │
         │  ┌────────────────────────┐  │
         │  │  Supabase (PostgreSQL) │  │
         │  ├─ Auth (JWT)            │  │
         │  ├─ RLS Policies          │  │
         │  ├─ Real-time Updates     │  │
         │  └─ Webhooks              │  │
         └─────────┬────────────────────┘
                   │
         ┌─────────▼────────────────────┐
         │  DATABASE SCHEMA             │
         │  ├─ users                    │
         │  ├─ content_library          │
         │  ├─ math_formulas            │
         │  ├─ code_blocks              │
         │  ├─ calculation_history      │
         │  └─ admin_audit_logs         │
         └──────────────────────────────┘
```

### 1.3 Dark/Light Mode Implementation

**Theme Storage & Persistence:**
- Store preference in `localStorage` under key: `calcbuddy_theme`
- Values: `"light" | "dark" | "system"`
- Sync with `prefers-color-scheme` media query for system preference

**Tailwind Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // Use class strategy
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#0066cc',
          dark: '#4da6ff'
        }
      }
    }
  }
}
```

---

## 2. PORTAL MODES (STUDENT FRONTEND)

### 2.1 Basic Mode: Scientific Calculator

**Features:**
- Expression input field with real-time parsing
- Grid-based button layout (numbers, operations, functions)
- Calculation history with re-evaluation capability
- Error handling with user-friendly messages
- Voice-to-text integration (Web Speech API)

**Key Components:**
```
CalculatorPortal/
├── Calculator.tsx          # Main calculator component
├── Display.tsx             # Expression & result display
├── Keypad.tsx             # Button grid interface
├── VoiceInput.tsx         # Speech recognition handler
└── History.tsx            # Calculation history panel
```

**Math.js Safety Measures:**
- Whitelist allowed functions: `sqrt, sin, cos, tan, log, ln, abs, pow, ...`
- Disable dangerous functions: `import, compile, parse (unsafe)`
- Expression length limit: 500 characters
- Evaluation timeout: 100ms

### 2.2 Advanced Mode: Matrix & Symbolic Computation

**Features:**
- Matrix input with dynamic row/column configuration
- Matrix operations: transpose, inverse, determinant, multiplication
- Algebraic formula templates (quadratic, cubic, trigonometric identities)
- Calculus notation support (derivatives, integrals using KaTeX)
- Multi-step solution viewer

**Key Components:**
```
AdvancedMode/
├── MatrixBuilder.tsx       # Dynamic matrix input UI
├── MatrixOperations.tsx    # Calculation engine
├── FormulaTemplate.tsx     # Pre-built formula selector
├── CalculusPanel.tsx       # Derivatives & integrals
└── SolutionViewer.tsx      # Step-by-step display
```

### 2.3 Archive Mode: Dynamic Content Viewer

**Features:**
- Server-rendered markdown content with real-time database sync
- Syntax-highlighted code blocks (Python, MATLAB, C++, JavaScript)
- Math formula rendering with KaTeX
- Full-text search capability
- Categorized content organization

**Key Components:**
```
ArchiveMode/
├── ContentBrowser.tsx      # Main archive interface
├── ContentSearch.tsx       # Search & filter
├── MarkdownRenderer.tsx    # react-markdown integration
├── CodeBlock.tsx           # Prism.js syntax highlighting
├── FormulaDisplay.tsx      # KaTeX formula rendering
└── ContentSidebar.tsx      # Category navigation
```

---

## 3. DYNAMIC ADMIN DASHBOARD (NO-REDEPLOYMENT ENGINE)

### 3.1 Admin Portal Structure

**Protected Route Hierarchy:**
```
/admin
├── /dashboard              # Overview & statistics
├── /content
│   ├── /notes              # Create/edit markdown notes
│   ├── /formulas           # LaTeX equation management
│   └── /code-blocks        # Multi-language code snippets
├── /audit                  # Admin action logs
└── /users                  # User management & roles
```

### 3.2 Role-Based Access Control (RBAC)

**Database Security Rules (RLS):**
```sql
-- Only admins can access admin content tables
CREATE POLICY admin_only_notes ON content_library
  FOR ALL USING (
    auth.uid() = user_id 
    AND 
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

**Roles:**
- `admin`: Full access to CRUD operations
- `moderator`: Read/create content, cannot delete
- `student`: Read-only access to archive content

### 3.3 Admin CRUD Components

**Content Management UI:**
```
AdminDashboard/
├── ContentForm.tsx
│   ├── MarkdownEditor.tsx (Slate.js or TipTap)
│   ├── LaTeXValidator.tsx  (Real-time KaTeX validation)
│   ├── CodeBlockInput.tsx  (Multi-language support)
│   └── MetadataForm.tsx    (Tags, category, visibility)
├── ContentTable.tsx        # List view with filtering
├── BulkActions.tsx         # Batch delete/publish
└── AuditLog.tsx           # Admin action tracking
```

### 3.4 Real-time Sync Strategy

**Implementation Approach:**
1. **Supabase Realtime Subscriptions:** Admin creates/updates content
2. **Webhook Triggers:** Database changes emit events
3. **ISR (Incremental Static Regeneration):** Next.js invalidates cached pages
4. **Client-side Sync:** TanStack Query refetch on visibility change

```typescript
// Real-time subscription pattern
useEffect(() => {
  const subscription = supabase
    .from('content_library')
    .on('*', payload => {
      queryClient.invalidateQueries(['content'])
    })
    .subscribe()
  
  return () => subscription.unsubscribe()
}, [])
```

---

## 4. DATABASE SCHEMA DESIGN

### 4.1 Core Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  role VARCHAR DEFAULT 'student', -- admin, moderator, student
  created_at TIMESTAMP DEFAULT now(),
  last_login TIMESTAMP
);
```

#### `content_library`
```sql
CREATE TABLE content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  content TEXT NOT NULL, -- Markdown
  category VARCHAR, -- calculus, linear_algebra, etc.
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  is_published BOOLEAN DEFAULT false
);
```

#### `math_formulas`
```sql
CREATE TABLE math_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  latex_expression TEXT NOT NULL,
  description TEXT,
  category VARCHAR,
  validated BOOLEAN DEFAULT false, -- KaTeX validated
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);
```

#### `code_blocks`
```sql
CREATE TABLE code_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  language VARCHAR NOT NULL, -- python, matlab, cpp, etc.
  code_content TEXT NOT NULL,
  description TEXT,
  content_id UUID REFERENCES content_library(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);
```

#### `calculation_history`
```sql
CREATE TABLE calculation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  expression VARCHAR NOT NULL,
  result VARCHAR NOT NULL,
  calculator_mode VARCHAR, -- basic, advanced, archive
  created_at TIMESTAMP DEFAULT now()
);
```

#### `admin_audit_logs`
```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id),
  action VARCHAR NOT NULL, -- create, update, delete
  table_name VARCHAR,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  timestamp TIMESTAMP DEFAULT now()
);
```

### 4.2 Database Indexes & Optimization

```sql
CREATE INDEX idx_content_category ON content_library(category);
CREATE INDEX idx_content_published ON content_library(is_published);
CREATE INDEX idx_formulas_category ON math_formulas(category);
CREATE INDEX idx_code_language ON code_blocks(language);
CREATE INDEX idx_history_user ON calculation_history(user_id, created_at);
```

---

## 5. SECURITY IMPLEMENTATION

### 5.1 Authentication Flow

**Supabase Auth Configuration:**
```typescript
// pages/api/auth/[...nextauth].ts
import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  // Validate role from users table
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()
  
  return user.role === 'admin'
}
```

### 5.2 Row-Level Security (RLS) Policies

```sql
-- Students can only read published content
CREATE POLICY student_read_published ON content_library
  FOR SELECT USING (
    is_published = true 
    OR 
    auth.uid() = created_by
  );

-- Only admins can update any content
CREATE POLICY admin_all_operations ON content_library
  FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  );
```

### 5.3 API Security

**Middleware Protection:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Verify JWT token
    const token = request.cookies.get('sb-auth-token')?.value
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
```

---

## 6. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- [ ] Next.js project setup with TypeScript
- [ ] Supabase project & initial schema
- [ ] Authentication system (Supabase Auth)
- [ ] Basic layout & navigation

### Phase 2: Student Portal - Basic Mode (Week 3-4)
- [ ] Calculator component with Math.js
- [ ] Basic expression evaluation
- [ ] History tracking
- [ ] Theme toggle (dark/light)

### Phase 3: Student Portal - Advanced & Archive (Week 5-6)
- [ ] Matrix builder & operations
- [ ] Formula templates with KaTeX
- [ ] Markdown content rendering
- [ ] Code block syntax highlighting

### Phase 4: Admin Dashboard (Week 7-8)
- [ ] Admin authentication & RBAC
- [ ] Rich text editor setup
- [ ] Content CRUD operations
- [ ] Audit logging

### Phase 5: Voice & Advanced Features (Week 9)
- [ ] Web Speech API integration
- [ ] Voice command parsing
- [ ] Testing & optimization

### Phase 6: Deployment & Polish (Week 10)
- [ ] Vercel deployment
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation

---

## 7. DEPLOYMENT STRATEGY

### 7.1 Environment Configuration

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Feature flags
NEXT_PUBLIC_ENABLE_VOICE_INPUT=true
NEXT_PUBLIC_ENABLE_ADVANCED_MODE=true
```

### 7.2 CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci && npm run build
      - run: npm run test
      - uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

---

## 8. Performance Optimization Checklist

- [ ] Image optimization with Next.js `<Image>`
- [ ] Code splitting and dynamic imports
- [ ] TanStack Query caching strategy
- [ ] Database query optimization (indexes)
- [ ] API response compression
- [ ] Client-side caching headers
- [ ] Lighthouse score > 90

---

## 9. Monitoring & Maintenance

**Tools:**
- Sentry (error tracking)
- Vercel Analytics
- Supabase monitoring dashboard
- Custom audit logs for admin actions

---

## Next Steps

Proceed to implementation with the provided boilerplate files in the following order:
1. Project structure & package.json
2. Tailwind & theme configuration
3. Database schema migrations
4. API routes & middleware
5. React components (bottom-up approach)
6. Integration testing
7. Deployment configuration
