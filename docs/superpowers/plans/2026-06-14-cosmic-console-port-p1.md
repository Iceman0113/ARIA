# Cosmic Console Port — Phase 1 (Look) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ARIA client Console route (`:5174`) render in the approved Cosmic design — luminous orb, red+teal halo, speaking corona, bloom, 6 roaming agents, left/right panel shells, cosmic top bar + nav + status dot, mic bar — with data still simulated.

**Architecture:** Port the vanilla Three.js scene from `mockups/aria-cosmic/index.html` into focused ES modules under `client/src/cosmic/`, mounted by a React wrapper (`CosmicStage`) that owns the WebGL lifecycle. Rebuild `Console.jsx` as the cosmic layout (canvas behind, overlay panels). Establish a reusable cosmic theme (`theme/cosmic.css`) that every route imports. CDN `THREE.*` globals (r128) become `three@0.174` ESM (`three` + `three/examples/jsm/...`).

**Tech Stack:** React 19, Vite 8, `three@0.174.0` (already installed), Vitest. No new dependencies.

**Source of truth for the scene:** `mockups/aria-cosmic/index.html`. This is a *port* — where a task says "port lines A–B," copy that block and apply the listed transformations rather than re-inventing it. The mockup keeps running on `:8899` as the parity reference.

---

## File structure

```
client/
  public/
    avatars/<slug>.png        # copied from mockup (scout,hunter,creative,hermes,beacon,verse)
    models/cosmic-orb.png     # copied from mockup
  src/
    theme/cosmic.css          # NEW design-system tokens + panel/chip/tab/status components
    cosmic/
      CosmicStage.jsx         # NEW React wrapper: mounts canvas, owns scene lifecycle
      scene.js                # NEW createScene(canvas) -> { setAmpDriver, setSpeaking, setStatus, dispose }
      agents.js               # NEW roam/dock state model (pure, testable)
      agents.test.js          # NEW
      CosmicStage.test.jsx    # NEW (mount/unmount cleanup)
    shell/
      TopBar.jsx              # MODIFY: wordmark + NavChips + status dot, cosmic styling
    pages/
      Console.jsx             # REWRITE: CosmicStage + panel shells + MicBar
      Voice.jsx               # MODIFY: import cosmic.css (theme adoption only)
      Factory.jsx             # MODIFY: import cosmic.css (theme adoption only)
```

Scene is split so each module has one job: `scene.js` (WebGL/Three only, no React), `agents.js` (pure state, fully unit-tested), `CosmicStage.jsx` (React lifecycle glue). `neural-map/` is left in place and simply unmounted (deleted in P3).

---

## Task 1: Copy assets into the client

**Files:**
- Create: `client/public/avatars/{scout,hunter,creative,hermes,beacon,verse}.png`
- Create: `client/public/models/cosmic-orb.png`

- [ ] **Step 1: Copy the asset directories**

Run:
```bash
cd ~/ARIA
mkdir -p client/public/avatars client/public/models
cp mockups/aria-cosmic/avatars/*.png client/public/avatars/
cp mockups/aria-cosmic/models/cosmic-orb.png client/public/models/
ls client/public/avatars client/public/models
```
Expected: the 6 avatar PNGs listed under `avatars/`, `cosmic-orb.png` under `models/`. (If the mockup's `avatars/` holds extra files like `README.md`, only the `.png`s are copied by the glob.)

- [ ] **Step 2: Verify they serve**

With the client running (`:5174`), run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5174/models/cosmic-orb.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5174/avatars/scout.png
```
Expected: `200` for both.

- [ ] **Step 3: Commit**

```bash
git add client/public/avatars client/public/models
git commit -m "feat(cosmic): vendor orb + agent avatar assets into client/public"
```

---

## Task 2: Cosmic theme stylesheet

**Files:**
- Create: `client/src/theme/cosmic.css`

The mockup's design tokens + panel/glass/chip/tab/status styling live in `mockups/aria-cosmic/index.html` lines 9–192 (the `<style>` block). Extract them into a real stylesheet.

- [ ] **Step 1: Create `client/src/theme/cosmic.css`**

Start with the token root (ported from the mockup's `:root`), then the structural classes. Begin with this header and port the rest of the `<style>` block beneath it (selectors `.glass`, `.editor`, `.activity`, `.ptab`, `.statdot`, `.micbar`, `.micbtn`, `.roamer`, `.dock`, the `body.aria-busy` / `body.editor-open` / `body.activity-open` recede rules):

```css
:root {
  --teal: #2DD4A8;
  --lime: #C5FF4D;
  --red:  #ff1a2a;
  --bg:   #08090d;
  --ink:  #e8f2ee;
  --muted: #8aa39b;
  --glass-bg: rgba(14,18,22,0.55);
  --glass-bd: rgba(120,230,200,0.14);
  --font: 'Inter', system-ui, -apple-system, sans-serif;
}
.cosmic-root { background: var(--bg); color: var(--ink); font-family: var(--font); }
```

Port the remaining selectors verbatim from lines 9–192, with two changes:
1. Prefix the global `body`/`html` rules so they apply to `.cosmic-root` instead of `body` (e.g. `body.aria-busy .editor` → `.cosmic-root.aria-busy .editor`) — we toggle classes on the Console container, not `document.body`, so other routes are unaffected.
2. Drop any rule targeting `#space` sizing that assumes full-window `body` (the canvas is sized by `CosmicStage`).

- [ ] **Step 2: Verify it imports without error**

Add a temporary import at the top of `client/src/main.jsx`: `import './theme/cosmic.css';` then load `:5174`. Expected: no console error, page still renders. (This import stays — every route gets the theme.)

- [ ] **Step 3: Commit**

```bash
git add client/src/theme/cosmic.css client/src/main.jsx
git commit -m "feat(cosmic): add reusable cosmic theme stylesheet"
```

---

## Task 3: `agents.js` roam/dock state model (TDD)

This is the one piece of P1 with real logic worth testing: mapping each agent's work-state to roam-or-dock, with the **inverted** behavior (working → dock, idle → roam — opposite of the retired `workStates.js`).

**Files:**
- Create: `client/src/cosmic/agents.js`
- Test: `client/src/cosmic/agents.test.js`

The roster (slug, display name, accent color) is defined in `mockups/aria-cosmic/index.html` in the `AGENTS` object (around lines 259–286). Reuse those exact slugs/colors.

- [ ] **Step 1: Write the failing test**

```js
// client/src/cosmic/agents.test.js
import { describe, it, expect } from 'vitest';
import { AGENTS, agentView } from './agents.js';

describe('agentView', () => {
  it('exposes the six cosmic agents', () => {
    expect(Object.keys(AGENTS)).toEqual(
      ['scout', 'hunter', 'creative', 'hermes', 'beacon', 'verse']
    );
  });

  it('docks an agent that is working and shows its task', () => {
    const v = agentView({ hunter: { state: 'working', task: 'Qualifying lead' } });
    const hunter = v.find(a => a.slug === 'hunter');
    expect(hunter.docked).toBe(true);
    expect(hunter.task).toBe('Qualifying lead');
  });

  it('roams an agent that is idle (or unknown)', () => {
    const v = agentView({ hunter: { state: 'idle' } });
    expect(v.find(a => a.slug === 'hunter').docked).toBe(false);
    expect(v.find(a => a.slug === 'scout').docked).toBe(false); // unmentioned => roams
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ~/ARIA/client && npx vitest run src/cosmic/agents.test.js`
Expected: FAIL — cannot resolve `./agents.js`.

- [ ] **Step 3: Implement `agents.js`**

```js
// client/src/cosmic/agents.js
export const AGENTS = {
  scout:    { name: 'Scout',    ac: '#2DD4A8' },
  hunter:   { name: 'Hunter',   ac: '#7C6CE6' },
  creative: { name: 'Creative', ac: '#C5FF4D' },
  hermes:   { name: 'Hermes',   ac: '#5A96DC' },
  beacon:   { name: 'Beacon',   ac: '#ff5a4d' },
  verse:    { name: 'Verse',    ac: '#e6b800' },
};

// Map a work-state record -> render view. Working docks (shows task); everything
// else roams. INVERTS the retired neural-map/workStates.js (which floated on working).
export function agentView(states = {}) {
  return Object.keys(AGENTS).map(slug => {
    const s = states[slug] || {};
    const docked = s.state === 'working';
    return {
      slug,
      name: AGENTS[slug].name,
      ac: AGENTS[slug].ac,
      docked,
      task: docked ? (s.task || 'Working…') : null,
    };
  });
}
```
(If the mockup's `AGENTS` accent colors differ from the placeholders above, replace them with the mockup's exact `ac` values.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cosmic/agents.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/cosmic/agents.js client/src/cosmic/agents.test.js
git commit -m "feat(cosmic): agent roam/dock state model with tests"
```

---

## Task 4: `scene.js` — the cosmic Three.js scene (ported)

**Files:**
- Create: `client/src/cosmic/scene.js`

Port `initThree()` from `mockups/aria-cosmic/index.html` lines 444–656 into a framework-agnostic factory. Apply these transformations:

1. **ESM imports** replace the CDN globals. Header of `scene.js`:
```js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
```
Then every `THREE.EffectComposer` → `EffectComposer`, `THREE.RenderPass` → `RenderPass`, `THREE.UnrealBloomPass` → `UnrealBloomPass`. All other `THREE.*` references stay (they resolve from the `import * as THREE`).

2. **r128 → 0.174 API:** `renderer.outputEncoding = THREE.sRGBEncoding` → `renderer.outputColorSpace = THREE.SRGBColorSpace`; `orbTex.encoding = THREE.sRGBEncoding` → `orbTex.colorSpace = THREE.SRGBColorSpace`. Leave `toneMapping`/`ACESFilmicToneMapping` as-is (unchanged in 0.174).

3. **Drop the dead code** (do not port): the plasma-core block lines 506–556 (`NOISE_GLSL`, `coreUniforms`, `coreMat`, `coreSphere`) and the old teal `ring` (lines 474–487, 575) — both were `.visible=false`. Also remove their references in the animation loop (lines 624–626 `ring.*`, 640–642 `core*`).

4. **Signature + exposed controls** — wrap the function as a factory that returns handles instead of reading the DOM/globals:
```js
export function createScene(canvas) {
  // ... ported body, using `canvas`, `canvas.clientWidth/clientHeight` instead of innerWidth/innerHeight ...
  // Replace window-driven speaking/listening state with locals + setters:
  //   let speaking=false, speakEnd=0, sAmp=0, voiceBright=0, voiceTarget=0;
  //   external amplitude hook: let ampGetter = null;  (P2 feeds real amplitude)
  return {
    setSpeaking(sec = 4.5) { speaking = true; speakEnd = performance.now() + sec*1000; },
    setListening(on)       { voiceTarget = on ? 0.9 : 0; },
    setAmpDriver(fn)       { ampGetter = fn; },   // P2: () => 0..1
    resize()               { /* the ported resize handler body */ },
    dispose()              { /* see step below */ },
  };
}
```
In the loop, where the mockup computes `sAmp` from the simulated `speakTarget`, keep that simulation BUT allow override: `const ext = ampGetter ? ampGetter() : null; const target = ext != null ? ext : speakTarget; sAmp += (target - sAmp)*0.25;`. In P1 `ampGetter` is null, so behavior matches the mockup exactly.

5. **Lifecycle:** the mockup runs an unconditional `requestAnimationFrame` loop and a global resize listener. Make both cancelable:
```js
  let rafId = 0;
  (function loop(){ rafId = requestAnimationFrame(loop); /* ...ported body... */ })();
  const onResize = () => api.resize();
  window.addEventListener('resize', onResize);
  // dispose():
  //   cancelAnimationFrame(rafId);
  //   window.removeEventListener('resize', onResize);
  //   renderer.dispose(); composer?.dispose?.();
  //   scene.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
```

6. **Status callback:** the mockup calls global `setStatus()`. Replace with an optional callback param: `createScene(canvas, { onStatus } = {})` and call `onStatus?.('speaking'|'idle'|'listening')` where the mockup called `setStatus(...)`. Drop the `document.getElementById('michint')` writes (the hint is React-owned now).

- [ ] **Step 1: Write `scene.js`** per the transformations above (port lines 444–656, drop 474–487/506–556/575 and their loop references, apply 1–6).

- [ ] **Step 2: Smoke-check it parses + imports resolve**

Run: `cd ~/ARIA/client && npx vite build 2>&1 | tail -20`
Expected: build succeeds (proves the `three/examples/jsm` import paths resolve under 0.174). If an import path 404s, the file moved — check `node_modules/three/examples/jsm/postprocessing/`.

- [ ] **Step 3: Commit**

```bash
git add client/src/cosmic/scene.js
git commit -m "feat(cosmic): port luminous-orb scene to ESM three (drop dead ring/core)"
```

---

## Task 5: `CosmicStage` React wrapper (TDD cleanup)

**Files:**
- Create: `client/src/cosmic/CosmicStage.jsx`
- Test: `client/src/cosmic/CosmicStage.test.jsx`

- [ ] **Step 1: Write the failing test** (asserts the scene is disposed on unmount — no leaked rAF/WebGL)

```jsx
// client/src/cosmic/CosmicStage.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CosmicStage from './CosmicStage.jsx';

const dispose = vi.fn();
vi.mock('./scene.js', () => ({
  createScene: () => ({ setSpeaking(){}, setListening(){}, setAmpDriver(){}, resize(){}, dispose }),
}));

describe('CosmicStage', () => {
  it('disposes the scene on unmount', () => {
    const { unmount } = render(<CosmicStage status="idle" />);
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/cosmic/CosmicStage.test.jsx`
Expected: FAIL — cannot resolve `./CosmicStage.jsx`.

- [ ] **Step 3: Implement `CosmicStage.jsx`**

```jsx
// client/src/cosmic/CosmicStage.jsx
import { useEffect, useRef } from 'react';
import { createScene } from './scene.js';

export default function CosmicStage({ status = 'idle', speaking = false }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    sceneRef.current = createScene(canvasRef.current);
    return () => { sceneRef.current?.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setListening(status === 'listening'); }, [status]);
  useEffect(() => { if (speaking) sceneRef.current?.setSpeaking(); }, [speaking]);

  return <canvas ref={canvasRef} id="space" className="cosmic-canvas" />;
}
```
Add to `cosmic.css`: `.cosmic-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/cosmic/CosmicStage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/cosmic/CosmicStage.jsx client/src/cosmic/CosmicStage.test.jsx client/src/theme/cosmic.css
git commit -m "feat(cosmic): CosmicStage wrapper with disposed-on-unmount test"
```

---

## Task 6: Rebuild `Console.jsx` as the cosmic layout

**Files:**
- Modify: `client/src/pages/Console.jsx` (full rewrite)
- Modify: `client/src/shell/TopBar.jsx`

P1 renders the cosmic stage + the panel **shells** (real chrome, simulated content) so the layout matches `:8899`. The panels' real data wiring is P2. Port the panel markup from the mockup body (`mockups/aria-cosmic/index.html` lines 214–247: `.editor`/Agent Tasking, `.activity`/`.approvals`, `.dock`, `.micbar`) into JSX.

- [ ] **Step 1: Rewrite `Console.jsx`**

```jsx
// client/src/pages/Console.jsx
import { useEffect, useRef, useState } from 'react';
import CosmicStage from '../cosmic/CosmicStage.jsx';
import { agentView } from '../cosmic/agents.js';
import MicBar from '../shell/MicBar.jsx';

export default function Console({ status = 'idle', speaking = false, onMicToggle }) {
  const rootRef = useRef(null);
  // P1: simulated agent states (P2 replaces with live agent_state).
  const [states] = useState({ beacon: { state: 'working', task: 'Monitoring inbox' },
                              hunter: { state: 'working', task: 'Qualifying lead' } });
  const agents = agentView(states);

  // recede/dim: toggle aria-busy on the cosmic root from voice status
  useEffect(() => {
    rootRef.current?.classList.toggle('aria-busy', status !== 'idle');
  }, [status]);

  return (
    <div className="cosmic-root activity-open editor-open" ref={rootRef}>
      <CosmicStage status={status} speaking={speaking} />

      <aside className="editor glass" id="editor">
        <div className="etitle">Agent tasking</div>
        <div className="sub">Edit, queue &amp; reorder what each agent works on.</div>
        {/* P1: static per-agent blocks; CRUD + dispatch is P3 */}
        {agents.map(a => (
          <div className="ablock" style={{ '--ac': a.ac }} key={a.slug}>
            <div className="ah"><span className="nm">{a.name}</span></div>
          </div>
        ))}
      </aside>

      <section className="activity glass" id="activity">
        <div className="atop"><div className="ptabs">
          <button className="ptab active">Activity</button>
          <button className="ptab">Approvals</button>
        </div></div>
        <div className="asections">{/* P2: real intel/actions */}</div>
      </section>

      <MicBar listening={status === 'listening'} onToggle={onMicToggle} />
    </div>
  );
}
```
(Keep the exact class names from the mockup so `cosmic.css` styles them. If `MicBar`'s current props differ, adapt the call to its real signature — check `client/src/shell/MicBar.jsx` first and match it.)

- [ ] **Step 2: Update `App.jsx` to pass voice state to Console**

In `client/src/App.jsx`, the `<Console .../>` render (around line 355) currently passes `drawerOpen`/`workStates`/metrics. Replace those props with the cosmic ones: `status={ariaStatus}` (derive from existing voice/STT state — `listening`/`processing`/`speaking`/`idle`), `speaking={isSpeaking}`, `onMicToggle={handleMicToggle}`. Reuse whatever state variables already drive the old status; do not add new WebSocket handling (that's P2).

- [ ] **Step 3: Fold NavChips + status dot into TopBar**

In `client/src/shell/TopBar.jsx`, render: wordmark `ARIA`, then `<NavChips active={activeRoute} onNav={onNav} />` (the existing 7-route component, unchanged), then a status dot `<span className={"statdot " + status} />` + label. Apply cosmic classes from `cosmic.css`. Ensure `TopBar` receives `activeRoute`/`onNav`/`status` from `App.jsx`.

- [ ] **Step 4: Live-verify P1 parity**

With all services up, load `:5174` (Console route) and compare to `:8899`:
```bash
# from the preview tooling, capture both for side-by-side
```
Check: orb renders with red+teal halo + bloom; corona rays flutter when status=speaking; 6 agents (beacon/hunter docked, rest roaming); left/right panels styled; mic + status dot present; panels recede/dim when status≠idle. Resize ≥1280px.

- [ ] **Step 5: Confirm no regressions on other routes**

Click to Voice and Factory tabs: they still render (now on the dark theme), and the Console's WebGL context is torn down when you navigate away (no console warnings about lost context / leaked rAF).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Console.jsx client/src/shell/TopBar.jsx client/src/App.jsx
git commit -m "feat(cosmic): cosmic Console layout + nav/status in TopBar"
```

---

## Task 7: Theme adoption on other routes + regression gate

**Files:**
- Modify: `client/src/pages/Voice.jsx`, `client/src/pages/Factory.jsx`

- [ ] **Step 1: Wrap each page in the cosmic root**

In `Voice.jsx` and `Factory.jsx`, wrap the existing top-level returned element in `<div className="cosmic-root"> … </div>` so they pick up the dark teal/lime theme. No layout/behavior changes — full redesigns are follow-on specs.

- [ ] **Step 2: Full regression**

Run:
```bash
cd ~/ARIA/client && npx vitest run
cd ~/ARIA/server && npm test
```
Expected: all green, including the 172 voice tests and the new cosmic tests. (`NeuralMap.test.jsx`/`workStates.test.js` still pass — those files remain until P3.)

- [ ] **Step 3: Commit**

```bash
cd ~/ARIA
git add client/src/pages/Voice.jsx client/src/pages/Factory.jsx
git commit -m "feat(cosmic): adopt cosmic theme on Voice + Factory routes"
```

---

## Phase 1 exit criteria

- `:5174` Console visually matches `:8899` at ≥1280px (orb, halo, corona, bloom, 6 agents roam/dock, both panels, mic, status dot, recede/dim, parallax).
- Navigating away from Console disposes the WebGL scene (no leaked context/rAF).
- Voice + Factory routes render on the cosmic theme; the Voice cloning page still works.
- `client` + `server` test suites green (incl. the 172 voice tests).

**Not in P1 (next plans):** live `agent_state` wiring, real Activity/Approvals data, audio-reactive orb from TTS amplitude (P2); Agent Tasking CRUD → execution, neural-map deletion (P3).
