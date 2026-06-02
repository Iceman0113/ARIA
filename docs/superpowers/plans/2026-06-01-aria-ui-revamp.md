# ARIA UI Revamp — Implementation Plan

**Spec:** `/Users/randyjewell/ARIA/docs/superpowers/specs/2026-06-01-aria-ui-revamp-design.md`
**Visual reference:** `/Users/randyjewell/ARIA/mockups/aria-ui-v9-1.html`
**Status:** Ready to execute
**Date:** 2026-06-01

---

## REQUIRED SUB-SKILLS

> Before starting, the executor must load these skills:
>
> - `test-driven-development` — every behavioral unit follows red → green → commit
> - `verification-before-completion` — never check off a task without running the verify command and seeing the expected output
> - `systematic-debugging` — when a step fails, diagnose root cause before retrying
> - `executing-plans` — overall execution discipline

---

## Goal

Replace ARIA's three-column sci-fi HUD with a voice-first, 3D-immersive cofounder interface centered on a Three.js "Data Bloom" neural map, with a slide-up dashboard drawer. Keep the entire backend, voice pipeline, and sub-agent system intact. Five phases (A → E), atomic tasks, frequent commits.

## Architecture

```
client/src/
├── App.jsx                     # routing + WS + voice (slimmer)
├── main.jsx                    # unchanged entry
├── Voice.js                    # PRESERVED unchanged
├── WakeWord.js                 # PRESERVED unchanged
├── index.css                   # FULL REWRITE to new token system
├── shell/
│   ├── TopBar.jsx
│   ├── MicBar.jsx
│   └── NavChips.jsx
├── neural-map/
│   ├── NeuralMap.jsx           # React wrapper, mounts scene.js
│   ├── scene.js                # all Three.js, extracted from v9-1.html
│   ├── workStates.js           # work-state machine helpers
│   ├── tooltip.js              # raycaster + DOM tooltip
│   └── shaders/
│       ├── noise.glsl.js       # snoise — reused by core + backdrop
│       ├── ariaCore.vert.glsl.js
│       ├── ariaCore.frag.glsl.js
│       ├── ariaShell.frag.glsl.js
│       ├── dendrite.vert.glsl.js
│       ├── dendrite.frag.glsl.js
│       ├── filament.frag.glsl.js
│       ├── pollen.vert.glsl.js
│       ├── pollen.frag.glsl.js
│       ├── mist.vert.glsl.js
│       ├── mist.frag.glsl.js
│       ├── backdrop.frag.glsl.js
│       └── postGrain.frag.glsl.js
├── dashboard/
│   ├── DashboardDrawer.jsx
│   ├── KpiStrip.jsx
│   ├── ActionsPanel.jsx
│   └── IntelFeed.jsx
└── pages/
    └── Console.jsx             # the / route — neural map + drawer

server/src/
├── index.js                    # add GET /neural-map + agent_state broadcast
├── neural-map.js               # NEW — builds the {nodes, edges} payload
├── agent.js                    # emit agent_state events around callTool
└── supabase.js                 # UNCHANGED
```

## Tech Stack

- **Frontend:** React 19, Vite 8, vanilla Three.js 0.174 (downgrade from 0.184), Vitest + jsdom for tests
- **Backend:** Express 4, ws 8, Supabase JS 2 (unchanged)
- **Fonts:** Space Grotesk, Geist, Geist Mono (Google Fonts)
- **No react-three-fiber, no drei, no @react-three/postprocessing** — removed entirely

## Visual Tokens (repeat verbatim in CSS — do NOT abbreviate)

```
--bg:        rgb(3, 3, 7);
--bg-card:   rgba(255,255,255,0.025);
--bg-elev:   rgba(255,255,255,0.05);
--border:    rgba(255,255,255,0.06);
--border-2:  rgba(255,255,255,0.12);
--text:      #FFFFFF;
--text-dim:  rgba(255,255,255,0.62);
--text-mute: rgba(255,255,255,0.38);
--accent:    #C5FF4D;   /* lime — single brand accent */
--warn:      #F2B04E;   /* amber */
--hot:       #FF6B5C;   /* coral — overdue/errors */
--info:      #6FA8DC;   /* blue */
```

Sub-agent colors (persona-bound, never change):

```
Scout:    #6BD08F
Hunter:   #E08B5C
Creative: #B97FE5
Hermes:   #E3CC68
Beacon:   #6FA8DC    /* (Factory-proposed) */
Verse:    #C078E5    /* (Factory-proposed) */
```

> **Note on v9-1.html vs spec colors:** The mockup uses slightly lighter shades (`#9FE89A`, `#E8B36A`, `#C7A4F0`, `#F0D67A`). The spec is authoritative — use the spec values in production code.

---

## Phase A — Shell

Token system, fonts, top bar, mic bar, nav chips, empty drawer that opens/closes. NO neural map yet — placeholder div with `background: #000`.

### Task A1 — Set up Vitest for client

**Files:**
- Create: `/Users/randyjewell/ARIA/client/vitest.config.js`
- Modify: `/Users/randyjewell/ARIA/client/package.json` (add devDeps, test script)
- Create: `/Users/randyjewell/ARIA/client/src/test/setup.js`
- Create: `/Users/randyjewell/ARIA/client/src/test/smoke.test.js`

**Steps:**

- [ ] **Step 1** — Install Vitest deps. Run:
  ```bash
  cd /Users/randyjewell/ARIA/client && npm install --save-dev vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 jsdom@^25
  ```
  Expected: `added N packages` with no errors.

- [ ] **Step 2** — Add `test` script and `"three": "^0.174.0"` swap to `client/package.json`. Replace the existing `"three": "^0.184.0"` line and remove the three `@react-three/*` lines. Final `package.json`:
  ```json
  {
    "name": "cofounder-ui",
    "version": "0.1.0",
    "type": "module",
    "scripts": {
      "dev": "vite --port 5174",
      "build": "vite build",
      "preview": "vite preview",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "dependencies": {
      "react": "^19.2.5",
      "react-dom": "^19.2.5",
      "three": "^0.174.0"
    },
    "devDependencies": {
      "@testing-library/jest-dom": "^6",
      "@testing-library/react": "^16",
      "@vitejs/plugin-react": "^6.0.1",
      "jsdom": "^25",
      "vite": "^8.0.10",
      "vitest": "^2"
    }
  }
  ```

- [ ] **Step 3** — Run `cd /Users/randyjewell/ARIA/client && npm install`. Expected: `added/removed N packages` and the three R3F packages are gone from `node_modules/@react-three`.

- [ ] **Step 4** — Create `/Users/randyjewell/ARIA/client/vitest.config.js`:
  ```js
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
  });
  ```

- [ ] **Step 5** — Create `/Users/randyjewell/ARIA/client/src/test/setup.js`:
  ```js
  import '@testing-library/jest-dom/vitest';
  ```

- [ ] **Step 6** — Create a failing smoke test at `/Users/randyjewell/ARIA/client/src/test/smoke.test.js`:
  ```js
  import { describe, it, expect } from 'vitest';

  describe('vitest harness', () => {
    it('runs', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- [ ] **Step 7** — Run `cd /Users/randyjewell/ARIA/client && npm test`. Expected output ends with:
  ```
  Test Files  1 passed (1)
       Tests  1 passed (1)
  ```

- [ ] **Step 8** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/package.json client/package-lock.json client/vitest.config.js client/src/test/ && git commit -m "Add Vitest, swap three to 0.174, remove R3F deps"
  ```

### Task A2 — Set up Vitest for server

**Files:**
- Modify: `/Users/randyjewell/ARIA/server/package.json`
- Create: `/Users/randyjewell/ARIA/server/src/test/smoke.test.js`

**Steps:**

- [ ] **Step 1** — Install Vitest in server. Run:
  ```bash
  cd /Users/randyjewell/ARIA/server && npm install --save-dev vitest@^2 supertest@^7
  ```

- [ ] **Step 2** — Add `test` script to `server/package.json` `scripts`:
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- [ ] **Step 3** — Create `/Users/randyjewell/ARIA/server/src/test/smoke.test.js`:
  ```js
  import { describe, it, expect } from 'vitest';

  describe('server vitest harness', () => {
    it('runs', () => {
      expect(2 * 2).toBe(4);
    });
  });
  ```

- [ ] **Step 4** — Run `cd /Users/randyjewell/ARIA/server && npm test`. Expected: 1 passed.

- [ ] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add server/package.json server/package-lock.json server/src/test/ && git commit -m "Add Vitest to server"
  ```

### Task A3 — New `index.css` token system

**Files:**
- Modify (full rewrite): `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [ ] **Step 1** — Add a failing test at `/Users/randyjewell/ARIA/client/src/test/tokens.test.js`:
  ```js
  import { describe, it, expect } from 'vitest';
  import fs from 'node:fs';
  import path from 'node:path';

  const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');

  describe('design tokens', () => {
    it('defines lime accent #C5FF4D', () => {
      expect(css).toMatch(/--accent:\s*#C5FF4D/);
    });
    it('defines warm near-black bg rgb(3, 3, 7)', () => {
      expect(css).toMatch(/--bg:\s*rgb\(3,\s*3,\s*7\)/);
    });
    it('imports Space Grotesk + Geist + Geist Mono', () => {
      expect(css).toMatch(/Space\+Grotesk/);
      expect(css).toMatch(/Geist:wght/);
      expect(css).toMatch(/Geist\+Mono/);
    });
    it('defines eyebrow ◦ pseudo-element', () => {
      expect(css).toMatch(/\.eyebrow::before/);
      expect(css).toMatch(/content:\s*"◦ "/);
    });
  });
  ```

- [ ] **Step 2** — Run `npm test`. Expected: tokens.test.js fails — the file still has `--teal` not `--accent`.

- [ ] **Step 3** — Replace the entire contents of `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');

  :root {
    --bg:        rgb(3, 3, 7);
    --bg-card:   rgba(255,255,255,0.025);
    --bg-elev:   rgba(255,255,255,0.05);
    --border:    rgba(255,255,255,0.06);
    --border-2:  rgba(255,255,255,0.12);
    --text:      #FFFFFF;
    --text-dim:  rgba(255,255,255,0.62);
    --text-mute: rgba(255,255,255,0.38);
    --accent:    #C5FF4D;
    --warn:      #F2B04E;
    --hot:       #FF6B5C;
    --info:      #6FA8DC;

    --scout:     #6BD08F;
    --hunter:    #E08B5C;
    --creative:  #B97FE5;
    --hermes:    #E3CC68;
    --beacon:    #6FA8DC;
    --verse:     #C078E5;

    --font-display: "Space Grotesk", system-ui, sans-serif;
    --font-body:    "Geist", ui-sans-serif, system-ui, sans-serif;
    --font-mono:    "Geist Mono", ui-monospace, SFMono-Regular, monospace;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    width: 100%; height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .mono { font-family: var(--font-mono); font-feature-settings: 'tnum' 1; }

  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
    color: var(--text-dim);
  }
  .eyebrow::before { content: "◦ "; color: var(--accent); margin-right: 4px; }
  ```

- [ ] **Step 4** — Run `npm test`. Expected: tokens.test.js passes.

- [ ] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/index.css client/src/test/tokens.test.js && git commit -m "Rewrite index.css to new token system + load Space Grotesk/Geist fonts"
  ```

### Task A4 — TopBar component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/shell/TopBar.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/shell/TopBar.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css` (append top-bar CSS)

**Steps:**

- [ ] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/shell/TopBar.test.jsx`:
  ```jsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import TopBar from './TopBar.jsx';

  describe('<TopBar>', () => {
    it('renders the A.R.I.A. brand mark', () => {
      render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
      expect(screen.getByText('A.R.I.A.')).toBeInTheDocument();
    });

    it('renders Jack & Jewell Consulting and Greenwood, IN', () => {
      render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
      expect(screen.getByText(/Jack & Jewell Consulting/)).toBeInTheDocument();
      expect(screen.getByText(/Greenwood, IN/)).toBeInTheDocument();
    });

    it('renders the four live pills with mono-formatted values', () => {
      render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="idle" />);
      expect(screen.getByText('12.8K')).toBeInTheDocument();
      expect(screen.getByText('$0.42')).toBeInTheDocument();
      expect(screen.getByText('$1,950')).toBeInTheDocument();
      expect(screen.getByText('0.74s')).toBeInTheDocument();
    });

    it('marks latency as slow when >= 1.0s', () => {
      render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={1.2} presence="idle" />);
      expect(screen.getByText('1.20s')).toHaveClass('slow');
    });

    it('renders the presence string', () => {
      render(<TopBar tokens={12800} spend={0.42} mrr={1950} mrrTarget={16500} latency={0.74} presence="listening" />);
      expect(screen.getByText(/listening/)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2** — Run `npm test`. Expected: TopBar.test.jsx errors with `Cannot find module './TopBar.jsx'`.

- [ ] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/shell/TopBar.jsx`:
  ```jsx
  export default function TopBar({ tokens, spend, mrr, mrrTarget, latency, presence }) {
    const tokenStr = (tokens / 1000).toFixed(1) + 'K';
    const spendStr = '$' + spend.toFixed(2);
    const mrrStr   = '$' + mrr.toLocaleString();
    const mrrPct   = Math.min(100, Math.round((mrr / mrrTarget) * 100));
    const latStr   = latency.toFixed(2) + 's';
    const latClass = latency < 1.0 ? 'fast' : 'slow';

    const presenceText = {
      idle:      'idle · "hey ARIA"',
      listening: 'listening',
      thinking:  'thinking',
      speaking:  'speaking',
    }[presence] || presence;

    return (
      <div className="top">
        <div className="brand-text">
          A.R.I.A.
          <span className="div">/</span>
          <span className="sub">Jack &amp; Jewell Consulting</span>
          <span className="loc">· Greenwood, IN</span>
        </div>

        <div className="pills">
          <div className="pill tokens">
            <span className="dot" />
            <span className="label">tokens</span>
            <span className="val live mono">{tokenStr}</span>
            <span className="delta mono" style={{ color: 'var(--text-mute)' }}>today</span>
          </div>

          <div className="pill cost">
            <span className="dot" />
            <span className="label">spend</span>
            <span className="val mono">{spendStr}</span>
          </div>

          <div className="pill revenue">
            <span className="dot" />
            <span className="label">MRR</span>
            <span className="val mono">{mrrStr}</span>
            <div className="progress"><div className="fill" style={{ width: `${mrrPct}%` }} /></div>
            <span className="delta mono" style={{ color: 'var(--text-mute)' }}>{mrrPct}%</span>
          </div>

          <div className="pill latency">
            <span className="dot" />
            <span className="label">latency</span>
            <span className={`val ${latClass} mono`}>{latStr}</span>
          </div>

          <div className="presence-mark">
            <span className="dot" />
            {presenceText}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4** — Append to `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  /* ============== TOP BAR ============== */
  .top {
    padding: 16px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: fixed; top: 0; left: 0; right: 0;
    z-index: 30;
    backdrop-filter: blur(14px);
    background: rgba(3,3,7,0.7);
    border-bottom: 1px solid var(--border);
    height: 64px;
  }
  .brand-text { font-family: var(--font-display); font-size: 15px; letter-spacing: -0.01em; font-weight: 600; }
  .brand-text .div { color: var(--text-mute); font-weight: 400; margin: 0 8px; }
  .brand-text .sub { color: var(--text-dim); font-weight: 500; }
  .brand-text .loc { color: var(--text-mute); font-weight: 400; font-size: 13px; margin-left: 8px; }

  .pills { display: flex; gap: 8px; align-items: center; }
  .pill {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 13px;
    border-radius: 999px;
    background: rgba(255,255,255,0.035);
    border: 1px solid var(--border-2);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text);
    backdrop-filter: blur(8px);
    transition: all 0.18s ease;
  }
  .pill .label { color: var(--text-mute); letter-spacing: 0.06em; text-transform: uppercase; font-size: 9px; }
  .pill .val { color: var(--text); font-weight: 500; font-size: 12px; }
  .pill .delta { font-size: 10px; }
  .pill .dot { width: 6px; height: 6px; border-radius: 50%; flex: 0 0 6px; }
  .pill.tokens .dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: tokpulse 2s ease-in-out infinite; }
  .pill.tokens .val.live { color: var(--accent); }
  @keyframes tokpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .pill.cost .dot { background: var(--warn); box-shadow: 0 0 6px var(--warn); }
  .pill.cost .val { color: var(--warn); }
  .pill.revenue .dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .pill.revenue .progress { width: 30px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
  .pill.revenue .progress .fill { height: 100%; background: var(--accent); box-shadow: 0 0 6px var(--accent); }
  .pill.latency .dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  .pill.latency .val.fast { color: var(--accent); }
  .pill.latency .val.slow { color: var(--warn); }
  .presence-mark {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);
    padding-left: 14px; border-left: 1px solid var(--border);
  }
  .presence-mark .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: tokpulse 2.4s ease-in-out infinite; }
  ```

- [ ] **Step 5** — Run `npm test`. Expected: all 5 TopBar tests pass.

- [ ] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/shell/TopBar.jsx client/src/shell/TopBar.test.jsx client/src/index.css && git commit -m "Add TopBar component with live pills + presence mark"
  ```

### Task A5 — MicBar component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/shell/MicBar.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/shell/MicBar.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css` (append mic-bar CSS)

**Steps:**

- [ ] **Step 1** — Create failing test:
  ```jsx
  // /Users/randyjewell/ARIA/client/src/shell/MicBar.test.jsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import MicBar from './MicBar.jsx';

  describe('<MicBar>', () => {
    const defaults = {
      state: 'idle',
      latency: 0.74,
      drawerOpen: false,
      onMicClick: () => {},
      onSubmit: () => {},
      onToggleDrawer: () => {},
      textValue: '',
      onTextChange: () => {},
    };

    it('renders mic button, input, latency, state pill, drawer toggle', () => {
      render(<MicBar {...defaults} />);
      expect(screen.getByRole('button', { name: /toggle voice/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type a message or say "hey ARIA"/i)).toBeInTheDocument();
      expect(screen.getByText('0.74s')).toBeInTheDocument();
      expect(screen.getByText('Idle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /toggle dashboard/i })).toBeInTheDocument();
    });

    it('marks the mic button + state pill as listening when state=listening', () => {
      render(<MicBar {...defaults} state="listening" />);
      expect(screen.getByRole('button', { name: /toggle voice/i })).toHaveClass('listening');
      expect(screen.getByText('Listening')).toHaveClass('listening');
    });

    it('fires onMicClick when mic button clicked', () => {
      const onMicClick = vi.fn();
      render(<MicBar {...defaults} onMicClick={onMicClick} />);
      fireEvent.click(screen.getByRole('button', { name: /toggle voice/i }));
      expect(onMicClick).toHaveBeenCalledOnce();
    });

    it('fires onSubmit when form submitted with text', () => {
      const onSubmit = vi.fn();
      render(<MicBar {...defaults} textValue="hello" onSubmit={onSubmit} />);
      fireEvent.submit(screen.getByPlaceholderText(/hey ARIA/i).closest('form'));
      expect(onSubmit).toHaveBeenCalledWith('hello');
    });

    it('rotates the chevron when drawer is open', () => {
      const { rerender } = render(<MicBar {...defaults} drawerOpen={false} />);
      expect(screen.getByRole('button', { name: /toggle dashboard/i })).not.toHaveClass('on');
      rerender(<MicBar {...defaults} drawerOpen={true} />);
      expect(screen.getByRole('button', { name: /toggle dashboard/i })).toHaveClass('on');
    });
  });
  ```

- [ ] **Step 2** — Run `npm test`. Expected: MicBar.test.jsx errors with `Cannot find module './MicBar.jsx'`.

- [ ] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/shell/MicBar.jsx`:
  ```jsx
  const STATE_LABEL = {
    idle: 'Idle',
    listening: 'Listening',
    thinking: 'Thinking',
    speaking: 'Speaking',
    sleeping: 'Sleeping',
  };

  export default function MicBar({
    state,
    latency,
    drawerOpen,
    onMicClick,
    onSubmit,
    onToggleDrawer,
    textValue,
    onTextChange,
  }) {
    const isListening = state === 'listening';
    const stateLabel  = STATE_LABEL[state] || 'Idle';

    const handleSubmit = (e) => {
      e.preventDefault();
      if (textValue && textValue.trim()) onSubmit(textValue.trim());
    };

    return (
      <form className="mic-bar" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`mic-button ${isListening ? 'listening' : ''}`}
          onClick={onMicClick}
          aria-label="Toggle voice"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
          </svg>
        </button>

        <input
          className="input"
          placeholder='Type a message or say "hey ARIA"...'
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
        />

        <div className="lat-mini">last <span className="v mono">{latency.toFixed(2)}s</span></div>

        <div className={`state-pill ${isListening ? 'listening' : ''}`}>{stateLabel}</div>

        <button
          type="button"
          className={`dash-toggle ${drawerOpen ? 'on' : ''}`}
          onClick={onToggleDrawer}
          aria-label="Toggle dashboard"
        >
          <span>Dashboard</span>
          <span className="arrow">▴</span>
        </button>
      </form>
    );
  }
  ```

- [ ] **Step 4** — Append to `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  /* ============== MIC BAR ============== */
  .mic-bar {
    position: fixed; bottom: 18px; left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 56px);
    max-width: 1280px;
    background: rgba(13,13,17,0.92);
    border: 1px solid var(--border-2);
    border-radius: 16px;
    padding: 12px 18px;
    display: grid;
    grid-template-columns: auto 1fr auto auto auto;
    gap: 12px;
    align-items: center;
    backdrop-filter: blur(20px);
    box-shadow: 0 14px 40px rgba(0,0,0,0.5), 0 0 40px rgba(197,255,77,0.04);
    z-index: 50;
  }
  .mic-button {
    width: 40px; height: 40px;
    border-radius: 11px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-2);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-dim);
    cursor: pointer;
    flex: 0 0 40px;
    transition: all 0.15s ease;
  }
  .mic-button:hover { color: var(--accent); border-color: var(--accent); }
  .mic-button.listening {
    background: rgba(197,255,77,0.1);
    color: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 24px rgba(197,255,77,0.25);
  }
  .mic-bar .input {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    outline: none;
  }
  .mic-bar .input::placeholder { color: var(--text-mute); }
  .mic-bar .lat-mini {
    font-family: var(--font-mono); font-size: 10px; color: var(--text-mute);
    padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.04);
  }
  .mic-bar .lat-mini .v { color: var(--accent); }
  .mic-bar .state-pill {
    font-family: var(--font-mono);
    font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-mute);
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--border-2);
  }
  .mic-bar .state-pill.listening {
    color: var(--accent);
    border-color: rgba(197,255,77,0.4);
    background: rgba(197,255,77,0.05);
  }
  .dash-toggle {
    font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em;
    color: var(--text-dim);
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid var(--border-2);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    text-transform: uppercase;
    transition: all 0.15s ease;
  }
  .dash-toggle:hover { color: var(--accent); border-color: var(--accent); }
  .dash-toggle .arrow { font-size: 14px; transition: transform 0.2s ease; }
  .dash-toggle.on { color: var(--accent); border-color: var(--accent); background: rgba(197,255,77,0.06); }
  .dash-toggle.on .arrow { transform: rotate(180deg); }
  ```

- [ ] **Step 5** — Run `npm test`. Expected: all MicBar tests pass.

- [ ] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/shell/MicBar.jsx client/src/shell/MicBar.test.jsx client/src/index.css && git commit -m "Add MicBar component with mic/input/latency/state/drawer toggle"
  ```

### Task A6 — NavChips component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/shell/NavChips.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/shell/NavChips.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [ ] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/shell/NavChips.test.jsx`:
  ```jsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import NavChips from './NavChips.jsx';

  describe('<NavChips>', () => {
    it('renders the six routes prefixed with ◦', () => {
      render(<NavChips active="console" onNav={() => {}} />);
      ['Console', 'Factory', 'Clients', 'Pipeline', 'Memory', 'Settings'].forEach(name => {
        expect(screen.getByText(new RegExp(name))).toBeInTheDocument();
      });
    });

    it('marks the active chip with the active class', () => {
      render(<NavChips active="factory" onNav={() => {}} />);
      expect(screen.getByText(/Factory/).closest('button')).toHaveClass('active');
      expect(screen.getByText(/Console/).closest('button')).not.toHaveClass('active');
    });

    it('fires onNav with the chip id when clicked', () => {
      const onNav = vi.fn();
      render(<NavChips active="console" onNav={onNav} />);
      fireEvent.click(screen.getByText(/Pipeline/).closest('button'));
      expect(onNav).toHaveBeenCalledWith('pipeline');
    });
  });
  ```

- [ ] **Step 2** — Run `npm test`. Expected: failure (module not found).

- [ ] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/shell/NavChips.jsx`:
  ```jsx
  const ROUTES = [
    { id: 'console',  label: 'Console' },
    { id: 'factory',  label: 'Factory' },
    { id: 'clients',  label: 'Clients' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'memory',   label: 'Memory' },
    { id: 'settings', label: 'Settings' },
  ];

  export default function NavChips({ active, onNav }) {
    return (
      <div className="nav-chips">
        {ROUTES.map(r => (
          <button
            key={r.id}
            type="button"
            className={`nav-chip ${active === r.id ? 'active' : ''}`}
            onClick={() => onNav(r.id)}
          >
            <span className="bullet">◦</span> {r.label}
          </button>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 4** — Append CSS to `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  /* ============== NAV CHIPS ============== */
  .nav-chips {
    position: fixed;
    top: 72px;
    left: 28px;
    display: flex;
    gap: 6px;
    z-index: 20;
  }
  .nav-chip {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 5px 11px;
    border-radius: 999px;
    border: 1px solid var(--border-2);
    background: rgba(255,255,255,0.025);
    color: var(--text-dim);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .nav-chip:hover { color: var(--text); border-color: var(--accent); }
  .nav-chip .bullet { color: var(--accent); margin-right: 2px; }
  .nav-chip.active {
    background: var(--accent);
    color: var(--bg);
    border-color: var(--accent);
  }
  .nav-chip.active .bullet { color: var(--bg); }
  ```

- [ ] **Step 5** — Run `npm test`. Expected: all NavChips tests pass.

- [ ] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/shell/NavChips.jsx client/src/shell/NavChips.test.jsx client/src/index.css && git commit -m "Add NavChips: 6 horizontal route chips with ◦ bullets"
  ```

### Task A7 — Empty DashboardDrawer that opens/closes

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/DashboardDrawer.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/DashboardDrawer.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [ ] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/dashboard/DashboardDrawer.test.jsx`:
  ```jsx
  import { describe, it, expect, vi } from 'vitest';
  import { render, screen, fireEvent } from '@testing-library/react';
  import DashboardDrawer from './DashboardDrawer.jsx';

  describe('<DashboardDrawer>', () => {
    it('renders with .on class when open=true', () => {
      const { container } = render(<DashboardDrawer open={true} onClose={() => {}} />);
      expect(container.querySelector('.drawer')).toHaveClass('on');
      expect(container.querySelector('.drawer-backdrop')).toHaveClass('on');
    });

    it('renders without .on class when open=false', () => {
      const { container } = render(<DashboardDrawer open={false} onClose={() => {}} />);
      expect(container.querySelector('.drawer')).not.toHaveClass('on');
    });

    it('fires onClose when handle clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<DashboardDrawer open={true} onClose={onClose} />);
      fireEvent.click(container.querySelector('.drawer-handle'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('fires onClose when backdrop clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<DashboardDrawer open={true} onClose={onClose} />);
      fireEvent.click(container.querySelector('.drawer-backdrop'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('fires onClose when ESC pressed while open', () => {
      const onClose = vi.fn();
      render(<DashboardDrawer open={true} onClose={onClose} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not fire onClose on ESC when closed', () => {
      const onClose = vi.fn();
      render(<DashboardDrawer open={false} onClose={onClose} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2** — Run `npm test`. Expected: failure (module not found).

- [ ] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/dashboard/DashboardDrawer.jsx`:
  ```jsx
  import { useEffect } from 'react';

  export default function DashboardDrawer({ open, onClose, children }) {
    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
      <>
        <div className={`drawer-backdrop ${open ? 'on' : ''}`} onClick={onClose} />
        <div className={`drawer ${open ? 'on' : ''}`}>
          <div className="drawer-handle" onClick={onClose}>
            <div className="handle-bar" />
            <div className="label">Dashboard · tap or press ESC to close</div>
          </div>
          <div className="drawer-body">
            {children}
          </div>
        </div>
      </>
    );
  }
  ```

- [ ] **Step 4** — Append to `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  /* ============== DASHBOARD DRAWER ============== */
  .drawer {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: 60vh;
    background: rgba(8,8,12,0.96);
    border-top: 1px solid var(--border-2);
    backdrop-filter: blur(20px);
    transform: translateY(100%);
    transition: transform 0.4s cubic-bezier(0.32, 0.72, 0.34, 1);
    z-index: 40;
    overflow-y: auto;
    padding-bottom: 90px;
  }
  .drawer.on { transform: translateY(0); }
  .drawer .drawer-handle {
    position: sticky; top: 0; z-index: 2;
    text-align: center;
    padding: 14px 0 8px;
    background: rgba(8,8,12,0.96);
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(8px);
    cursor: pointer;
  }
  .drawer .drawer-handle .handle-bar {
    width: 48px; height: 4px;
    background: var(--border-2);
    border-radius: 2px;
    margin: 0 auto 8px;
  }
  .drawer .drawer-handle .label {
    font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em;
    color: var(--text-mute); text-transform: uppercase;
  }
  .drawer .drawer-handle .label::before { content: "◦ "; color: var(--accent); }
  .drawer-body { max-width: 1280px; margin: 0 auto; padding: 24px 32px; }
  .drawer-backdrop {
    position: fixed; inset: 0 0 84px 0;
    background: rgba(3,3,7,0.5);
    backdrop-filter: blur(2px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    z-index: 35;
  }
  .drawer-backdrop.on { opacity: 1; pointer-events: auto; }
  ```

- [ ] **Step 5** — Run `npm test`. Expected: all DashboardDrawer tests pass.

- [ ] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/dashboard/DashboardDrawer.jsx client/src/dashboard/DashboardDrawer.test.jsx client/src/index.css && git commit -m "Add DashboardDrawer with handle, backdrop, ESC close"
  ```

### Task A8 — Console page + wire it into App.jsx

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/App.jsx` (full rewrite — much slimmer)
- Modify: `/Users/randyjewell/ARIA/client/src/index.css` (append stage placeholder CSS)
- Delete: `/Users/randyjewell/ARIA/client/src/components/CosmicOrb.jsx`
- Delete: `/Users/randyjewell/ARIA/client/src/components/Orb.jsx`

**Steps:**

- [ ] **Step 1** — Create `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`. (NeuralMap is just a placeholder div in Phase A; Phase B fills it in.)
  ```jsx
  import { useState } from 'react';
  import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';

  export default function Console({ drawerOpen, onCloseDrawer }) {
    return (
      <>
        <div className="stage" id="stage">
          <div className="neural-map-placeholder">
            Neural map — Phase B
          </div>
          <div className="vignette" />
        </div>
        <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Dashboard content — Phase E
          </div>
        </DashboardDrawer>
      </>
    );
  }
  ```

- [ ] **Step 2** — Append placeholder + stage CSS to `/Users/randyjewell/ARIA/client/src/index.css`:
  ```css
  /* ============== STAGE ============== */
  .stage {
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    bottom: 84px;
    overflow: hidden;
    background: #000;
  }
  .neural-map-placeholder {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-mute);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .vignette {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 3;
    background:
      radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%),
      linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35) 100%);
  }
  ```

- [ ] **Step 3** — Replace `/Users/randyjewell/ARIA/client/src/App.jsx` entirely with this slimmer version that preserves voice/WS logic and uses the new shell:
  ```jsx
  import { useState, useEffect, useRef, useCallback } from 'react';
  import { voice } from './Voice.js';
  import { wakeWord } from './WakeWord.js';
  import Setup from './components/Setup.jsx';
  import TopBar from './shell/TopBar.jsx';
  import MicBar from './shell/MicBar.jsx';
  import NavChips from './shell/NavChips.jsx';
  import Console from './pages/Console.jsx';

  const CONFIG_KEY   = 'cofounder_config_v1';
  const ALWAYSON_KEY = 'aria_alwayson';
  const CONVO_KEY    = 'aria_convo_mode';
  const MAX_TTS_CHARS = 850;
  const MRR_TARGET = 16500;

  export default function App() {
    const [config, setConfig] = useState(() => {
      try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; }
    });
    const handleSetup = (cfg) => {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      setConfig(cfg);
    };
    if (!config) return <Setup onComplete={handleSetup} />;
    return <CofounderApp config={config} onReset={() => { localStorage.removeItem(CONFIG_KEY); setConfig(null); }} />;
  }

  function CofounderApp({ config }) {
    // ── State ───────────────────────────────────────────────────────
    const [orbState, setOrbState]           = useState('idle');
    const [messages, setMessages]           = useState([]);
    const [streamingText, setStreamingText] = useState('');
    const [activeToolCall, setActiveToolCall] = useState(null);
    const [alerts, setAlerts]               = useState([]);
    const [metrics, setMetrics]             = useState(null);
    const [clients, setClients]             = useState(null);
    const [wsStatus, setWsStatus]           = useState('connecting');
    const [textInput, setTextInput]         = useState('');
    const [drawerOpen, setDrawerOpen]       = useState(false);
    const [activeRoute, setActiveRoute]     = useState('console');
    const [tokens, setTokens]               = useState(12800);
    const [spend, setSpend]                 = useState(0.42);
    const [latency, setLatency]             = useState(0.74);
    const [convoMode, setConvoMode]         = useState(() => localStorage.getItem(CONVO_KEY) !== '0');
    const [alwaysOn, setAlwaysOn]           = useState(() => localStorage.getItem(ALWAYSON_KEY) === '1');

    // ── Refs ────────────────────────────────────────────────────────
    const wsRef        = useRef(null);
    const alertIdRef   = useRef(0);
    const historyRef   = useRef([]);
    const reconnectRef = useRef(null);
    const alwaysOnRef  = useRef(alwaysOn);
    const convoModeRef = useRef(convoMode);
    const startListeningRef = useRef(null);
    const ttsStreamRef = useRef(null);
    const ttsBufferRef = useRef({ text: '', cursor: 0 });
    const replyStartRef = useRef(0);

    useEffect(() => { alwaysOnRef.current  = alwaysOn;  }, [alwaysOn]);
    useEffect(() => { convoModeRef.current = convoMode; }, [convoMode]);

    // ── Live token/spend simulation (until real metrics wire) ───────
    useEffect(() => {
      const id = setInterval(() => {
        setTokens(t => t + Math.floor(Math.random() * 280));
        setSpend(s => s + Math.random() * 0.004);
      }, 2400);
      return () => clearInterval(id);
    }, []);

    // ── WebSocket ───────────────────────────────────────────────────
    const connectWS = useCallback(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      try {
        const ws = new WebSocket(config.serverUrl);
        wsRef.current = ws;
        setWsStatus('connecting');
        ws.onopen    = () => setWsStatus('open');
        ws.onerror   = () => setWsStatus('error');
        ws.onmessage = (e) => { let m; try { m=JSON.parse(e.data); } catch { return; } handleServerEvent(m); };
        ws.onclose   = () => {
          setWsStatus('closed');
          clearTimeout(reconnectRef.current);
          reconnectRef.current = setTimeout(connectWS, 3000);
        };
      } catch { setWsStatus('error'); }
    }, [config.serverUrl]);

    useEffect(() => {
      connectWS();
      return () => { clearTimeout(reconnectRef.current); wsRef.current?.close(); };
    }, [connectWS]);

    // ── TTS streaming helpers (unchanged from old App.jsx) ──────────
    const SENTENCE_END_RE = /[.!?]+\s/g;
    const ensureTtsStream = () => {
      if (ttsStreamRef.current && !ttsStreamRef.current.aborted) return ttsStreamRef.current;
      setOrbState('speaking');
      ttsStreamRef.current = voice.startStream(config.serverUrl, {
        onEnd: () => returnToBase(),
      });
      ttsBufferRef.current = { text: '', cursor: 0 };
      return ttsStreamRef.current;
    };
    const pushStreamingTokens = (chunk) => {
      if (!chunk) return;
      const stream = ensureTtsStream();
      const buf = ttsBufferRef.current;
      buf.text += chunk;
      SENTENCE_END_RE.lastIndex = buf.cursor;
      let m, lastBoundary = buf.cursor;
      while ((m = SENTENCE_END_RE.exec(buf.text)) !== null) {
        const sentenceEnd = m.index + m[0].length;
        const sentence = buf.text.slice(lastBoundary, sentenceEnd).trim();
        if (sentence) stream.push(sentence);
        lastBoundary = sentenceEnd;
      }
      buf.cursor = lastBoundary;
    };
    const finishStreamingTokens = (fullText) => {
      if (ttsStreamRef.current) {
        const buf = ttsBufferRef.current;
        const total = fullText && fullText.length > buf.text.length ? fullText : buf.text;
        const tail = total.slice(buf.cursor).trim();
        if (tail) ttsStreamRef.current.push(tail);
        ttsStreamRef.current.end();
        ttsStreamRef.current = null;
        ttsBufferRef.current = { text: '', cursor: 0 };
      }
    };
    const speakText = useCallback((text, { onEnd } = {}) => {
      if (!text?.trim()) { onEnd?.(); return; }
      let spoken = text;
      if (text.length > MAX_TTS_CHARS) {
        const breakAt = text.lastIndexOf('. ', MAX_TTS_CHARS);
        spoken = (breakAt > 150 ? text.slice(0, breakAt+1) : text.slice(0, MAX_TTS_CHARS)) + ' Full response is in the chat.';
      }
      voice.speakWithServer(spoken, config.serverUrl, { onEnd });
    }, [config.serverUrl]);

    // ── Server events ───────────────────────────────────────────────
    function handleServerEvent(msg) {
      switch (msg.type) {
        case 'token': {
          const chunk = msg.text || '';
          setStreamingText(prev => prev + chunk);
          pushStreamingTokens(chunk);
          break;
        }
        case 'tool_call':   setActiveToolCall({ name: msg.name, detail: msg.detail || null }); break;
        case 'tool_result': setActiveToolCall(null); break;
        case 'done': {
          const full = msg.text || '';
          setStreamingText(''); setActiveToolCall(null);
          if (replyStartRef.current) {
            const elapsed = (Date.now() - replyStartRef.current) / 1000;
            setLatency(elapsed);
            replyStartRef.current = 0;
          }
          if (full) {
            setMessages(prev => [...prev, { role:'assistant', text: full }]);
            historyRef.current = [...historyRef.current, { role: 'assistant', content: full }];
            if (ttsStreamRef.current) finishStreamingTokens(full);
            else { setOrbState('speaking'); speakText(full, { onEnd: () => returnToBase() }); }
          } else { returnToBase(); }
          break;
        }
        case 'error':
          setStreamingText(''); setActiveToolCall(null);
          returnToBase();
          break;
        case 'metrics': setMetrics(msg.data); break;
        case 'clients': setClients(msg.data); break;
        case 'alert': {
          const id = ++alertIdRef.current;
          setAlerts(prev => [{ ...msg, id, timestamp: Date.now() }, ...prev].slice(0, 8));
          speakText(msg.body);
          break;
        }
      }
    }

    // ── Helpers ─────────────────────────────────────────────────────
    const enterSleeping = useCallback(() => {
      setOrbState('sleeping');
      wakeWord.start(
        (afterText) => handleWake(afterText),
        () => { setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY, '0'); setOrbState('idle'); },
      );
    }, []); // eslint-disable-line

    const returnToBase = useCallback(() => {
      if (convoModeRef.current) { setOrbState('idle'); setTimeout(() => startListeningRef.current?.(), 900); }
      else if (alwaysOnRef.current) { enterSleeping(); }
      else { setOrbState('idle'); }
    }, [enterSleeping]);

    const sendMessage = useCallback((text) => {
      if (!text.trim()) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      setMessages(prev => [...prev, { role: 'user', text }]);
      historyRef.current = [...historyRef.current, { role: 'user', content: text }];
      if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
      replyStartRef.current = Date.now();
      wsRef.current.send(JSON.stringify({
        type: 'chat', text,
        history: historyRef.current.slice(0, -1),
        context: { company: config.company, cofounderName: config.cofounderName, businessDescription: config.businessDescription },
      }));
      setOrbState('thinking');
    }, [config]);

    const handleWake = useCallback((afterText) => {
      setOrbState('idle');
      if (afterText && afterText.length > 3) { setTimeout(() => sendMessage(afterText), 150); }
      else { setTimeout(() => startListening(), 200); }
    }, [sendMessage]); // eslint-disable-line

    const startListening = useCallback(async () => {
      if (!voice.supported) return;
      setOrbState('listening');
      const finalText = await voice.startListening({
        onInterim: () => {},
        onFinal:   () => {},
        onLevel:   () => {},
        onEnd:     () => {},
        onError:   () => {},
      });
      if (finalText.trim()) sendMessage(finalText.trim());
      else returnToBase();
    }, [sendMessage, returnToBase]);

    useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

    const handleMicClick = useCallback(() => {
      if (orbState === 'speaking')  { voice.cancelSpeaking(); returnToBase(); return; }
      if (orbState === 'listening') { voice.stopListening(); returnToBase(); return; }
      if (orbState === 'sleeping')  { wakeWord.stop(); startListening(); return; }
      if (orbState !== 'idle') return;
      startListening();
    }, [orbState, returnToBase, startListening]);

    const handleTextSubmit = useCallback((text) => {
      sendMessage(text);
      setTextInput('');
    }, [sendMessage]);

    // ── Derived ─────────────────────────────────────────────────────
    const currentMrr = metrics?.mrr?.grossMrr ?? metrics?.revenue?.mrr ?? metrics?.currentMrr ?? metrics?.current_mrr ?? 1950;

    // ── Render ──────────────────────────────────────────────────────
    return (
      <>
        <TopBar
          tokens={tokens}
          spend={spend}
          mrr={currentMrr}
          mrrTarget={MRR_TARGET}
          latency={latency}
          presence={orbState}
        />
        <NavChips active={activeRoute} onNav={setActiveRoute} />

        {activeRoute === 'console' && (
          <Console
            drawerOpen={drawerOpen}
            onCloseDrawer={() => setDrawerOpen(false)}
            messages={messages}
            alerts={alerts}
            metrics={metrics}
            clients={clients}
            mrr={currentMrr}
            mrrTarget={MRR_TARGET}
          />
        )}

        <MicBar
          state={orbState}
          latency={latency}
          drawerOpen={drawerOpen}
          textValue={textInput}
          onTextChange={setTextInput}
          onMicClick={handleMicClick}
          onSubmit={handleTextSubmit}
          onToggleDrawer={() => setDrawerOpen(o => !o)}
        />
      </>
    );
  }
  ```

- [ ] **Step 4** — Delete the old orb files and unused HUD components:
  ```bash
  cd /Users/randyjewell/ARIA && rm client/src/components/CosmicOrb.jsx client/src/components/Orb.jsx
  ```

- [ ] **Step 5** — Run `cd /Users/randyjewell/ARIA/client && npm test`. Expected: all existing tests still pass.

- [ ] **Step 6** — Verify dev server boots. In one terminal: `cd /Users/randyjewell/ARIA/server && npm run dev`. In another: `cd /Users/randyjewell/ARIA/client && npm run dev`. Open `http://localhost:5174`. Expected: top bar with brand + 4 pills, nav chips below, mic bar at bottom, black stage with "Neural map — Phase B" text centered. Click `Dashboard ▴` → drawer slides up with "Dashboard content — Phase E". Press ESC → drawer slides down.

- [ ] **Step 7** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add -A && git commit -m "Slim App.jsx to use new shell; add Console page placeholder; remove CosmicOrb"
  ```

---

## Phase B — Neural map static

> ✅ **COMPLETE (2026-06-02).** All 14 tasks (B1–B14) implemented in `client/src/neural-map/`. Build clean, 33/33 tests green, scene verified in browser. Final fix: B11 orbit-drag was bound to the pointer-events:none label layer (dead drag) — rebound to the canvas so manual orbit works; ambient auto-drift + parallax remain default.

Replace the placeholder with the full Three.js scene from `aria-ui-v9-1.html`. Inline mock DATA still — no server fetch yet. Each visual element is its own task. Imports are CDN-free; everything from the `three` package installed in Phase A.

### Task B1 — Mount an empty Three.js scene in React

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/NeuralMap.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/NeuralMap.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [x] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/neural-map/NeuralMap.test.jsx`:
  ```jsx
  import { describe, it, expect, vi } from 'vitest';
  import { render } from '@testing-library/react';
  import NeuralMap from './NeuralMap.jsx';

  // Mock scene.js so jsdom doesn't try to spin up WebGL
  vi.mock('./scene.js', () => ({
    createScene: vi.fn(() => ({ dispose: vi.fn() })),
  }));

  describe('<NeuralMap>', () => {
    it('renders the canvas + label layer + tooltip elements', () => {
      const { container } = render(<NeuralMap data={{ nodes: [], edges: [] }} workStates={{}} />);
      expect(container.querySelector('canvas#neural-canvas')).toBeInTheDocument();
      expect(container.querySelector('#label-layer')).toBeInTheDocument();
      expect(container.querySelector('#neural-tooltip')).toBeInTheDocument();
    });

    it('calls createScene on mount and dispose on unmount', async () => {
      const { createScene } = await import('./scene.js');
      const dispose = vi.fn();
      createScene.mockReturnValueOnce({ dispose });
      const { unmount } = render(<NeuralMap data={{ nodes: [], edges: [] }} workStates={{}} />);
      expect(createScene).toHaveBeenCalledOnce();
      unmount();
      expect(dispose).toHaveBeenCalledOnce();
    });
  });
  ```

- [x] **Step 2** — Run `npm test`. Expected: failure — modules don't exist.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`:
  ```js
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  /**
   * createScene — mounts a Three.js scene into the given hosts.
   * Returns a { dispose() } handle for unmounting.
   *
   * Phase B fills this out element by element. Phase B1 is just a black scene.
   */
  export function createScene({ canvas, labelLayer, tooltip, data, workStates }) {
    const stage = canvas.parentElement;

    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 1.0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000005, 0.018);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 240);
    camera.position.set(0, 0.8, 15.5);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.autoRotate = false;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 24;
    controls.target.set(0, 0, 0);

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    return {
      dispose() {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
      },
    };
  }
  ```

- [x] **Step 4** — Create `/Users/randyjewell/ARIA/client/src/neural-map/NeuralMap.jsx`:
  ```jsx
  import { useEffect, useRef } from 'react';
  import { createScene } from './scene.js';

  export default function NeuralMap({ data, workStates }) {
    const canvasRef = useRef(null);
    const labelLayerRef = useRef(null);
    const tooltipRef = useRef(null);
    const sceneHandleRef = useRef(null);

    useEffect(() => {
      if (!canvasRef.current) return;
      sceneHandleRef.current = createScene({
        canvas: canvasRef.current,
        labelLayer: labelLayerRef.current,
        tooltip: tooltipRef.current,
        data,
        workStates,
      });
      return () => {
        sceneHandleRef.current?.dispose();
        sceneHandleRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Push live work-state changes into the scene without re-mounting
    useEffect(() => {
      sceneHandleRef.current?.setWorkStates?.(workStates);
    }, [workStates]);

    // Push data updates without rebuilding the whole scene
    useEffect(() => {
      sceneHandleRef.current?.setData?.(data);
    }, [data]);

    return (
      <>
        <canvas id="neural-canvas" ref={canvasRef} />
        <div id="label-layer" ref={labelLayerRef} />
        <div id="neural-tooltip" ref={tooltipRef}>
          <div className="label" />
          <div className="detail" />
          <div className="freshness" />
          <div className="bar"><div className="fill" /></div>
        </div>
      </>
    );
  }
  ```

- [x] **Step 5** — Modify `/Users/randyjewell/ARIA/client/src/pages/Console.jsx` to mount NeuralMap with mock data (Phase B uses inline DATA, Phase C swaps in fetch):
  ```jsx
  import NeuralMap from '../neural-map/NeuralMap.jsx';
  import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
  import { MOCK_DATA } from '../neural-map/mockData.js';

  export default function Console({ drawerOpen, onCloseDrawer }) {
    return (
      <>
        <div className="stage" id="stage">
          <NeuralMap data={MOCK_DATA} workStates={{}} />
          <div className="vignette" />
        </div>
        <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Dashboard content — Phase E
          </div>
        </DashboardDrawer>
      </>
    );
  }
  ```

- [x] **Step 6** — Create `/Users/randyjewell/ARIA/client/src/neural-map/mockData.js` (lifted verbatim from `aria-ui-v9-1.html` lines 652–693 — but using **spec-authoritative** sub-agent colors, not the lightened mockup hexes):
  ```js
  export const MOCK_DATA = {
    nodes: [
      { id: 'aria', type: 'hub', label: 'ARIA', color: '#C5FF4D', freshness: 1.0,
        detail: 'Adaptive Reasoning & Intelligent Automation — voice-first cofounder for Jack & Jewell Consulting.' },

      { id: 'scout',    type: 'category', label: 'Scout',    color: '#6BD08F', freshness: 0.92,
        detail: 'Web intelligence. Targeted searches, page fetches, cross-referenced briefings.' },
      { id: 'hunter',   type: 'category', label: 'Hunter',   color: '#E08B5C', freshness: 0.84,
        detail: 'B2B lead generation. Qualifies SMB prospects by funding, tech hiring, modernization.' },
      { id: 'creative', type: 'category', label: 'Creative', color: '#B97FE5', freshness: 0.88,
        detail: 'B2B ad and social copywriter. LinkedIn/Meta/Google/email variations.' },
      { id: 'hermes',   type: 'category', label: 'Hermes',   color: '#E3CC68', freshness: 0.72,
        detail: 'Long-running, memory-backed tasks via Nous Research Hermes CLI.' },
      { id: 'beacon',   type: 'category', label: 'Beacon',   color: '#6FA8DC', freshness: 1.00,
        detail: 'Drafts the 8 AM Morning Brief — actively running right now.' },
      { id: 'verse',    type: 'category', label: 'Verse',    color: '#C078E5', freshness: 0.91,
        detail: "LinkedIn comment reply drafter in Randy's voice. Drafts only." },

      { id: 'wayfinder',   parent: 'scout',    type: 'leaf', label: 'Wayfinder Tech',       freshness: 0.95, detail: 'Local MSP competitor — dropped Starter tier to $399/mo from $750. Possible price-war signal.' },
      { id: 'indy-mkt',    parent: 'scout',    type: 'leaf', label: 'Indy MSP market',      freshness: 0.70, detail: 'Greenwood / South Indianapolis competitive landscape. 12 competitors tracked.' },
      { id: 'msp-pricing', parent: 'scout',    type: 'leaf', label: 'Pricing surveillance', freshness: 0.58, detail: 'Pricing pages monitored across all watched competitors. Snapshots cached.' },
      { id: 'community',   parent: 'scout',    type: 'leaf', label: 'Indy SMB community',   freshness: 0.45, detail: 'Chambers of commerce, BNI groups, local IT forums.' },

      { id: 'bridgepoint', parent: 'hunter',   type: 'leaf', label: 'Bridgepoint Dental',  freshness: 0.95, detail: 'Carmel, 18 users. New ops director hired — 3-month MSP procurement window typical.' },
      { id: 'hedgerow',    parent: 'hunter',   type: 'leaf', label: 'Hedgerow Dental',     freshness: 0.82, detail: 'Inbound, scored 78/100 by Atlas. Likely Standard tier.' },
      { id: 'perf-clinic', parent: 'hunter',   type: 'leaf', label: 'Performance Clinic', freshness: 0.90, detail: 'Discovery call Wednesday Jun 3. Beacon drafting prep brief now.' },
      { id: 'pixel-pools', parent: 'hunter',   type: 'leaf', label: 'Pixel Pools LLC',    freshness: 0.65, detail: 'Proposal sent May 29, no reply. 2 days overdue.' },

      { id: 'li-post-v1', parent: 'creative', type: 'leaf', label: 'LinkedIn post v1',     freshness: 0.86, detail: 'Indy SMB IT topic. Direct tone, ends with question.' },
      { id: 'li-post-v2', parent: 'creative', type: 'leaf', label: 'LinkedIn post v2',     freshness: 0.86, detail: 'Indy SMB IT topic. Story angle, ends with question.' },
      { id: 'li-post-v3', parent: 'creative', type: 'leaf', label: 'LinkedIn post v3',     freshness: 0.86, detail: 'Indy SMB IT topic. Stat-led, ends with question.' },
      { id: 'email-tmpl', parent: 'creative', type: 'leaf', label: 'Cold email templates', freshness: 0.55, detail: 'Four templates for break-fix to retainer conversion.' },

      { id: 'memory-cons', parent: 'hermes',  type: 'leaf', label: 'Memory consolidation', freshness: 0.48, detail: 'Daily memory review job. Runs at 11 PM.' },
      { id: 'snark-tune',  parent: 'hermes',  type: 'leaf', label: 'Voice snark tuning',   freshness: 0.70, detail: "Iterative test runs for ARIA's reply style." },

      { id: 'morning-brief',    parent: 'beacon', type: 'leaf', label: 'Morning brief · DRAFTING', freshness: 1.00, detail: 'MRR + actions + alerts. Currently generating.' },
      { id: 'perf-clinic-prep', parent: 'beacon', type: 'leaf', label: 'Performance Clinic prep', freshness: 0.92, detail: 'Pre-call summary, due Tuesday night.' },
      { id: 'weekly-summary',   parent: 'beacon', type: 'leaf', label: 'Last week summary',       freshness: 0.42, detail: '7-day rollup of MRR delta, leads, intel.' },

      { id: 'li-reply-1', parent: 'verse', type: 'leaf', label: 'LinkedIn reply · "Mark T."',  freshness: 0.96, detail: 'Drafted reply to Mark T. comment on Friday post.' },
      { id: 'li-reply-2', parent: 'verse', type: 'leaf', label: 'LinkedIn reply · "Sarah K."', freshness: 0.96, detail: 'Drafted reply to Sarah K. comment on Friday post.' },
    ],
    edges: [],
  };

  // Auto-derive edges from parent fields
  MOCK_DATA.nodes.forEach(n => {
    if (n.type === 'category') MOCK_DATA.edges.push({ from: 'aria', to: n.id });
    if (n.type === 'leaf')     MOCK_DATA.edges.push({ from: n.parent, to: n.id });
  });
  ```

- [x] **Step 7** — Append the tooltip + label-layer CSS to `/Users/randyjewell/ARIA/client/src/index.css` (copied verbatim from v9-1.html `#neural-tooltip`, `#label-layer`, `.neural-label`):
  ```css
  /* ============== NEURAL CANVAS / LABEL LAYER ============== */
  #neural-canvas { width: 100%; height: 100%; display: block; }
  #label-layer {
    position: absolute; inset: 0;
    pointer-events: none;
    z-index: 4;
    overflow: hidden;
  }
  .neural-label {
    font-family: 'Geist', -apple-system, sans-serif;
    font-size: 11px; font-weight: 500;
    color: rgba(255,255,255,0.78);
    pointer-events: none; user-select: none;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 6px rgba(0,0,0,0.95);
    white-space: nowrap;
    transform: translate(14px, -10px);
  }
  .neural-label.hub {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 13px; font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.32em;
    text-transform: uppercase;
    text-shadow: 0 0 16px rgba(197,255,77,0.65), 0 1px 4px rgba(0,0,0,0.95);
    transform: translate(-50%, -50%);
    padding-left: 0;
  }
  .neural-label.category {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 10.5px; font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.92);
    transform: translate(14px, -8px);
  }
  .neural-label .tick {
    display: inline-block;
    width: 16px; height: 1px;
    background: currentColor;
    opacity: 0.55;
    vertical-align: middle;
    margin-right: 8px;
  }
  .neural-label.hub .tick { display: none; }

  #neural-tooltip {
    display: none;
    position: absolute;
    background: rgba(8,8,12,0.92);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 12px;
    padding: 14px 18px;
    pointer-events: none;
    z-index: 100;
    backdrop-filter: blur(14px);
    min-width: 240px;
    max-width: 340px;
    box-shadow: 0 18px 60px rgba(0,0,0,0.7), 0 0 30px rgba(197,255,77,0.04);
  }
  #neural-tooltip .label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px; font-weight: 600;
    letter-spacing: -0.005em;
    margin-bottom: 8px;
  }
  #neural-tooltip .detail {
    font-family: 'Geist', sans-serif;
    font-size: 12.5px;
    color: rgba(255,255,255,0.72);
    line-height: 1.55;
  }
  #neural-tooltip .freshness {
    font-family: 'Geist Mono', monospace;
    font-size: 9px;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  #neural-tooltip .freshness .lime { color: var(--accent); }
  #neural-tooltip .bar {
    margin-top: 8px;
    height: 2px;
    background: rgba(255,255,255,0.08);
    border-radius: 1px;
    overflow: hidden;
  }
  #neural-tooltip .bar .fill { height: 100%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
  ```

- [x] **Step 8** — Run `npm test`. Expected: NeuralMap tests pass.

- [x] **Step 9** — Boot dev. Expected: black stage (still no scene contents — coming in B2). No console errors. Drag the canvas — OrbitControls swallows the drag (no orbit visible yet because nothing's in the scene, but no errors).

- [x] **Step 10** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/ client/src/pages/Console.jsx client/src/index.css && git commit -m "Mount empty Three.js scene + OrbitControls + ResizeObserver"
  ```

### Task B2 — Extract shaders into separate files

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/noise.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/ariaCore.vert.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/ariaCore.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/ariaShell.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/dendrite.vert.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/dendrite.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/filament.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/pollen.vert.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/pollen.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/mist.vert.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/mist.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/backdrop.frag.glsl.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/shaders/postGrain.frag.glsl.js`

> All shaders are exported as JS template literal strings (`.glsl.js`) so Vite needs no plugin.

**Steps:**

- [x] **Step 1** — Create `noise.glsl.js`:
  ```js
  // Simplex 3D noise — Ashima Arts / Stefan Gustavson
  export const NOISE_GLSL = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_*D.wyz - D.xzx;
      vec4 j = p - 49.0*floor(p*ns.z*ns.z);
      vec4 x_ = floor(j*ns.z);
      vec4 y_ = floor(j - 7.0*x_);
      vec4 x = x_*ns.x + ns.yyyy;
      vec4 y = y_*ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `;
  ```

- [x] **Step 2** — Create `ariaCore.vert.glsl.js`:
  ```js
  import { NOISE_GLSL } from './noise.glsl.js';

  export const ARIA_CORE_VS = /* glsl */`
    uniform float uTime;
    uniform float uPulse;
    varying vec3 vN;
    varying vec3 vW;
    varying float vDisp;
    ${NOISE_GLSL}
    void main() {
      vec3 p = position;
      float t = uTime * 0.32;
      float n1 = snoise(p * 1.3 + vec3(t, t*0.7, -t*0.5));
      float n2 = snoise(p * 2.7 + vec3(-t*0.6, t*1.2, t*0.4)) * 0.5;
      float n3 = snoise(p * 5.5 + vec3(t*1.5, -t, t*0.9))     * 0.22;
      float disp = (n1 + n2 + n3) * (0.16 + uPulse * 0.06);
      vec3 displaced = p + normal * disp;
      vDisp = disp;
      vec4 wp = modelMatrix * vec4(displaced, 1.0);
      vW = wp.xyz;
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  ```

- [x] **Step 3** — Create `ariaCore.frag.glsl.js`:
  ```js
  export const ARIA_CORE_FS = /* glsl */`
    precision highp float;
    uniform float uTime;
    uniform float uPulse;
    uniform vec3  uAccent;
    uniform vec3  uDeep;
    uniform vec3  uIridA;
    uniform vec3  uIridB;
    uniform vec3  uIridC;
    varying vec3  vN;
    varying vec3  vW;
    varying float vDisp;

    vec3 iridescence(float cosT) {
      float a = cosT;
      vec3 col =
        uIridA * pow(1.0 - a, 2.0) +
        uIridB * pow(a * (1.0 - a) * 4.0, 1.2) +
        uIridC * pow(a, 3.0);
      return col;
    }

    void main() {
      vec3 V  = normalize(cameraPosition - vW);
      vec3 N  = normalize(vN);
      float ndv = max(dot(N, V), 0.0);
      float fres = pow(1.0 - ndv, 3.0);
      vec3 irid = iridescence(ndv);
      float breath = 0.55 + 0.45 * sin(uTime * 0.9);
      breath = mix(breath, 1.0, uPulse);
      float bands = smoothstep(-0.10, 0.20, vDisp);
      vec3 core = mix(uDeep, uAccent * 0.18, bands);
      vec3 col = core
               + irid * fres * 0.85
               + uAccent * fres * fres * 0.55 * breath
               + uAccent * smoothstep(0.65, 1.0, ndv) * 0.04;
      col += uAccent * uPulse * 0.20;
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  ```

- [x] **Step 4** — Create `ariaShell.frag.glsl.js`:
  ```js
  export const ARIA_SHELL_VS = /* glsl */`
    varying vec3 vN; varying vec3 vW;
    void main(){
      vN = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  export const ARIA_SHELL_FS = /* glsl */`
    uniform float uTime; uniform vec3 uAccent;
    varying vec3 vN; varying vec3 vW;
    void main(){
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1.0 - max(dot(normalize(vN), V), 0.0), 2.0);
      float pulse = 0.55 + 0.45 * sin(uTime * 0.6);
      vec3 col = uAccent * fres * 0.5 * pulse;
      gl_FragColor = vec4(col, fres * 0.32);
    }
  `;
  ```

- [x] **Step 5** — Create `dendrite.vert.glsl.js`:
  ```js
  export const DENDRITE_VS = /* glsl */`
    varying vec2 vUv;
    varying float vAlong;
    void main() {
      vUv = uv;
      vAlong = uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  ```

- [x] **Step 6** — Create `dendrite.frag.glsl.js`:
  ```js
  export const DENDRITE_FS = /* glsl */`
    precision highp float;
    uniform float uTime;
    uniform float uPulse;
    uniform vec3  uColor;
    uniform float uFreshness;
    varying vec2  vUv;
    varying float vAlong;

    void main(){
      float radial = 1.0 - abs(vUv.y - 0.5) * 2.0;
      radial = pow(radial, 2.0);
      float base = mix(1.10, 0.40, vAlong) * radial;
      float speed = 0.18 + uFreshness * 0.30;
      float p1 = fract(vAlong * 1.0 - uTime * speed);
      float p2 = fract(vAlong * 1.0 - uTime * speed * 0.6 + 0.43);
      float pulse = pow(1.0 - p1, 12.0) + pow(1.0 - p2, 20.0) * 0.7;
      pulse *= radial * (0.65 + uFreshness * 0.7);
      float breath = 0.88 + 0.12 * sin(uTime * 0.9);
      vec3 col = uColor * base * breath + uColor * pulse * 1.5;
      col += uColor * uPulse * 0.45 * radial;
      float alpha = clamp(base * 0.75 + pulse * 1.0, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
    }
  `;
  ```

- [x] **Step 7** — Create `filament.frag.glsl.js`:
  ```js
  export const FILAMENT_VS = /* glsl */`
    varying float vAlong;
    void main(){ vAlong = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  export const FILAMENT_FS = /* glsl */`
    uniform float uTime; uniform float uFreshness; uniform float uPhase;
    uniform vec3 uColor; varying float vAlong;
    void main(){
      float taper = mix(1.0, 0.05, vAlong);
      float shimmer = 0.7 + 0.30 * sin(uTime * (1.4 + uFreshness) + uPhase);
      float tipBoost = smoothstep(0.78, 1.0, vAlong) * 0.7;
      vec3 col = uColor * taper * shimmer + uColor * tipBoost;
      float a = taper * 0.95 + tipBoost * 0.4;
      gl_FragColor = vec4(col, a);
    }
  `;
  ```

- [x] **Step 8** — Create `pollen.vert.glsl.js`:
  ```js
  export const POLLEN_VS = /* glsl */`
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    uniform float uPixelRatio;
    varying vec3 vColor;
    varying float vFlicker;
    void main(){
      vColor = aColor;
      vFlicker = 0.55 + 0.45 * sin(uTime * 1.8 + aPhase * 5.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (1.0 / -mv.z) * 18.0;
    }
  `;
  ```

- [x] **Step 9** — Create `pollen.frag.glsl.js`:
  ```js
  export const POLLEN_FS = /* glsl */`
    varying vec3 vColor;
    varying float vFlicker;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float core  = smoothstep(0.5, 0.0, d);
      float glow  = pow(1.0 - d * 2.0, 2.2);
      vec3 col = vColor * (core * 0.95 + glow * 0.55) * vFlicker;
      float a = (core * 0.9 + glow * 0.6) * vFlicker;
      gl_FragColor = vec4(col, a);
    }
  `;
  ```

- [x] **Step 10** — Create `mist.vert.glsl.js`:
  ```js
  export const MIST_VS = /* glsl */`
    uniform float uTime; uniform float uPixelRatio;
    varying float vF;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (1.0 / -mv.z) * 220.0 * uPixelRatio;
      vF = 0.30 + 0.18 * sin(uTime * 0.6 + position.x * 0.5 + position.z * 0.3);
    }
  `;
  ```

- [x] **Step 11** — Create `mist.frag.glsl.js`:
  ```js
  export const MIST_FS = /* glsl */`
    varying float vF;
    void main(){
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float a = pow(1.0 - d*2.0, 2.0);
      gl_FragColor = vec4(vec3(0.78, 1.0, 0.55) * 0.25 * vF, a * vF * 0.35);
    }
  `;
  ```

- [x] **Step 12** — Create `backdrop.frag.glsl.js`:
  ```js
  import { NOISE_GLSL } from './noise.glsl.js';

  export const BACKDROP_VS = /* glsl */`
    varying vec3 vP;
    void main(){
      vP = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  export const BACKDROP_FS = /* glsl */`
    ${NOISE_GLSL}
    uniform float uTime;
    varying vec3 vP;
    void main(){
      vec3 deep = vec3(0.010, 0.012, 0.028);
      vec3 cool = vec3(0.020, 0.040, 0.085);
      vec3 warm = vec3(0.055, 0.025, 0.060);
      float up   = smoothstep(-0.4, 0.7, vP.y);
      float down = smoothstep( 0.3, -0.8, vP.y);
      vec3 col = deep;
      col = mix(col, cool, up * 0.55);
      col = mix(col, warm, down * 0.42);
      float behind = pow(max(-vP.z, 0.0), 4.0);
      col += vec3(0.18, 0.22, 0.10) * behind * 0.10;
      float n = snoise(vP * 4.0 + vec3(uTime * 0.05));
      col += vec3(n) * 0.006;
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  ```

- [x] **Step 13** — Create `postGrain.frag.glsl.js`:
  ```js
  export const POST_GRAIN_VS = /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  export const POST_GRAIN_FS = /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform vec2  uResolution;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main(){
      vec2 uv = vUv;
      vec2 c  = uv - 0.5;
      float r2 = dot(c, c);
      vec2 dir = normalize(c + 1e-5);
      float strength = uAberration * (0.4 + r2 * 1.6);
      float cr = texture2D(tDiffuse, uv + dir * strength).r;
      float cg = texture2D(tDiffuse, uv).g;
      float cb = texture2D(tDiffuse, uv - dir * strength).b;
      vec3 col = vec3(cr, cg, cb);
      float vig = smoothstep(0.95, 0.20, length(c) * uVignette);
      col *= mix(0.62, 1.0, vig);
      float n = hash(gl_FragCoord.xy + vec2(uTime * 60.0)) - 0.5;
      col += n * uGrain;
      col = col + vec3(0.005, 0.006, 0.012);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  ```

- [x] **Step 14** — Run `npm test`. Expected: no new tests, no regressions.

- [x] **Step 15** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/shaders/ client/src/neural-map/mockData.js && git commit -m "Extract all GLSL shaders into separate .glsl.js files"
  ```

### Task B3 — Build ARIA core (displaced icosphere + iridescent fresnel)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports at the top of `scene.js`:
  ```js
  import { ARIA_CORE_VS } from './shaders/ariaCore.vert.glsl.js';
  import { ARIA_CORE_FS } from './shaders/ariaCore.frag.glsl.js';
  ```

- [x] **Step 2** — After the `controls` block in `createScene`, add the core construction (right before `function resize()`):
  ```js
    // ── ARIA CORE ─────────────────────────────────────────────────
    const coreUniforms = {
      uTime:   { value: 0 },
      uPulse:  { value: 0.0 },
      uAccent: { value: new THREE.Color(0xC5FF4D) },
      uDeep:   { value: new THREE.Color(0x0a0e1a) },
      uIridA:  { value: new THREE.Color(0xC5FF4D) },
      uIridB:  { value: new THREE.Color(0x7AC8FF) },
      uIridC:  { value: new THREE.Color(0xE89FE8) },
    };
    const coreGeom = new THREE.IcosahedronGeometry(1.55, 6);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader:   ARIA_CORE_VS,
      fragmentShader: ARIA_CORE_FS,
      transparent: false,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    const ariaNode = data.nodes.find(n => n.id === 'aria');
    coreMesh.userData = { ...ariaNode, _color: '#C5FF4D' };
    scene.add(coreMesh);
  ```

- [x] **Step 3** — Update the animate loop to drive `uTime` and `uPulse`. Replace the current `function animate()` with:
  ```js
    const clock = new THREE.Clock();
    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      // Soft baseline voice pulse (Phase D wires real speak/listen states)
      const speakEnv = 0.5 + 0.5 * Math.sin(t * 0.45);
      const voicePulse = 0.18 + speakEnv * 0.25;

      coreUniforms.uTime.value  = t;
      coreUniforms.uPulse.value = voicePulse;

      controls.update();
      renderer.render(scene, camera);
    }
    animate();
  ```

- [x] **Step 4** — Boot dev. Open `http://localhost:5174`. Expected: visible displaced icosphere at center, breathing/iridescent. Drag camera — sphere stays at origin, view rotates around it. No console errors.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add ARIA core: displaced icosphere with iridescent fresnel shader"
  ```

### Task B4 — Add ARIA shell + ember + wireframe halos

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports:
  ```js
  import { ARIA_SHELL_VS, ARIA_SHELL_FS } from './shaders/ariaShell.frag.glsl.js';
  ```

- [x] **Step 2** — After the core block, add:
  ```js
    // ── OUTER SHELL ───────────────────────────────────────────────
    const shellMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAccent: { value: new THREE.Color(0xC5FF4D) } },
      vertexShader: ARIA_SHELL_VS,
      fragmentShader: ARIA_SHELL_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const shellMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.05, 3), shellMat);
    scene.add(shellMesh);

    // ── INNER EMBER ───────────────────────────────────────────────
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xC5FF4D, transparent: true, opacity: 0.92 });
    const emberMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), emberMat);
    scene.add(emberMesh);

    // ── WIREFRAME HALOS (constructed/scientific gravitas) ─────────
    const ariaWireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.72, 2)),
      new THREE.LineBasicMaterial({
        color: 0xC5FF4D, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(ariaWireframe);
    const ariaWireframe2 = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.55, 1)),
      new THREE.LineBasicMaterial({
        color: 0xC5FF4D, transparent: true, opacity: 0.09,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(ariaWireframe2);
  ```

- [x] **Step 3** — In `animate()`, after `coreUniforms.uPulse.value = voicePulse;`, add:
  ```js
      shellMat.uniforms.uTime.value = t;
      emberMesh.scale.setScalar(1.0 + Math.sin(t * 2.3) * 0.08 + voicePulse * 0.15);
      ariaWireframe.rotation.y  =  t * 0.10;
      ariaWireframe.rotation.x  = Math.sin(t * 0.15) * 0.15;
      ariaWireframe2.rotation.y = -t * 0.06;
      ariaWireframe2.rotation.z = Math.cos(t * 0.10) * 0.12;
  ```

- [x] **Step 4** — Boot dev. Expected: lime ember inside the iridescent core, faint translucent outer shell pulsing, two counter-rotating wireframe halos.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add ARIA outer shell, inner ember, two counter-rotating wireframe halos"
  ```

### Task B5 — Compute category positions on irregular sphere

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — After the wireframe block, add (positions are deterministic, no Math.random for these):
  ```js
    // ── CATEGORY POSITIONS (irregular sphere, not a flat ring) ────
    const cats = data.nodes.filter(n => n.type === 'category');
    const CAT_R = 4.7;
    const catDirs = {};
    const phiOffsets   = [0.30, -0.55, 0.18, -0.20, 0.65, -0.35];
    const thetaOffsets = [0.00,  1.05, 2.10,  3.10, 4.05,  5.10];
    cats.forEach((n, i) => {
      const theta = thetaOffsets[i % thetaOffsets.length] + 0.18;
      const phi   = phiOffsets[i % phiOffsets.length];
      const v = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi),
        Math.sin(phi),
        Math.sin(theta) * Math.cos(phi),
      ).normalize();
      catDirs[n.id] = v.clone();
    });
    const nodePositions = { aria: new THREE.Vector3(0, 0, 0) };
    cats.forEach((n) => {
      nodePositions[n.id] = catDirs[n.id].clone().multiplyScalar(CAT_R);
    });
  ```

- [x] **Step 2** — Boot dev. Expected: no visual change yet — positions used in B6+.

- [x] **Step 3** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Compute category positions on irregular sphere"
  ```

### Task B6 — Add dendrites (hub → category curved tubes with traveling pulses)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports:
  ```js
  import { DENDRITE_VS } from './shaders/dendrite.vert.glsl.js';
  import { DENDRITE_FS } from './shaders/dendrite.frag.glsl.js';
  ```

- [x] **Step 2** — After the category-positions block, add:
  ```js
    // ── DENDRITES ─────────────────────────────────────────────────
    const dendriteUniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };

    function makeDendriteMaterial(color, freshness) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTime:      dendriteUniforms.uTime,
          uPulse:     dendriteUniforms.uPulse,
          uColor:     { value: new THREE.Color(color) },
          uFreshness: { value: freshness },
        },
        vertexShader:   DENDRITE_VS,
        fragmentShader: DENDRITE_FS,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }

    const dendrites = [];
    cats.forEach((cat) => {
      const dir   = catDirs[cat.id].clone();
      const start = dir.clone().multiplyScalar(0.95);
      const end   = nodePositions[cat.id].clone();
      const perp1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      if (perp1.lengthSq() < 0.01) perp1.set(1, 0, 0);
      const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      // Deterministic-ish curve seed from category id length so dendrites differ but stay stable
      const seed  = (cat.id.length * 13 + cat.id.charCodeAt(0)) % 100 / 100;
      const swirl = (seed - 0.5) * 1.6;
      const flex  = 0.6 + seed * 0.5;
      const ctrl1 = start.clone().lerp(end, 0.30)
        .add(perp1.clone().multiplyScalar(swirl * 0.45))
        .add(perp2.clone().multiplyScalar(flex * 0.35));
      const ctrl2 = start.clone().lerp(end, 0.70)
        .add(perp1.clone().multiplyScalar(-swirl * 0.50))
        .add(perp2.clone().multiplyScalar(-flex * 0.20));
      const curve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);

      const tubeGeom = new THREE.TubeGeometry(curve, 120, 0.062, 10, false);
      const positions = tubeGeom.attributes.position;
      const uvs       = tubeGeom.attributes.uv;
      const taperOf = (u) => 1.0 - Math.pow(u, 1.5) * 0.62;
      for (let i = 0; i < positions.count; i++) {
        const u  = uvs.getX(i);
        const cx = curve.getPointAt(u);
        const px = positions.getX(i), py = positions.getY(i), pz = positions.getZ(i);
        const ox = px - cx.x, oy = py - cx.y, oz = pz - cx.z;
        const tt = taperOf(u);
        positions.setXYZ(i, cx.x + ox * tt, cx.y + oy * tt, cx.z + oz * tt);
      }
      positions.needsUpdate = true;
      tubeGeom.computeBoundingSphere();

      const mat  = makeDendriteMaterial(cat.color, cat.freshness);
      const mesh = new THREE.Mesh(tubeGeom, mat);
      scene.add(mesh);
      dendrites.push({ curve, mesh, fromId: 'aria', toId: cat.id, color: cat.color, freshness: cat.freshness });
    });
  ```

- [x] **Step 3** — In `animate()`, after the wireframe rotations, add:
  ```js
      dendriteUniforms.uTime.value  = t;
      dendriteUniforms.uPulse.value = voicePulse;
  ```

- [x] **Step 4** — Boot dev. Expected: six curving tapered tubes emanating from ARIA, each in its sub-agent color, with energy pulses traveling outward along them.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add 6 dendrites: cubic Bezier tubes with tapered radius + traveling pulses"
  ```

### Task B7 — Growth tips (anemone-like filament bursts)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports:
  ```js
  import { FILAMENT_VS, FILAMENT_FS } from './shaders/filament.frag.glsl.js';
  ```

- [x] **Step 2** — After the dendrites block, add:
  ```js
    // ── GROWTH TIPS (anemone filaments) ───────────────────────────
    const growthTips = {};
    cats.forEach((cat, ci) => {
      const pos = nodePositions[cat.id];
      const group = new THREE.Group();
      group.position.copy(pos);
      scene.add(group);

      const outward = pos.clone().normalize();
      group.lookAt(group.position.clone().add(outward));

      // hot core sphere
      const coreSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(cat.color), transparent: true, opacity: 0.95 })
      );
      coreSphere.userData = { ...cat, _color: cat.color };
      group.add(coreSphere);

      // halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 20, 20),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(cat.color), transparent: true, opacity: 0.16,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      group.add(halo);

      // 14 filaments — deterministic per-cat per-filament seed
      const filaments = [];
      const FIL_COUNT = 14;
      for (let i = 0; i < FIL_COUNT; i++) {
        const seedA = ((ci * 73 + i * 17) % 100) / 100;
        const seedB = ((ci * 41 + i * 29) % 100) / 100;
        const seedC = ((ci * 13 + i *  7) % 100) / 100;
        const u = i / FIL_COUNT;
        const theta = u * Math.PI * 2 + seedA * 0.6;
        const phi   = (seedB - 0.5) * 1.2;
        const tipDir = new THREE.Vector3(
          Math.cos(theta) * Math.cos(phi),
          Math.sin(phi),
          Math.abs(Math.sin(theta)) * 0.4 + 0.25,
        ).normalize();
        const len    = 0.32 + seedC * 0.35;
        const startF = new THREE.Vector3(0, 0, 0);
        const tipF   = tipDir.clone().multiplyScalar(len);
        const ctrlF  = startF.clone().lerp(tipF, 0.5).add(new THREE.Vector3(
          (seedA - 0.5) * 0.12,
          (seedB - 0.5) * 0.12,
          (seedC - 0.5) * 0.12,
        ));
        const curveF = new THREE.QuadraticBezierCurve3(startF, ctrlF, tipF);
        const fGeom  = new THREE.TubeGeometry(curveF, 20, 0.014, 10, false);
        const fMat   = new THREE.ShaderMaterial({
          uniforms: {
            uTime:      dendriteUniforms.uTime,
            uColor:     { value: new THREE.Color(cat.color) },
            uFreshness: { value: cat.freshness },
            uPhase:     { value: seedA * Math.PI * 2 },
          },
          vertexShader:   FILAMENT_VS,
          fragmentShader: FILAMENT_FS,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const filMesh = new THREE.Mesh(fGeom, fMat);
        group.add(filMesh);

        // tip ember at each filament end
        const fTip = new THREE.Mesh(
          new THREE.SphereGeometry(0.026, 12, 12),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(cat.color), transparent: true, opacity: 0.95,
            blending: THREE.AdditiveBlending, depthWrite: false,
          })
        );
        fTip.position.copy(tipF);
        group.add(fTip);
        filaments.push({ mesh: filMesh, tip: fTip, baseLen: len, dir: tipDir });
      }

      growthTips[cat.id] = { group, coreSphere, halo, filaments, color: cat.color, data: cat };
    });
  ```

- [x] **Step 3** — Boot dev. Expected: six anemone-like radial bursts of filaments at the dendrite tips, each in its sub-agent color, with shimmering tip embers.

- [x] **Step 4** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add growth tips: 14 anemone filaments + tip embers per category"
  ```

### Task B8 — Work-state machine + leash lines

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/workStates.js`
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/workStates.test.js`
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/neural-map/workStates.test.js`:
  ```js
  import { describe, it, expect } from 'vitest';
  import * as THREE from 'three';
  import { computeFloatOffset, advanceState } from './workStates.js';

  describe('computeFloatOffset', () => {
    it('returns zero vector for idle', () => {
      const v = computeFloatOffset({ state: 'idle', stateStartTime: 0 }, 5.0);
      expect(v.length()).toBe(0);
    });
    it('returns a Lissajous offset when working with radius ~1.7', () => {
      const v = computeFloatOffset({ state: 'working', stateStartTime: 0 }, 1.0);
      expect(v.length()).toBeGreaterThan(0.2);
      expect(v.length()).toBeLessThan(2.0);
    });
    it('eases the offset back to zero over 1.6s when returning', () => {
      const ws = { state: 'returning', stateStartTime: 0, floatStartOffset: new THREE.Vector3(1.0, 0, 0) };
      const v0 = computeFloatOffset(ws, 0);
      const v1 = computeFloatOffset(ws, 1.6);
      expect(v0.x).toBeCloseTo(1.0, 5);
      expect(v1.x).toBeCloseTo(0.0, 5);
    });
  });

  describe('advanceState', () => {
    it('transitions working → returning after 8s', () => {
      const ws = { state: 'working', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
      advanceState(ws, 9.0, /* slug */ 'scout');
      expect(ws.state).toBe('returning');
      expect(ws.stateStartTime).toBe(9.0);
    });
    it('transitions returning → idle after 1.6s', () => {
      const ws = { state: 'returning', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
      advanceState(ws, 1.7, 'scout');
      expect(ws.state).toBe('idle');
    });
    it('beacon re-triggers working after 2s idle (demo behavior)', () => {
      const ws = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
      advanceState(ws, 2.1, 'beacon');
      expect(ws.state).toBe('working');
    });
    it('non-beacon slugs do NOT auto-trigger working from idle', () => {
      const ws = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
      advanceState(ws, 100, 'scout');
      expect(ws.state).toBe('idle');
    });
  });
  ```

- [x] **Step 2** — Run `npm test`. Expected: failure — module doesn't exist.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/neural-map/workStates.js`:
  ```js
  import * as THREE from 'three';

  export function createInitialWorkStates(catSlugs) {
    const out = {};
    catSlugs.forEach(slug => {
      out[slug] = { state: 'idle', stateStartTime: 0, floatStartOffset: new THREE.Vector3() };
    });
    // Demo: Beacon kicks off in working state so user sees the float behavior immediately
    if (out['beacon']) out['beacon'].state = 'working';
    return out;
  }

  /**
   * Lissajous orbit when working; cubic ease-out back to anchor when returning.
   */
  export function computeFloatOffset(ws, tSince) {
    const out = new THREE.Vector3();
    if (ws.state === 'working') {
      const r = 1.7;
      out.set(
        Math.sin(tSince * 0.65)       * r * 0.80,
        Math.cos(tSince * 0.75 + 1.2) * r * 0.55,
        Math.sin(tSince * 0.45 + 2.4) * r * 0.70,
      );
    } else if (ws.state === 'returning') {
      const k = Math.min(1, tSince / 1.6);
      const eased = 1 - Math.pow(1 - k, 3);
      out.copy(ws.floatStartOffset).multiplyScalar(1 - eased);
    }
    return out;
  }

  /**
   * Advances a state machine based on elapsed time. Mutates ws.
   * Demo: 'beacon' auto-cycles working ↔ idle so user sees the animation.
   * Phase D: real WebSocket events drive state transitions.
   */
  export function advanceState(ws, tNow, slug) {
    const tSince = tNow - ws.stateStartTime;
    if (ws.state === 'working' && tSince > 8) {
      ws.floatStartOffset.copy(computeFloatOffset(ws, tSince));
      ws.state = 'returning';
      ws.stateStartTime = tNow;
    } else if (ws.state === 'returning' && tSince > 1.6) {
      ws.state = 'idle';
      ws.stateStartTime = tNow;
    } else if (ws.state === 'idle' && slug === 'beacon' && tSince > 2) {
      ws.state = 'working';
      ws.stateStartTime = tNow;
    }
  }
  ```

- [x] **Step 4** — Run `npm test`. Expected: all workStates tests pass.

- [x] **Step 5** — In `scene.js`, add import:
  ```js
  import { createInitialWorkStates, computeFloatOffset, advanceState } from './workStates.js';
  ```

- [x] **Step 6** — After the growth-tips block, add:
  ```js
    // ── WORK STATES + LEASH LINES ────────────────────────────────
    let workStates = createInitialWorkStates(cats.map(c => c.id));
    const leashes = {};
    cats.forEach(cat => {
      const lGeom = new THREE.BufferGeometry();
      lGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 3), 3));
      const line = new THREE.Line(lGeom, new THREE.LineBasicMaterial({
        color: new THREE.Color(cat.color),
        transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      scene.add(line);
      leashes[cat.id] = line;
    });

    const lastTipPositions = {};
    cats.forEach(c => { lastTipPositions[c.id] = nodePositions[c.id].clone(); });
  ```

- [x] **Step 7** — In `animate()`, after the dendrite uniform updates, add the per-category tip update loop:
  ```js
      cats.forEach((cat, i) => {
        const tip  = growthTips[cat.id];
        const base = nodePositions[cat.id];
        const dx = Math.sin(t * 0.42 + i * 1.7) * 0.08;
        const dy = Math.cos(t * 0.35 + i * 2.1) * 0.06;
        const dz = Math.sin(t * 0.30 + i * 0.9) * 0.07;
        const anchor = base.clone().add(new THREE.Vector3(dx, dy, dz));

        const ws = workStates[cat.id];
        advanceState(ws, t, cat.id);
        const tSince = t - ws.stateStartTime;
        const floatOffset = computeFloatOffset(ws, tSince);
        const np = anchor.clone().add(floatOffset);
        tip.group.position.copy(np);

        const outwardBase = base.clone().normalize();
        const lookTarget = np.clone().add(outwardBase);
        tip.group.lookAt(lookTarget);
        tip.group.rotateZ(t * 0.05 + i * 0.3);

        const haloPulse = ws.state === 'working'
          ? 1.0 + Math.sin(t * 3.2 + i) * 0.18
          : 1.0 + Math.sin(t * 1.1 + i) * 0.07;
        tip.halo.scale.setScalar(haloPulse);
        tip.coreSphere.material.opacity = 0.7 + cat.freshness * 0.25 + voicePulse * 0.05 + (ws.state === 'working' ? 0.1 : 0);

        const leash = leashes[cat.id];
        const lpos = leash.geometry.attributes.position.array;
        lpos[0] = anchor.x; lpos[1] = anchor.y; lpos[2] = anchor.z;
        lpos[3] = np.x;     lpos[4] = np.y;     lpos[5] = np.z;
        leash.geometry.attributes.position.needsUpdate = true;
        if (ws.state === 'working') {
          leash.material.opacity = 0.32 + 0.28 * Math.abs(Math.sin(t * 5));
        } else if (ws.state === 'returning') {
          leash.material.opacity = 0.45 * (1 - Math.min(1, tSince / 1.6));
        } else {
          leash.material.opacity = 0;
        }
        lastTipPositions[cat.id] = np;
      });
  ```

- [x] **Step 8** — Add a `setWorkStates` method to the returned handle (so Phase D can push real states without rebuilding the scene):
  ```js
    return {
      setWorkStates(next) {
        Object.keys(next).forEach(slug => {
          if (!workStates[slug]) return;
          const incomingState = next[slug].state;
          if (incomingState && incomingState !== workStates[slug].state) {
            if (incomingState === 'returning') {
              const tSince = clock.getElapsedTime() - workStates[slug].stateStartTime;
              workStates[slug].floatStartOffset.copy(computeFloatOffset(workStates[slug], tSince));
            }
            workStates[slug].state = incomingState;
            workStates[slug].stateStartTime = clock.getElapsedTime();
          }
        });
      },
      dispose() {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
      },
    };
  ```

- [x] **Step 9** — Boot dev. Expected: gentle bob on all categories; Beacon detaches, orbits ARIA in a Lissajous path, leash line pulses, returns home after 8s, sits 2s, repeats.

- [x] **Step 10** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/workStates.js client/src/neural-map/workStates.test.js client/src/neural-map/scene.js && git commit -m "Add work-state machine + Lissajous float + pulsing leash lines"
  ```

### Task B9 — Pollen cloud (per-leaf bioluminescent particles)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports:
  ```js
  import { POLLEN_VS } from './shaders/pollen.vert.glsl.js';
  import { POLLEN_FS } from './shaders/pollen.frag.glsl.js';
  ```

- [x] **Step 2** — After the work-states block, add:
  ```js
    // ── POLLEN (leaf particles) ──────────────────────────────────
    const POLLEN_PER_CAT = 90;
    const totalPollen = cats.length * POLLEN_PER_CAT;
    const pollenPos    = new Float32Array(totalPollen * 3);
    const pollenColor  = new Float32Array(totalPollen * 3);
    const pollenSize   = new Float32Array(totalPollen);
    const pollenPhase  = new Float32Array(totalPollen);
    const pollenRadius = new Float32Array(totalPollen);
    const pollenTheta  = new Float32Array(totalPollen);
    const pollenPhi    = new Float32Array(totalPollen);
    const pollenSpeed  = new Float32Array(totalPollen);

    const leafNodes = data.nodes.filter(n => n.type === 'leaf');
    const leafToPollenIndex = {};

    cats.forEach((cat, ci) => {
      const pos = nodePositions[cat.id];
      const col = new THREE.Color(cat.color);
      const leaves = leafNodes.filter(l => l.parent === cat.id);
      for (let i = 0; i < POLLEN_PER_CAT; i++) {
        const gi = ci * POLLEN_PER_CAT + i;
        if (i < leaves.length) leafToPollenIndex[leaves[i].id] = gi;
        const seed = ((ci * 47 + i * 31) % 1000) / 1000;
        const seedB = ((ci * 53 + i * 23) % 1000) / 1000;
        const seedC = ((ci * 19 + i * 11) % 1000) / 1000;
        const r  = 0.45 + seed * 0.95;
        const th = seedB * Math.PI * 2;
        const ph = (seedC - 0.5) * Math.PI * 0.85;
        pollenPos[gi*3]   = pos.x + Math.cos(th) * Math.cos(ph) * r;
        pollenPos[gi*3+1] = pos.y + Math.sin(ph) * r;
        pollenPos[gi*3+2] = pos.z + Math.sin(th) * Math.cos(ph) * r;
        pollenColor[gi*3]   = col.r;
        pollenColor[gi*3+1] = col.g;
        pollenColor[gi*3+2] = col.b;
        pollenSize[gi]   = 6.0 + seed * 7.0;
        pollenPhase[gi]  = seedB * Math.PI * 2;
        pollenRadius[gi] = r;
        pollenTheta[gi]  = th;
        pollenPhi[gi]    = ph;
        pollenSpeed[gi]  = 0.20 + seedC * 0.45;
      }
    });

    const pollenGeom = new THREE.BufferGeometry();
    pollenGeom.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
    pollenGeom.setAttribute('aColor',   new THREE.BufferAttribute(pollenColor, 3));
    pollenGeom.setAttribute('aSize',    new THREE.BufferAttribute(pollenSize, 1));
    pollenGeom.setAttribute('aPhase',   new THREE.BufferAttribute(pollenPhase, 1));

    const pollenMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader:   POLLEN_VS,
      fragmentShader: POLLEN_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pollen = new THREE.Points(pollenGeom, pollenMat);
    scene.add(pollen);
  ```

- [x] **Step 3** — In `animate()`, after the cats forEach, add:
  ```js
      const arr = pollenGeom.attributes.position.array;
      for (let ci = 0; ci < cats.length; ci++) {
        const cat = cats[ci];
        const tipPos = lastTipPositions[cat.id];
        for (let i = 0; i < POLLEN_PER_CAT; i++) {
          const gi = ci * POLLEN_PER_CAT + i;
          const speed = pollenSpeed[gi];
          pollenTheta[gi] += 0.0025 * speed;
          pollenPhi[gi]   += Math.sin(t * 0.5 + pollenPhase[gi]) * 0.0006;
          const r  = pollenRadius[gi] + Math.sin(t * (0.8 + speed) + pollenPhase[gi]) * 0.07;
          const th = pollenTheta[gi];
          const ph = pollenPhi[gi];
          arr[gi*3]   = tipPos.x + Math.cos(th) * Math.cos(ph) * r;
          arr[gi*3+1] = tipPos.y + Math.sin(ph) * r;
          arr[gi*3+2] = tipPos.z + Math.sin(th) * Math.cos(ph) * r;
        }
      }
      pollenGeom.attributes.position.needsUpdate = true;
      pollenMat.uniforms.uTime.value = t;
  ```

- [x] **Step 4** — Boot dev. Expected: swarming colored particles around each growth tip, color matches parent sub-agent.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add pollen: 540-particle THREE.Points cloud with curl-noise drift"
  ```

### Task B10 — Atmosphere (mist + backdrop nebula + starfield)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports:
  ```js
  import { MIST_VS } from './shaders/mist.vert.glsl.js';
  import { MIST_FS } from './shaders/mist.frag.glsl.js';
  import { BACKDROP_VS, BACKDROP_FS } from './shaders/backdrop.frag.glsl.js';
  ```

- [x] **Step 2** — After the pollen block, add the mist:
  ```js
    // ── MIST (ambient atmospheric drift) ─────────────────────────
    const MIST_N = 220;
    const mistGeom = new THREE.BufferGeometry();
    const mistPos  = new Float32Array(MIST_N * 3);
    const mistVel  = [];
    for (let i = 0; i < MIST_N; i++) {
      const seedA = ((i * 71) % 1000) / 1000;
      const seedB = ((i * 53) % 1000) / 1000;
      const seedC = ((i * 37) % 1000) / 1000;
      const r  = 10 + seedA * 24;
      const th = seedB * Math.PI * 2;
      const ph = Math.acos(2 * seedC - 1);
      mistPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      mistPos[i*3+1] = r * Math.cos(ph) * 0.55;
      mistPos[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      mistVel.push([
        ((((i * 7) % 100) / 100) - 0.5) * 0.004,
        ((((i * 13) % 100) / 100) - 0.5) * 0.0025,
        ((((i * 17) % 100) / 100) - 0.5) * 0.004,
      ]);
    }
    mistGeom.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    const mistMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader:   MIST_VS,
      fragmentShader: MIST_FS,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    scene.add(new THREE.Points(mistGeom, mistMat));

    // ── NEBULA BACKDROP (inside-out sphere) ──────────────────────
    const backdropMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader:   BACKDROP_VS,
      fragmentShader: BACKDROP_FS,
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(85, 32, 32), backdropMat));

    // ── STARFIELD (1600 distant points) ──────────────────────────
    {
      const N = 1600;
      const g = new THREE.BufferGeometry();
      const a = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const seedA = ((i * 91) % 1000) / 1000;
        const seedB = ((i * 67) % 1000) / 1000;
        const seedC = ((i * 41) % 1000) / 1000;
        const r  = 45 + seedA * 55;
        const th = seedB * Math.PI * 2;
        const ph = Math.acos(2 * seedC - 1);
        a[i*3]   = r * Math.sin(ph) * Math.cos(th);
        a[i*3+1] = r * Math.cos(ph);
        a[i*3+2] = r * Math.sin(ph) * Math.sin(th);
      }
      g.setAttribute('position', new THREE.BufferAttribute(a, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.8,
      })));
    }
  ```

- [x] **Step 3** — In `animate()`, after pollen update, add:
  ```js
      const ma = mistGeom.attributes.position.array;
      for (let i = 0; i < MIST_N; i++) {
        const v = mistVel[i];
        ma[i*3] += v[0]; ma[i*3+1] += v[1]; ma[i*3+2] += v[2];
        const R = 30;
        if (ma[i*3]   >  R)     ma[i*3]   = -R; if (ma[i*3]   < -R)     ma[i*3]   =  R;
        if (ma[i*3+1] >  R*0.7) ma[i*3+1] = -R*0.7; if (ma[i*3+1] < -R*0.7) ma[i*3+1] = R*0.7;
        if (ma[i*3+2] >  R)     ma[i*3+2] = -R; if (ma[i*3+2] < -R)     ma[i*3+2] =  R;
      }
      mistGeom.attributes.position.needsUpdate = true;
      mistMat.uniforms.uTime.value     = t;
      backdropMat.uniforms.uTime.value = t;
  ```

- [x] **Step 4** — Boot dev. Expected: deep purple → blue nebula behind everything, sparse white stars far back, gentle lime mist drifting through midground.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add atmosphere: mist drift + backdrop nebula + starfield"
  ```

### Task B11 — Camera choreography (Bezier drift + breathing FOV + parallax)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — After the starfield block, add:
  ```js
    // ── CAMERA CHOREOGRAPHY ──────────────────────────────────────
    const parallaxTarget = new THREE.Vector2(0, 0);
    const onMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth)  * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      parallaxTarget.set(x * 0.45, -y * 0.30);
    };
    window.addEventListener('mousemove', onMouseMove);

    let dragging = false;
    controls.addEventListener('start', () => { dragging = true; });
    controls.addEventListener('end',   () => { setTimeout(() => { dragging = false; }, 1800); });
  ```

- [x] **Step 2** — In `animate()`, before `controls.update();`, add:
  ```js
      const ox = Math.sin(t * 0.06) * 2.2 + Math.sin(t * 0.025) * 0.8;
      const oy = Math.sin(t * 0.05 + 1.0) * 0.55;
      const oz = Math.cos(t * 0.06) * 1.0 + Math.cos(t * 0.022) * 0.6;
      const desired = new THREE.Vector3(ox, 0.8 + oy, 15.5 + oz);
      desired.x += parallaxTarget.x * 0.8;
      desired.y += parallaxTarget.y * 0.5;
      if (!dragging) camera.position.lerp(desired, 0.012);
      camera.fov = 42 + Math.sin(t * 0.22) * 0.9;
      camera.updateProjectionMatrix();
  ```

- [x] **Step 3** — Update `dispose()` to remove the mousemove listener:
  ```js
      dispose() {
        cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove', onMouseMove);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
      },
  ```

- [x] **Step 4** — Boot dev. Expected: camera drifts in a slow figure-eight; FOV breathes; moving the mouse subtly shifts the view. Click-drag overrides — when released, drift resumes after ~1.8s.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add camera choreography: Bezier drift, breathing FOV, mouse parallax"
  ```

### Task B12 — Post-processing chain (bloom + chromatic aberration + vignette + grain)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add imports at the top:
  ```js
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
  import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import { POST_GRAIN_VS, POST_GRAIN_FS } from './shaders/postGrain.frag.glsl.js';
  ```

- [x] **Step 2** — After the camera-choreography block, add:
  ```js
    // ── POST-PROCESSING ──────────────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(stage.clientWidth, stage.clientHeight),
      0.78,   // strength
      0.72,   // radius
      0.15    // threshold
    );
    composer.addPass(bloom);
    const finalPass = new ShaderPass({
      uniforms: {
        tDiffuse:    { value: null },
        uTime:       { value: 0 },
        uAberration: { value: 0.0028 },
        uVignette:   { value: 1.10 },
        uGrain:      { value: 0.040 },
        uResolution: { value: new THREE.Vector2(stage.clientWidth, stage.clientHeight) },
      },
      vertexShader:   POST_GRAIN_VS,
      fragmentShader: POST_GRAIN_FS,
    });
    composer.addPass(finalPass);
    composer.addPass(new OutputPass());
  ```

- [x] **Step 3** — Update `resize()`:
  ```js
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      composer.setSize(w, h);
      bloom.setSize(w, h);
      finalPass.uniforms.uResolution.value.set(w, h);
      pollenMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      mistMat.uniforms.uPixelRatio.value   = renderer.getPixelRatio();
    }
  ```

- [x] **Step 4** — In `animate()`, replace `renderer.render(scene, camera);` with:
  ```js
      finalPass.uniforms.uTime.value = t;
      composer.render();
  ```

- [x] **Step 5** — Boot dev. Expected: bright elements bloom (ARIA core, embers, filament tips), slight chromatic aberration toward screen edges, gentle vignette, subtle film grain.

- [x] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add post-processing: UnrealBloom + chromatic aberration + vignette + grain"
  ```

### Task B13 — Hover tooltip (raycaster + DOM)

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/neural-map/tooltip.js`
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Create `/Users/randyjewell/ARIA/client/src/neural-map/tooltip.js`:
  ```js
  import * as THREE from 'three';

  /**
   * Drives the hover tooltip. Returns { update(), dispose() }.
   * Mesh hits → exact userData lookup.
   * Leaf pollen hits → screen-space proximity fallback.
   */
  export function createTooltip({ stage, tooltip, camera, hoverables, pollenGeom, leafNodes, leafToPollenIndex, dataNodesById }) {
    const raycaster = new THREE.Raycaster();
    const ndcMouse = new THREE.Vector2();
    let mouseClient = { x: 0, y: 0 };
    let pointerActive = false;

    const onMove = (e) => {
      pointerActive = true;
      const rect = stage.getBoundingClientRect();
      mouseClient.x = e.clientX - rect.left;
      mouseClient.y = e.clientY - rect.top;
      ndcMouse.x = (mouseClient.x / rect.width) * 2 - 1;
      ndcMouse.y = -(mouseClient.y / rect.height) * 2 + 1;
    };
    const onLeave = () => {
      pointerActive = false;
      tooltip.style.display = 'none';
    };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);

    function update() {
      if (!pointerActive) { tooltip.style.display = 'none'; return; }
      raycaster.setFromCamera(ndcMouse, camera);
      const hits = raycaster.intersectObjects(hoverables, false);
      let d = null;
      if (hits.length) {
        d = hits[0].object.userData;
      } else {
        // screen-space proximity for leaves
        let best = null, bestDist = 22;
        const arr = pollenGeom.attributes.position.array;
        for (const lf of leafNodes) {
          const gi = leafToPollenIndex[lf.id];
          if (gi == null) continue;
          const v = new THREE.Vector3(arr[gi*3], arr[gi*3+1], arr[gi*3+2]);
          v.project(camera);
          const sx = (v.x * 0.5 + 0.5) * stage.clientWidth;
          const sy = (-v.y * 0.5 + 0.5) * stage.clientHeight;
          const dx = sx - mouseClient.x, dy = sy - mouseClient.y;
          const dd = Math.sqrt(dx*dx + dy*dy);
          if (dd < bestDist) { bestDist = dd; best = lf; }
        }
        if (best) {
          const parent = dataNodesById[best.parent];
          d = { ...best, _color: parent?.color || '#fff' };
        }
      }
      if (d) {
        tooltip.style.display = 'block';
        const rect = stage.getBoundingClientRect();
        let x = mouseClient.x + 18;
        let y = mouseClient.y + 18;
        if (x > rect.width - 360) x = mouseClient.x - 360;
        if (y > rect.height - 160) y = mouseClient.y - 140;
        tooltip.style.left = x + 'px';
        tooltip.style.top  = y + 'px';
        const lbl = tooltip.querySelector('.label');
        lbl.textContent = d.label;
        lbl.style.color = d._color || '#fff';
        tooltip.querySelector('.detail').textContent = d.detail || '';
        tooltip.querySelector('.freshness').innerHTML =
          `<span class="lime">${d.type}</span> · freshness <span class="lime">${Math.round((d.freshness || 0) * 100)}%</span>`;
        const fill = tooltip.querySelector('.bar .fill');
        fill.style.width = ((d.freshness || 0) * 100) + '%';
        fill.style.background = d._color || '#C5FF4D';
        fill.style.boxShadow  = `0 0 8px ${d._color || '#C5FF4D'}`;
      } else {
        tooltip.style.display = 'none';
      }
    }

    function dispose() {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    }

    return { update, dispose };
  }
  ```

- [x] **Step 2** — In `scene.js`, add import:
  ```js
  import { createTooltip } from './tooltip.js';
  ```

- [x] **Step 3** — After the post-processing block, add:
  ```js
    // ── HOVER TOOLTIP ────────────────────────────────────────────
    const hoverables = [coreMesh, ...cats.map(c => growthTips[c.id].coreSphere)];
    const dataNodesById = {};
    data.nodes.forEach(n => { dataNodesById[n.id] = n; });
    const hoverCtl = createTooltip({
      stage, tooltip, camera,
      hoverables, pollenGeom, leafNodes, leafToPollenIndex, dataNodesById,
    });
  ```

- [x] **Step 4** — In `animate()`, before `composer.render()`, add:
  ```js
      hoverCtl.update();
  ```

- [x] **Step 5** — Update `dispose()` to include `hoverCtl.dispose();`.

- [x] **Step 6** — Boot dev. Expected: hovering ARIA's core shows her tooltip; hovering any growth-tip core sphere shows that sub-agent's tooltip; mousing close to a pollen leaf shows the leaf's tooltip.

- [x] **Step 7** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/tooltip.js client/src/neural-map/scene.js && git commit -m "Add hover tooltip: raycaster for meshes + screen-space proximity for leaves"
  ```

### Task B14 — CSS2D labels (hub + categories)

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — Add import:
  ```js
  import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
  ```

- [x] **Step 2** — After the OrbitControls block, add:
  ```js
    const labelRenderer = new CSS2DRenderer({ element: labelLayer });
    labelRenderer.setSize(stage.clientWidth, stage.clientHeight);
  ```

- [x] **Step 3** — Update OrbitControls to use the label layer for event capture (so the labels don't swallow drags):
  ```js
    const controls = new OrbitControls(camera, labelRenderer.domElement);
  ```

- [x] **Step 4** — In `resize()`, add:
  ```js
      labelRenderer.setSize(w, h);
  ```

- [x] **Step 5** — After the growth-tips block, add labels:
  ```js
    // ── CSS2D LABELS ─────────────────────────────────────────────
    {
      const div = document.createElement('div');
      div.className = 'neural-label hub';
      div.textContent = 'A·R·I·A';
      const obj = new CSS2DObject(div);
      obj.position.set(0, 1.55, 0);
      coreMesh.add(obj);
    }
    cats.forEach((cat) => {
      const div = document.createElement('div');
      div.className = 'neural-label category';
      div.innerHTML = `<span class="tick"></span>${cat.label.toUpperCase()}`;
      div.style.color = cat.color;
      const obj = new CSS2DObject(div);
      obj.position.set(0, 0.22, 0);
      growthTips[cat.id].group.add(obj);
    });
  ```

- [x] **Step 6** — In `animate()`, after `composer.render()`, add:
  ```js
      labelRenderer.render(scene, camera);
  ```

- [x] **Step 7** — Boot dev. Expected: "A·R·I·A" label floats above the core; each growth tip has its agent name in its color.

- [x] **Step 8** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/neural-map/scene.js && git commit -m "Add CSS2D labels for ARIA hub + 6 sub-agent categories"
  ```

---

## Phase C — Real data

Replace the inline `MOCK_DATA` with a server-fetched payload built from Supabase. The server gracefully degrades to the four canonical sub-agents if the `spawned_agents` Factory table doesn't exist yet.

### Task C1 — `buildNeuralMap` helper on the server

**Files:**
- Create: `/Users/randyjewell/ARIA/server/src/neural-map.js`
- Create: `/Users/randyjewell/ARIA/server/src/test/neural-map.test.js`

**Steps:**

- [x] **Step 1** — Create failing test `/Users/randyjewell/ARIA/server/src/test/neural-map.test.js`:
  ```js
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  vi.mock('../supabase.js', () => ({
    getSupabase: vi.fn(),
    getTenantId: vi.fn(),
  }));

  let buildNeuralMap, getSupabase, getTenantId;
  beforeEach(async () => {
    vi.resetModules();
    ({ buildNeuralMap } = await import('../neural-map.js'));
    ({ getSupabase, getTenantId } = await import('../supabase.js'));
  });

  describe('buildNeuralMap', () => {
    it('returns aria hub + 4 canonical sub-agents even when Supabase is null', async () => {
      getSupabase.mockReturnValue(null);
      getTenantId.mockResolvedValue(null);
      const out = await buildNeuralMap();
      expect(out.nodes.find(n => n.id === 'aria')?.type).toBe('hub');
      ['scout', 'hunter', 'creative', 'hermes'].forEach(slug => {
        expect(out.nodes.find(n => n.id === slug)?.type).toBe('category');
      });
    });

    it('binds canonical sub-agent colors to the spec values', async () => {
      getSupabase.mockReturnValue(null);
      getTenantId.mockResolvedValue(null);
      const out = await buildNeuralMap();
      expect(out.nodes.find(n => n.id === 'scout').color).toBe('#6BD08F');
      expect(out.nodes.find(n => n.id === 'hunter').color).toBe('#E08B5C');
      expect(out.nodes.find(n => n.id === 'creative').color).toBe('#B97FE5');
      expect(out.nodes.find(n => n.id === 'hermes').color).toBe('#E3CC68');
    });

    it('returns edges as an empty array', async () => {
      getSupabase.mockReturnValue(null);
      getTenantId.mockResolvedValue(null);
      const out = await buildNeuralMap();
      expect(out.edges).toEqual([]);
    });

    it('appends Factory spawned_agents as categories when the table exists', async () => {
      const spawned = [
        { slug: 'beacon', label: 'Beacon', color: '#6FA8DC', detail: 'Morning brief drafter', status: 'approved' },
      ];
      const sb = makeMockSupabase({ aria_memory: [], contacts: [], spawned_agents: spawned });
      getSupabase.mockReturnValue(sb);
      getTenantId.mockResolvedValue('tenant-1');
      const out = await buildNeuralMap();
      const beacon = out.nodes.find(n => n.id === 'beacon');
      expect(beacon?.type).toBe('category');
      expect(beacon?.color).toBe('#6FA8DC');
    });

    it('silently ignores spawned_agents table errors (Factory not yet shipped)', async () => {
      const sb = {
        from: () => ({
          select: () => ({
            eq: () => ({
              limit: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }),
              order: () => ({ limit: () => Promise.resolve({ data: null, error: { message: 'relation does not exist' } }) }),
            }),
          }),
        }),
      };
      getSupabase.mockReturnValue(sb);
      getTenantId.mockResolvedValue('tenant-1');
      const out = await buildNeuralMap();
      expect(out.nodes.find(n => n.id === 'aria')).toBeTruthy();
      expect(out.nodes.length).toBeGreaterThanOrEqual(5);
    });
  });

  function makeMockSupabase({ aria_memory, contacts, spawned_agents }) {
    return {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            limit: () => Promise.resolve({
              data: table === 'aria_memory' ? aria_memory
                  : table === 'contacts'    ? contacts
                  : table === 'spawned_agents' ? spawned_agents
                  : [],
              error: null,
            }),
            order: () => ({
              limit: () => Promise.resolve({
                data: table === 'aria_memory' ? aria_memory
                    : table === 'contacts'    ? contacts
                    : table === 'spawned_agents' ? spawned_agents
                    : [],
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
  }
  ```

- [x] **Step 2** — Run `cd /Users/randyjewell/ARIA/server && npm test`. Expected: failure — module `../neural-map.js` not found.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/server/src/neural-map.js`:
  ```js
  import { getSupabase, getTenantId } from './supabase.js';

  const CANONICAL_AGENTS = [
    { id: 'scout',    label: 'Scout',    color: '#6BD08F', detail: 'Web intelligence. Targeted searches, page fetches, cross-referenced briefings.' },
    { id: 'hunter',   label: 'Hunter',   color: '#E08B5C', detail: 'B2B lead generation. Qualifies SMB prospects by funding, tech hiring, modernization.' },
    { id: 'creative', label: 'Creative', color: '#B97FE5', detail: 'B2B ad and social copywriter. LinkedIn/Meta/Google/email variations.' },
    { id: 'hermes',   label: 'Hermes',   color: '#E3CC68', detail: 'Long-running, memory-backed tasks via Nous Research Hermes CLI.' },
  ];

  const HUB = {
    id: 'aria', type: 'hub', label: 'ARIA', color: '#C5FF4D', freshness: 1.0,
    detail: 'Adaptive Reasoning & Intelligent Automation — voice-first cofounder for Jack & Jewell Consulting.',
  };

  function computeFreshness(when) {
    if (!when) return 0.3;
    const ts = typeof when === 'string' ? new Date(when).getTime() : when.getTime();
    const ageHours = Math.max(0, (Date.now() - ts) / 3_600_000);
    if (ageHours < 1)   return 1.0;
    if (ageHours > 336) return 0.05;
    return Math.max(0.05, 1.0 - ageHours / 336);
  }

  function memoryRowToLeaf(row) {
    const slug = row.key || row.id;
    const parent = (row.source_agent || '').toLowerCase();
    const validParent = CANONICAL_AGENTS.find(a => a.id === parent)?.id || 'scout';
    return {
      id: slug,
      parent: validParent,
      type: 'leaf',
      label: row.label || row.summary?.slice(0, 48) || row.key || 'memory',
      freshness: computeFreshness(row.updated_at || row.created_at),
      detail: row.summary || row.body || '',
    };
  }

  function contactRowToLeaf(row) {
    return {
      id: `contact-${row.id || row.name}`,
      parent: 'hunter',
      type: 'leaf',
      label: row.name || row.company_name || 'lead',
      freshness: computeFreshness(row.updated_at || row.created_at),
      detail: row.notes || row.status || '',
    };
  }

  export async function buildNeuralMap() {
    const sb = getSupabase();
    const tenantId = await getTenantId().catch(() => null);

    const nodes = [HUB];
    const subagents = [...CANONICAL_AGENTS];

    if (sb && tenantId) {
      try {
        const { data, error } = await sb.from('spawned_agents').select('*').eq('tenant_id', tenantId).limit(50);
        if (!error && Array.isArray(data)) {
          for (const sa of data) {
            if (sa.status !== 'approved') continue;
            if (!sa.slug || subagents.some(a => a.id === sa.slug)) continue;
            subagents.push({
              id: sa.slug,
              label: sa.label || sa.slug,
              color: sa.color || '#6FA8DC',
              detail: sa.detail || '',
            });
          }
        }
      } catch {}
    }

    for (const sa of subagents) {
      nodes.push({ ...sa, type: 'category', freshness: 0.7 });
    }

    const leaves = [];
    if (sb && tenantId) {
      try {
        const { data, error } = await sb.from('aria_memory').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(20);
        if (!error && Array.isArray(data)) data.forEach(row => leaves.push(memoryRowToLeaf(row)));
      } catch {}
      try {
        const { data, error } = await sb.from('contacts').select('*').eq('tenant_id', tenantId).limit(12);
        if (!error && Array.isArray(data)) data.forEach(row => leaves.push(contactRowToLeaf(row)));
      } catch {}
    }
    leaves.forEach(l => nodes.push(l));

    for (const cat of subagents) {
      const childMax = leaves.filter(l => l.parent === cat.id).reduce((m, l) => Math.max(m, l.freshness), 0);
      const cn = nodes.find(n => n.id === cat.id);
      if (cn && childMax > 0) cn.freshness = childMax;
    }

    return { nodes, edges: [] };
  }
  ```

- [x] **Step 4** — Run `cd /Users/randyjewell/ARIA/server && npm test`. Expected: all 5 neural-map tests pass.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add server/src/neural-map.js server/src/test/neural-map.test.js && git commit -m "Add buildNeuralMap: Supabase-backed nodes with graceful Factory degrade"
  ```

### Task C2 — Wire `GET /neural-map` into the Express server

**Files:**
- Modify: `/Users/randyjewell/ARIA/server/src/index.js`

**Steps:**

- [x] **Step 1** — Add the import after the existing imports in `server/src/index.js`:
  ```js
  import { buildNeuralMap } from './neural-map.js';
  ```

- [x] **Step 2** — Add the route after `app.get('/health', ...)`:
  ```js
  app.get('/neural-map', async (_, res) => {
    try {
      const payload = await buildNeuralMap();
      res.json(payload);
    } catch (err) {
      console.error('[neural-map] error:', err.message);
      res.status(500).json({ error: 'Could not build neural map' });
    }
  });
  ```

- [x] **Step 3** — Boot server: `cd server && npm run dev`. Then in another terminal:
  ```bash
  curl -s http://localhost:3001/neural-map | head -c 400
  ```
  Expected: JSON starting `{"nodes":[{"id":"aria","type":"hub",...`.

- [x] **Step 4** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add server/src/index.js && git commit -m "Add GET /neural-map REST endpoint"
  ```

### Task C3 — Configure Vite proxy

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/vite.config.js`

**Steps:**

- [x] **Step 1** — Replace `client/vite.config.js`:
  ```js
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api':         'http://localhost:3001',
        '/neural-map':  'http://localhost:3001',
        '/speak':       'http://localhost:3001',
        '/memory':      'http://localhost:3001',
        '/clients':     'http://localhost:3001',
      },
    },
  });
  ```

- [x] **Step 2** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/vite.config.js && git commit -m "Proxy /neural-map and existing routes through Vite to server:3001"
  ```

### Task C4 — Client fetches `/neural-map`

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`

**Steps:**

- [x] **Step 1** — Replace `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`:
  ```jsx
  import { useEffect, useState } from 'react';
  import NeuralMap from '../neural-map/NeuralMap.jsx';
  import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
  import { MOCK_DATA } from '../neural-map/mockData.js';

  export default function Console({ drawerOpen, onCloseDrawer, workStates }) {
    const [data, setData] = useState(MOCK_DATA);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/neural-map');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          if (cancelled) return;
          if (Array.isArray(payload.nodes) && payload.nodes.length > 1) setData(payload);
        } catch (err) {
          if (!cancelled) setLoadError(err.message || 'fetch failed');
        }
      })();
      return () => { cancelled = true; };
    }, []);

    return (
      <>
        <div className="stage" id="stage">
          <NeuralMap data={data} workStates={workStates || {}} />
          <div className="vignette" />
          {loadError && (
            <div className="stage-error">Using mock data — server fetch failed: {loadError}</div>
          )}
        </div>
        <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
          <div style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            Dashboard content — Phase E
          </div>
        </DashboardDrawer>
      </>
    );
  }
  ```

- [x] **Step 2** — Append to `client/src/index.css`:
  ```css
  .stage-error {
    position: absolute; top: 22px; left: 28px; z-index: 6;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--warn);
    background: rgba(242,176,78,0.08);
    border: 1px solid rgba(242,176,78,0.3);
    padding: 6px 10px; border-radius: 6px;
  }
  ```

- [x] **Step 3** — In `App.jsx`, update the `<Console />` block to pass `workStates={{}}` (next phase wires the real value):
  ```jsx
        {activeRoute === 'console' && (
          <Console
            drawerOpen={drawerOpen}
            onCloseDrawer={() => setDrawerOpen(false)}
            workStates={{}}
          />
        )}
  ```

- [x] **Step 4** — Boot both servers. Open `http://localhost:5174`. Expected: Network tab shows `GET /neural-map → 200`. The scene renders with whatever real data Supabase returned. Stop the server, refresh — expected: scene falls back to MOCK_DATA and an amber pill in the top-left shows the error.

- [x] **Step 5** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/pages/Console.jsx client/src/App.jsx client/src/index.css && git commit -m "Fetch /neural-map on mount; fall back to mock on error"
  ```

---

## Phase D — Real-time WebSocket

Backend pushes work-state changes; the scene reacts without React tearing down the whole canvas.

### Task D1 — Server emits `agent_state` events around delegations

**Files:**
- Modify: `/Users/randyjewell/ARIA/server/src/agent.js`

**Steps:**

- [x] **Step 1** — Add to imports at the top of `server/src/agent.js`:
  ```js
  import { broadcast } from './index.js';

  const DELEGATE_TO_SLUG = {
    delegate_to_scout:    'scout',
    delegate_to_hunter:   'hunter',
    delegate_to_creative: 'creative',
    delegate_to_hermes:   'hermes',
  };
  ```

- [x] **Step 2** — Inside `runAgent`, find:
  ```js
  const result = await callTool(tool.name, tool.input, onEvent);
  ```
  Replace with:
  ```js
  const slug = DELEGATE_TO_SLUG[tool.name];
  if (slug) broadcast({ type: 'agent_state', slug, state: 'working' });
  const result = await callTool(tool.name, tool.input, onEvent);
  if (slug) broadcast({ type: 'agent_state', slug, state: 'returning' });
  ```

- [x] **Step 3** — Boot both servers. Send a message like "scout, who's hiring in Carmel". Tail the server log. Expected: log entries for `tool_call delegate_to_scout` are bracketed by the agent_state broadcasts.

- [x] **Step 4** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add server/src/agent.js && git commit -m "Emit agent_state working/returning around delegate_to_* tool calls"
  ```

### Task D2 — Client wires WS events into the scene

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/App.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/NeuralMap.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/neural-map/scene.js`

**Steps:**

- [x] **Step 1** — In `App.jsx`, add state:
  ```jsx
  const [workStates, setWorkStates]       = useState({});
  const [mapRefreshKey, setMapRefreshKey] = useState(0);
  ```

- [x] **Step 2** — In `App.jsx` `handleServerEvent`, add cases (place inside the existing `switch`):
  ```js
        case 'agent_state':
          setWorkStates(prev => ({ ...prev, [msg.slug]: { state: msg.state, updatedAt: Date.now() } }));
          break;
        case 'freshness_update':
          window.dispatchEvent(new CustomEvent('aria:freshness', { detail: msg }));
          break;
        case 'node_added':
          window.dispatchEvent(new CustomEvent('aria:node_added', { detail: msg.node }));
          break;
        case 'node_removed':
          window.dispatchEvent(new CustomEvent('aria:node_removed', { detail: { id: msg.id } }));
          break;
        case 'map_refresh':
          setMapRefreshKey(k => k + 1);
          break;
  ```

- [x] **Step 3** — Pass `workStates` and `mapRefreshKey` to Console (replaces the placeholder in C4):
  ```jsx
        {activeRoute === 'console' && (
          <Console
            drawerOpen={drawerOpen}
            onCloseDrawer={() => setDrawerOpen(false)}
            workStates={workStates}
            refreshKey={mapRefreshKey}
          />
        )}
  ```

- [x] **Step 4** — In `Console.jsx`, add `refreshKey` to the props destructure and change the fetch `useEffect`'s dep array from `[]` to `[refreshKey]`.

- [x] **Step 5** — Modify `NeuralMap.jsx` to forward window events into the scene handle:
  ```jsx
    useEffect(() => {
      if (!canvasRef.current) return;
      const handle = createScene({
        canvas: canvasRef.current,
        labelLayer: labelLayerRef.current,
        tooltip: tooltipRef.current,
        data,
        workStates,
      });
      sceneHandleRef.current = handle;

      const onFreshness = (e) => handle.setFreshness?.(e.detail.id, e.detail.freshness);
      const onAdd       = (e) => handle.addLeaf?.(e.detail);
      const onRemove    = (e) => handle.removeLeaf?.(e.detail.id);
      window.addEventListener('aria:freshness',    onFreshness);
      window.addEventListener('aria:node_added',   onAdd);
      window.addEventListener('aria:node_removed', onRemove);

      return () => {
        window.removeEventListener('aria:freshness',    onFreshness);
        window.removeEventListener('aria:node_added',   onAdd);
        window.removeEventListener('aria:node_removed', onRemove);
        handle.dispose();
        sceneHandleRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  ```

- [x] **Step 6** — In `scene.js`, extend the returned handle to support setFreshness / addLeaf / removeLeaf (replace the existing return block):
  ```js
    return {
      setWorkStates(next) {
        Object.keys(next).forEach(slug => {
          if (!workStates[slug]) return;
          const incomingState = next[slug].state;
          if (incomingState && incomingState !== workStates[slug].state) {
            if (incomingState === 'returning') {
              const tSince = clock.getElapsedTime() - workStates[slug].stateStartTime;
              workStates[slug].floatStartOffset.copy(computeFloatOffset(workStates[slug], tSince));
            }
            workStates[slug].state = incomingState;
            workStates[slug].stateStartTime = clock.getElapsedTime();
          }
        });
      },
      setFreshness(id, freshness) {
        const dendrite = dendrites.find(d => d.toId === id);
        if (dendrite) dendrite.mesh.material.uniforms.uFreshness.value = freshness;
        const gt = growthTips[id];
        if (gt) gt.data.freshness = freshness;
      },
      addLeaf(node) {
        if (!node || !node.parent) return;
        const ci = cats.findIndex(c => c.id === node.parent);
        if (ci < 0) return;
        // Find first free pollen slot in this cat's slice
        const baseIdx = ci * POLLEN_PER_CAT;
        let target = -1;
        for (let i = 0; i < POLLEN_PER_CAT; i++) {
          if (pollenSize[baseIdx + i] === 0) { target = baseIdx + i; break; }
        }
        if (target < 0) target = baseIdx; // overwrite first
        pollenSize[target] = 9.0;
        pollenGeom.attributes.aSize.needsUpdate = true;
        leafToPollenIndex[node.id] = target;
        leafNodes.push(node);
        dataNodesById[node.id] = node;
      },
      removeLeaf(id) {
        const gi = leafToPollenIndex[id];
        if (gi == null) return;
        pollenSize[gi] = 0;
        pollenGeom.attributes.aSize.needsUpdate = true;
        delete leafToPollenIndex[id];
      },
      dispose() {
        cancelAnimationFrame(rafId);
        window.removeEventListener('mousemove', onMouseMove);
        hoverCtl.dispose();
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
      },
    };
  ```

- [x] **Step 7** — Now propagate React-side `workStates` into the scene. Modify the existing `useEffect` in `NeuralMap.jsx` that watches `workStates` to call `setWorkStates`. The post-D1 version already has this; double-check it exists:
  ```jsx
    useEffect(() => {
      sceneHandleRef.current?.setWorkStates?.(workStates);
    }, [workStates]);
  ```

- [x] **Step 8** — Boot both servers. Type "scout, search for MSPs in Greenwood". Expected: within ~1s, Scout's tip detaches from its anchor and starts a Lissajous orbit. A pulsing lime-green leash line stretches from anchor → tip. When Scout's tool result comes back, the tip eases home over 1.6s and the leash fades to 0.

- [x] **Step 9** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/App.jsx client/src/pages/Console.jsx client/src/neural-map/NeuralMap.jsx client/src/neural-map/scene.js && git commit -m "Wire WebSocket: agent_state, freshness_update, node_added/removed, map_refresh"
  ```

---

## Phase E — Dashboard drawer content

Real KPIs from `metrics`, real actions/intel from Supabase + the WS streams.

### Task E1 — `KpiStrip` component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/KpiStrip.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/KpiStrip.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [x] **Step 1** — Create failing test `/Users/randyjewell/ARIA/client/src/dashboard/KpiStrip.test.jsx`:
  ```jsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import KpiStrip from './KpiStrip.jsx';

  describe('<KpiStrip>', () => {
    const props = {
      mrr: 1950, mrrTarget: 16500, mrrWeekDelta: 350,
      pipelineOpen: 8400, pipelineActive: 4, pipelineHot: 1,
      followUpsTotal: 3, followUpsOverdue: 2,
      spendToday: 0.42, tokensToday: 12800, avgLatency: 0.74,
    };
    it('renders four KPI cards with mono-formatted numbers', () => {
      render(<KpiStrip {...props} />);
      expect(screen.getByText('$1,950')).toBeInTheDocument();
      expect(screen.getByText(/\/ \$16,500/)).toBeInTheDocument();
      expect(screen.getByText('$8,400')).toBeInTheDocument();
      expect(screen.getByText(/4 active · 1 hot/)).toBeInTheDocument();
      expect(screen.getByText('$0.42')).toBeInTheDocument();
      expect(screen.getByText(/12.8K tokens/)).toBeInTheDocument();
    });
  });
  ```

- [x] **Step 2** — Run `npm test`. Expected: failure.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/dashboard/KpiStrip.jsx`:
  ```jsx
  export default function KpiStrip({
    mrr, mrrTarget, mrrWeekDelta,
    pipelineOpen, pipelineActive, pipelineHot,
    followUpsTotal, followUpsOverdue,
    spendToday, tokensToday, avgLatency,
  }) {
    const mrrPct = Math.min(100, Math.round((mrr / mrrTarget) * 100));
    return (
      <div className="drawer-kpis">
        <div className="drawer-kpi">
          <div className="label">MRR vs bridge</div>
          <div className="val lime mono">${mrr.toLocaleString()}</div>
          <div className="delta">/ ${mrrTarget.toLocaleString()} · {mrrPct}% · <span style={{ color: 'var(--accent)' }}>+${mrrWeekDelta.toLocaleString()} wk</span></div>
        </div>
        <div className="drawer-kpi">
          <div className="label">Pipeline open</div>
          <div className="val mono">${pipelineOpen.toLocaleString()}</div>
          <div className="delta">{pipelineActive} active · {pipelineHot} hot</div>
        </div>
        <div className="drawer-kpi">
          <div className="label">Follow-ups</div>
          <div className="val mono">{followUpsTotal} <span style={{ color: 'var(--hot)', fontSize: 14 }}>{followUpsOverdue} OVR</span></div>
          <div className="delta">today · this week</div>
        </div>
        <div className="drawer-kpi">
          <div className="label">Today's spend</div>
          <div className="val mono" style={{ color: 'var(--warn)' }}>${spendToday.toFixed(2)}</div>
          <div className="delta">{(tokensToday / 1000).toFixed(1)}K tokens · avg {avgLatency.toFixed(2)}s</div>
        </div>
      </div>
    );
  }
  ```

- [x] **Step 4** — Append to `client/src/index.css`:
  ```css
  /* ============== DRAWER KPI STRIP ============== */
  .drawer-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
  .drawer-kpi {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .drawer-kpi .label {
    font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.1em;
    color: var(--text-mute); text-transform: uppercase; margin-bottom: 8px;
  }
  .drawer-kpi .label::before { content: "◦ "; color: var(--accent); }
  .drawer-kpi .val {
    font-family: var(--font-display); font-size: 22px; font-weight: 600;
    letter-spacing: -0.02em;
  }
  .drawer-kpi .val.lime { color: var(--accent); }
  .drawer-kpi .delta {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--text-dim); margin-top: 4px;
  }
  ```

- [x] **Step 5** — Run `npm test`. Expected: pass.

- [x] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/dashboard/KpiStrip.jsx client/src/dashboard/KpiStrip.test.jsx client/src/index.css && git commit -m "Add KpiStrip: 4 dashboard drawer KPI cards"
  ```

### Task E2 — `ActionsPanel` component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/ActionsPanel.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/ActionsPanel.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [x] **Step 1** — Create failing test:
  ```jsx
  // /Users/randyjewell/ARIA/client/src/dashboard/ActionsPanel.test.jsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import ActionsPanel from './ActionsPanel.jsx';

  describe('<ActionsPanel>', () => {
    const actions = [
      { id: '1', title: 'Pixel Pools — reply', meta: '$1,800 deal', due: '2d overdue', urgency: 'hot' },
      { id: '2', title: 'Performance Clinic prep', meta: 'Wed Jun 3', due: '3 days', urgency: 'soon' },
      { id: '3', title: 'Hedgerow Dental — qualify', meta: 'Atlas 78/100', due: 'Sat Jun 7', urgency: 'today' },
      { id: '4', title: 'Greenwood Church renewal', meta: '$900/mo', due: 'Jun 22', urgency: 'future' },
    ];

    it('renders each action title + meta + due', () => {
      render(<ActionsPanel actions={actions} />);
      expect(screen.getByText('Pixel Pools — reply')).toBeInTheDocument();
      expect(screen.getByText('$1,800 deal')).toBeInTheDocument();
      expect(screen.getByText('2d overdue')).toBeInTheDocument();
    });
    it('marker class reflects urgency', () => {
      const { container } = render(<ActionsPanel actions={actions} />);
      expect(container.querySelector('.action-row .marker.hot')).toBeInTheDocument();
      expect(container.querySelector('.action-row .marker.soon')).toBeInTheDocument();
      expect(container.querySelector('.action-row .marker.future')).toBeInTheDocument();
    });
    it('shows N items in the aside', () => {
      render(<ActionsPanel actions={actions} />);
      expect(screen.getByText('4 items')).toBeInTheDocument();
    });
    it('renders an empty state when actions are empty', () => {
      render(<ActionsPanel actions={[]} />);
      expect(screen.getByText(/No actions queued/i)).toBeInTheDocument();
    });
  });
  ```

- [x] **Step 2** — Run `npm test`. Expected: failure.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/dashboard/ActionsPanel.jsx`:
  ```jsx
  const URGENCY_CLASS = { hot: 'hot', soon: 'soon', today: '', future: 'future' };
  const DUE_CLASS     = { hot: 'hot', soon: 'soon', today: '', future: '' };

  export default function ActionsPanel({ actions }) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Today's actions <span className="ann">— what ARIA wants you to handle</span></div>
          <div className="panel-aside">{actions.length} items</div>
        </div>
        {actions.length === 0 ? (
          <div style={{ padding: '24px 0', color: 'var(--text-mute)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No actions queued. Ask ARIA "what should I do today?"
          </div>
        ) : actions.map(a => (
          <div className="action-row" key={a.id}>
            <div className={`marker ${URGENCY_CLASS[a.urgency] || ''}`} />
            <div className="body">
              <div className="title">{a.title}</div>
              <div className="meta">{a.meta}</div>
            </div>
            <div className={`due ${DUE_CLASS[a.urgency] || ''}`}>{a.due}</div>
          </div>
        ))}
      </div>
    );
  }
  ```

- [x] **Step 4** — Append to `client/src/index.css`:
  ```css
  /* ============== DRAWER PANELS ============== */
  .panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 26px;
    backdrop-filter: blur(8px);
  }
  .panel-head {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 16px; padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .panel-title { font-family: var(--font-display); font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .panel-title .ann { color: var(--text-mute); font-weight: 400; font-size: 12px; margin-left: 6px; }
  .panel-aside { font-family: var(--font-mono); font-size: 11px; color: var(--text-mute); }

  .action-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 14px; align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .action-row:last-child { border-bottom: none; }
  .action-row .marker {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); box-shadow: 0 0 8px var(--accent);
  }
  .action-row .marker.hot    { background: var(--hot);  box-shadow: 0 0 8px var(--hot); }
  .action-row .marker.soon   { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  .action-row .marker.future { background: rgba(255,255,255,0.15); box-shadow: none; }
  .action-row .body .title { font-size: 14px; color: var(--text); margin-bottom: 2px; }
  .action-row .body .meta  { font-family: var(--font-mono); font-size: 11px; color: var(--text-mute); }
  .action-row .due { font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); text-align: right; white-space: nowrap; }
  .action-row .due.hot  { color: var(--hot); }
  .action-row .due.soon { color: var(--warn); }
  ```

- [x] **Step 5** — Run `npm test`. Expected: pass.

- [x] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/dashboard/ActionsPanel.jsx client/src/dashboard/ActionsPanel.test.jsx client/src/index.css && git commit -m "Add ActionsPanel with urgency markers"
  ```

### Task E3 — `IntelFeed` component

**Files:**
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/IntelFeed.jsx`
- Create: `/Users/randyjewell/ARIA/client/src/dashboard/IntelFeed.test.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [x] **Step 1** — Create failing test:
  ```jsx
  // /Users/randyjewell/ARIA/client/src/dashboard/IntelFeed.test.jsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import IntelFeed from './IntelFeed.jsx';

  describe('<IntelFeed>', () => {
    const items = [
      { id: 'a', agent: 'scout',  source: 'competitor watch', msg: 'Wayfinder Tech dropped Starter tier.', time: '11 min' },
      { id: 'b', agent: 'beacon', source: 'brief ready',      msg: '$1,950 MRR, 3 actions due.',           time: '23 min' },
      { id: 'c', agent: 'hunter', source: 'new lead',         msg: 'Bridgepoint Dental hired new ops director.', time: '2h' },
      { id: 'd', agent: 'verse',  source: 'LinkedIn',         msg: '2 comment replies drafted.',           time: '4h' },
    ];
    it('renders all intel rows with agent avatar tile', () => {
      render(<IntelFeed items={items} />);
      ['SCT', 'BCN', 'HNT', 'VRS'].forEach(a => expect(screen.getByText(a)).toBeInTheDocument());
    });
    it('renders source eyebrow with agent name', () => {
      render(<IntelFeed items={items} />);
      expect(screen.getByText(/Scout · competitor watch/)).toBeInTheDocument();
    });
    it('shows "live" label in the aside', () => {
      render(<IntelFeed items={items} />);
      expect(screen.getByText('live')).toBeInTheDocument();
    });
    it('renders empty state for no items', () => {
      render(<IntelFeed items={[]} />);
      expect(screen.getByText(/No intel yet/i)).toBeInTheDocument();
    });
  });
  ```

- [x] **Step 2** — Run `npm test`. Expected: failure.

- [x] **Step 3** — Create `/Users/randyjewell/ARIA/client/src/dashboard/IntelFeed.jsx`:
  ```jsx
  const AGENT_META = {
    scout:    { abbr: 'SCT', name: 'Scout',    color: '#6BD08F' },
    hunter:   { abbr: 'HNT', name: 'Hunter',   color: '#E08B5C' },
    creative: { abbr: 'CRT', name: 'Creative', color: '#B97FE5' },
    hermes:   { abbr: 'HRM', name: 'Hermes',   color: '#E3CC68' },
    beacon:   { abbr: 'BCN', name: 'Beacon',   color: '#6FA8DC' },
    verse:    { abbr: 'VRS', name: 'Verse',    color: '#C078E5' },
  };

  export default function IntelFeed({ items }) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Intel feed</div>
          <div className="panel-aside">live</div>
        </div>
        {items.length === 0 ? (
          <div style={{ padding: '24px 0', color: 'var(--text-mute)', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No intel yet — ARIA's sub-agents will surface findings here.
          </div>
        ) : items.map(it => {
          const meta = AGENT_META[it.agent] || { abbr: '?', name: it.agent, color: '#fff' };
          return (
            <div className="intel-row" key={it.id}>
              <div className="av" style={{ color: meta.color, borderColor: meta.color }}>{meta.abbr}</div>
              <div className="body">
                <div className="src">{meta.name} · {it.source}</div>
                <div className="msg">{it.msg}</div>
              </div>
              <div className="time">{it.time}</div>
            </div>
          );
        })}
      </div>
    );
  }
  ```

- [x] **Step 4** — Append to `client/src/index.css`:
  ```css
  .intel-row {
    display: grid; grid-template-columns: auto 1fr auto; gap: 12px;
    padding: 11px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .intel-row:last-child { border-bottom: none; }
  .intel-row .av {
    width: 28px; height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border-2);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-size: 8px;
    color: rgba(255,255,255,0.6);
  }
  .intel-row .body .src { font-family: var(--font-mono); font-size: 10px; color: var(--text-mute); margin-bottom: 2px; }
  .intel-row .body .src::before { content: "◦ "; color: var(--accent); }
  .intel-row .body .msg { font-size: 13px; line-height: 1.5; color: var(--text-dim); }
  .intel-row .time { font-family: var(--font-mono); font-size: 10px; color: var(--text-mute); white-space: nowrap; }
  ```

- [x] **Step 5** — Run `npm test`. Expected: pass.

- [x] **Step 6** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/dashboard/IntelFeed.jsx client/src/dashboard/IntelFeed.test.jsx client/src/index.css && git commit -m "Add IntelFeed with per-agent avatar tile + empty state"
  ```

### Task E4 — Wire drawer contents into Console + App

**Files:**
- Modify: `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/App.jsx`
- Modify: `/Users/randyjewell/ARIA/client/src/index.css`

**Steps:**

- [x] **Step 1** — Replace `/Users/randyjewell/ARIA/client/src/pages/Console.jsx`:
  ```jsx
  import { useEffect, useState } from 'react';
  import NeuralMap from '../neural-map/NeuralMap.jsx';
  import DashboardDrawer from '../dashboard/DashboardDrawer.jsx';
  import KpiStrip from '../dashboard/KpiStrip.jsx';
  import ActionsPanel from '../dashboard/ActionsPanel.jsx';
  import IntelFeed from '../dashboard/IntelFeed.jsx';
  import { MOCK_DATA } from '../neural-map/mockData.js';

  export default function Console({
    drawerOpen, onCloseDrawer, workStates, refreshKey,
    mrr, mrrTarget, spendToday, tokensToday, avgLatency,
    actions, intel,
  }) {
    const [data, setData] = useState(MOCK_DATA);
    const [loadError, setLoadError] = useState(null);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/neural-map');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const payload = await res.json();
          if (cancelled) return;
          if (Array.isArray(payload.nodes) && payload.nodes.length > 1) setData(payload);
        } catch (err) {
          if (!cancelled) setLoadError(err.message || 'fetch failed');
        }
      })();
      return () => { cancelled = true; };
    }, [refreshKey]);

    return (
      <>
        <div className="stage" id="stage">
          <NeuralMap data={data} workStates={workStates || {}} />
          <div className="vignette" />
          {loadError && <div className="stage-error">Using mock data — server fetch failed: {loadError}</div>}
        </div>
        <DashboardDrawer open={drawerOpen} onClose={onCloseDrawer}>
          <KpiStrip
            mrr={mrr}
            mrrTarget={mrrTarget}
            mrrWeekDelta={350}
            pipelineOpen={8400}
            pipelineActive={4}
            pipelineHot={1}
            followUpsTotal={3}
            followUpsOverdue={2}
            spendToday={spendToday}
            tokensToday={tokensToday}
            avgLatency={avgLatency}
          />
          <div className="drawer-grid">
            <ActionsPanel actions={actions} />
            <IntelFeed items={intel} />
          </div>
        </DashboardDrawer>
      </>
    );
  }
  ```

- [x] **Step 2** — Append to `client/src/index.css`:
  ```css
  .drawer-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 18px; }
  ```

- [x] **Step 3** — In `App.jsx`, derive `actions` and `intel`. Add a helper at the bottom of the file (outside the component):
  ```jsx
  function relativeTime(ts) {
    const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60)    return `${sec}s`;
    if (sec < 3600)  return `${Math.floor(sec / 60)} min`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  }
  ```

- [x] **Step 4** — Inside `CofounderApp`, add the derived values right before `// ── Render ──`:
  ```jsx
    const actions = (metrics?.actions || []).slice(0, 5).map((a, i) => ({
      id: a.id || `a-${i}`,
      title: a.title || a.label || 'Untitled action',
      meta: a.meta || a.detail || '',
      due: a.due || a.dueLabel || '',
      urgency: a.urgency || (a.overdue ? 'hot' : a.dueWithinDays <= 1 ? 'soon' : a.dueWithinDays <= 3 ? 'today' : 'future'),
    }));
    const intel = alerts.slice(0, 4).map((a, i) => ({
      id: a.id || `i-${i}`,
      agent: a.agent || a.from || 'scout',
      source: a.source || a.kind || 'signal',
      msg: a.body || a.message || '',
      time: a.timestamp ? relativeTime(a.timestamp) : 'now',
    }));
  ```

- [x] **Step 5** — Replace the `<Console />` block in the JSX with the full prop set:
  ```jsx
        {activeRoute === 'console' && (
          <Console
            drawerOpen={drawerOpen}
            onCloseDrawer={() => setDrawerOpen(false)}
            workStates={workStates}
            refreshKey={mapRefreshKey}
            mrr={currentMrr}
            mrrTarget={MRR_TARGET}
            spendToday={spend}
            tokensToday={tokens}
            avgLatency={latency}
            actions={actions}
            intel={intel}
          />
        )}
  ```

- [x] **Step 6** — Boot both servers. Click `Dashboard ▴`. Expected: 4 KPI cards on top, "Today's actions" panel on the left (empty state until `metrics.actions` is populated), "Intel feed" panel on the right (empty state until `alert` events fire).

- [x] **Step 7** — Commit:
  ```bash
  cd /Users/randyjewell/ARIA && git add client/src/App.jsx client/src/pages/Console.jsx client/src/index.css && git commit -m "Wire DashboardDrawer to live KPIs, Actions, IntelFeed"
  ```

---

## Phase F — Verification

One task: walk the spec §10 checklist. Do not mark anything complete that you haven't observed.

### Task F1 — Spec §10 verification walk

**Files:** none.

**Steps:**

- [x] **Step 1** — Boot the server: `cd /Users/randyjewell/ARIA/server && npm run dev`. Boot the client: `cd /Users/randyjewell/ARIA/client && npm run dev`.

- [x] **Step 2** — Open Chrome DevTools → Performance → Record. Open `http://localhost:5174`. Expected: time-to-first-paint < 1.5s, time-to-interactive < 2s. Record 10s of idle. Frame chart shows < 16ms/frame (60fps).

- [x] **Step 3** — Inspect `Network → /neural-map`. Verify the response has at least the hub + 4 canonical sub-agents and (if Supabase has rows) some leaves.

- [x] **Step 4** — Hover tests:
  - Mouse over ARIA's core → tooltip shows "ARIA · hub · freshness 100%".
  - Mouse over each of the 6 growth-tip spheres → that sub-agent's tooltip.
  - Mouse near a pollen leaf (within 22px) → that leaf's tooltip with freshness bar in the parent's color.

- [ ] **Step 5** — Voice: click the mic, say "hey ARIA". Expected: STT shows the recognized text, message is sent to ARIA, ARIA replies via Edge TTS audio.

- [ ] **Step 6** — Sub-agent float test: type "scout, search for MSPs in Greenwood, IN". Expected: within ~1s Scout's growth tip detaches and starts a Lissajous orbit; a pulsing lime leash connects tip to anchor; when Scout returns the result, the tip eases back home over 1.6s and the leash fades.

- [x] **Step 7** — Drawer test:
  - Click `Dashboard ▴` → slides up ~0.4s.
  - Verify backdrop blurs but neural map is still partially visible behind it.
  - Press ESC → slides down.
  - Click `Dashboard ▴` again → slides up. Click the handle → slides down. Click backdrop → slides down.

- [x] **Step 8** — Pill update: leave open 30s. Tokens / spend pills change at ≤ 2.5s intervals. Verify latency pill turns amber when a reply takes ≥ 1.0s (ask ARIA something that triggers `get_business_summary` — should round-trip in > 1s).

- [x] **Step 9** — Console clean: open DevTools Console. Zero red errors. Network tab: no failing requests except optional `/clients`/`/memory` if not yet seeded.

- [x] **Step 10** — Idle frame profiler: Performance → Record → 5s of doing nothing → average frame ≤ 16ms.

- [x] **Step 11** — Run all tests:
  ```bash
  cd /Users/randyjewell/ARIA/client && npm test
  cd /Users/randyjewell/ARIA/server && npm test
  ```
  Expected: all green on both sides.

- [ ] **Step 12** — Marker commit:
  ```bash
  cd /Users/randyjewell/ARIA && git commit --allow-empty -m "UI revamp verified against spec §10"
  ```

---

## Notes for future work (NOT in this plan's scope)

- Mobile layout (spec §9: out of scope).
- A11y / keyboard-navigable agent list (spec §9 deferred to v2).
- `prefers-reduced-motion` lite mode.
- Routes beyond `/` and `/factory` (Factory page is the sibling spec).
- v2 click-to-open node detail panel (spec §4.11 deferred).
- Hot data-swap (current `setData` stub in scene.js relies on `refreshKey` triggering a full Console remount; a true diff-update is a future refinement).
