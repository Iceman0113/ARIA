# Cosmic Console Port — Phase 2 (Live Data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace P1's simulated data with live sources — agents roam/dock from real `agent_state`, the Activity tab shows real intel/actions, the Approvals tab operates the real `/factory/pending` queue, and the orb pulses to ARIA's real (cloned) voice.

**Architecture:** No new scene work. Thread already-existing App.jsx state (`workStates`, `intel`, `actions`) into the cosmic Console; reuse Factory.jsx's `/factory/pending` + approve/reject/feedback flow via a shared hook; add a TTS `AnalyserNode` tap in `Voice.js` and feed its amplitude into `scene.setAmpDriver`.

**Tech Stack:** React 19, existing WebSocket in App.jsx, existing `/factory/*` endpoints, Web Audio `AnalyserNode`. No new deps.

**Branch:** `feat/cosmic-console-port` (P1 already merged to main; continue here).

**Source-of-truth facts (verified):**
- `App.jsx:184` — `agent_state` handler: `setWorkStates(prev => ({...prev, [msg.slug]: { state: msg.state, updatedAt: Date.now() }}))`. So `workStates` is `{ slug: { state, updatedAt } }` and `state` is what `agentView` keys on.
- `App.jsx:324-331` — `actions` (from `metrics.actions`, max 5) and `intel` (from `alerts`, max 4) are already computed arrays.
- `Factory.jsx` — already fetches `/factory/pending` + `/factory/agents`, refreshes on WS kinds `['factory.task_ready','factory.task_failed','factory.task_rejected', ...]`, and POSTs `/factory/tasks/:id/{approve,reject,feedback}`.
- `Voice.js` — TTS playback is a plain `new Audio(url)` element (`speakWithServer`, ~line 233), NOT routed through the existing mic `audioCtx`. `cosmic/scene.js` exposes `setAmpDriver(fn)` where `fn()` returns `0..1`.
- `cosmic/agents.js` `agentView(states)` already maps `state==='working'` → `docked` (tested).

---

## Task 1: Live agent roam/dock from `agent_state`

**Files:**
- Modify: `client/src/App.jsx` (pass `workStates` to Console)
- Modify: `client/src/pages/Console.jsx` (consume `workStates` instead of simulated `states`)

- [ ] **Step 1: Pass `workStates` into Console.** In `App.jsx`, the `<Console .../>` render currently passes `status`, `speaking`, `orbState`, `...micBarProps`. Add `workStates={workStates}` (the state already exists at `App.jsx:51`).

- [ ] **Step 2: Consume it in Console.** In `client/src/pages/Console.jsx`, replace the P1 simulated `const [states] = useState({...})` with the prop: `export default function Console({ status='idle', speaking=false, workStates={}, onMicToggle, ...micBarProps })` and `const agents = agentView(workStates);`. The `agent_state` events carry `{slug, state}`; `agentView` already maps `state==='working'` → docked. (Docked task label: `agentView` falls back to `'Working…'` when no `task` — acceptable; if `agent_state` later includes a label, thread it through `workStates` then.)

- [ ] **Step 3: Manual verify (live).** With the stack running, the dock/roam now reflects real agent state. Since live `agent_state` events may be quiet, verify by injecting one via the browser console on `:5174`:
  `window.__ARIA_TEST__` is not available, so instead confirm logic via the existing unit test (Step 4) and a console check: in the preview, run `document.querySelectorAll('.roamer').length` (expect 6 when no agent is working, fewer when some dock).

- [ ] **Step 4: Test — agentView already covers the mapping.** Add one Console-level test asserting it reads the prop. Create/extend `client/src/pages/Console.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('../cosmic/CosmicStage.jsx', () => ({ default: () => null }));
vi.mock('../shell/MicBar.jsx', () => ({ default: () => null }));
import Console from './Console.jsx';

describe('Console live agents', () => {
  it('docks an agent that is working in workStates', () => {
    const { container } = render(
      <Console status="idle" workStates={{ hunter: { state: 'working' } }} />
    );
    // a docked agent renders a .dcard; roamers render .roamer
    expect(container.querySelector('.dcard')).toBeTruthy();
  });
});
```
Run: `cd /Users/randyjewell/ARIA/client && npx vitest run src/pages/Console.test.jsx` → PASS (adjust the asserted selector to the real docked-card class used in Console.jsx if different — read Console.jsx first).

- [ ] **Step 5: Commit**
```bash
cd /Users/randyjewell/ARIA
git add client/src/App.jsx client/src/pages/Console.jsx client/src/pages/Console.test.jsx
git commit -m "feat(cosmic): live agent roam/dock from agent_state workStates

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Activity tab from real intel/actions

**Files:**
- Modify: `client/src/App.jsx` (pass `intel`, `actions` to Console)
- Modify: `client/src/pages/Console.jsx` (render them in the Activity tab)

- [ ] **Step 1: Pass the data.** In `App.jsx`, add `intel={intel}` and `actions={actions}` to the `<Console .../>` render (both already computed at `App.jsx:324-331`).

- [ ] **Step 2: Render in the Activity tab.** In `Console.jsx`, accept `intel=[]`, `actions=[]`. In the `.activity` panel's Activity section (currently the P2 placeholder "Activity will appear here"), render the items. Mirror the mockup's `.asec`/`.acard` structure (see `mockups/aria-cosmic/index.html` `renderActivity`, ~lines 340-352): group into sections, each item an `.acard` with a title line + subtitle. Map `actions` and `intel` to cards (e.g. an "Actions" section and an "Intel" section). Keep the empty-state text when both are empty. Tab switching (Activity|Approvals) can stay simple local `useState` (show one section at a time).

- [ ] **Step 3: Test.** Extend `Console.test.jsx`:
```jsx
it('renders activity cards from intel/actions', () => {
  const { container } = render(
    <Console status="idle"
      actions={[{ title: 'Follow up Acme', detail: 'overdue' }]}
      intel={[{ title: 'Competitor X shipped', detail: '2h ago' }]} />
  );
  expect(container.querySelectorAll('.acard').length).toBeGreaterThanOrEqual(2);
});
```
(Adjust field names to the real `actions`/`intel` shape — read `App.jsx:324-331` for the exact keys, e.g. `title`/`detail`/`time`, and use those in both the component and the test.)
Run: `npx vitest run src/pages/Console.test.jsx` → PASS.

- [ ] **Step 4: Commit**
```bash
git add client/src/App.jsx client/src/pages/Console.jsx client/src/pages/Console.test.jsx
git commit -m "feat(cosmic): Activity tab from live intel/actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Approvals tab from `/factory/pending` (shared hook)

**Files:**
- Create: `client/src/shell/useApprovals.js` (extracted, reusable)
- Modify: `client/src/pages/Console.jsx` (Approvals tab uses the hook)
- Test: `client/src/shell/useApprovals.test.js`

Reuse Factory.jsx's proven flow. Extract it into a hook so the Console Approvals tab and the Factory page share one implementation (DRY).

- [ ] **Step 1: Read `client/src/pages/Factory.jsx`** fully to copy its exact `fetchJSON` base URL handling, the `/factory/pending` fetch, the WS-refresh event kinds, and the approve/reject/feedback calls.

- [ ] **Step 2: Write the hook `client/src/shell/useApprovals.js`:**
```js
import { useEffect, useState, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || ''; // match Factory.jsx's base; read it and copy exactly
async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export function useApprovals(ws) {
  const [pending, setPending] = useState([]);
  const hydrate = useCallback(async () => {
    try { setPending(await fetchJSON('/factory/pending') || []); } catch { /* keep prior */ }
  }, []);
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!ws) return;
    const onMsg = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (['factory.task_ready','factory.task_failed','factory.task_rejected'].includes(m.kind)) hydrate();
    };
    ws.addEventListener('message', onMsg);
    return () => ws.removeEventListener('message', onMsg);
  }, [ws, hydrate]);
  const approve = useCallback(async (id) => { await fetchJSON(`/factory/tasks/${id}/approve`, { method: 'POST' }); await hydrate(); }, [hydrate]);
  const reject  = useCallback(async (id) => { await fetchJSON(`/factory/tasks/${id}/reject`,  { method: 'POST' }); await hydrate(); }, [hydrate]);
  return { pending, approve, reject, hydrate };
}
```
(IMPORTANT: read Factory.jsx and make the `API`/`fetchJSON` base IDENTICAL to what Factory uses — do not guess the env var name. Refactor Factory.jsx to use this hook too if it's a clean drop-in; if that risks regressions, leave Factory.jsx and just share the hook in Console — note which you did.)

- [ ] **Step 3: Wire the Approvals tab in `Console.jsx`.** Accept a `ws` prop (pass `wsRef.current` from App.jsx — App already passes `ws` to Factory). `const { pending, approve, reject } = useApprovals(ws);`. In the Approvals section render each pending item as the mockup's `.apv` card (avatar + title + preview + ✓Approve / Reject), with the red count badge on the tab (`pending.length`) and the "All caught up" empty state (see mockup `renderApprovals`, ~lines 355-369).

- [ ] **Step 4: Pass `ws` from App.jsx** to `<Console ... ws={wsRef.current} />`.

- [ ] **Step 5: Test the hook** with a mocked `fetch`:
```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApprovals } from './useApprovals.js';

beforeEach(() => { global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => [{ id: 't1', title: 'Draft' }] })); });

describe('useApprovals', () => {
  it('hydrates pending on mount', async () => {
    const { result } = renderHook(() => useApprovals(null));
    await waitFor(() => expect(result.current.pending.length).toBe(1));
  });
});
```
Run: `npx vitest run src/shell/useApprovals.test.js` → PASS.

- [ ] **Step 6: Commit**
```bash
git add client/src/shell/useApprovals.js client/src/shell/useApprovals.test.js client/src/pages/Console.jsx client/src/App.jsx
# + Factory.jsx if refactored to use the hook
git commit -m "feat(cosmic): Approvals tab on shared /factory/pending hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Audio-reactive orb from real TTS amplitude

**Files:**
- Modify: `client/src/Voice.js` (tap the TTS playback element with an AnalyserNode; expose amplitude)
- Create: `client/src/audio/useVoiceAmplitude.js`
- Modify: `client/src/cosmic/CosmicStage.jsx` (feed amplitude to `scene.setAmpDriver`)
- Modify: `client/src/pages/Console.jsx` + `App.jsx` (thread the voice engine / amplitude getter to CosmicStage)

- [ ] **Step 1: Tap TTS playback in `Voice.js`.** Read `Voice.js` `speakWithServer` (~line 185-246). Where it does `const audio = new Audio(url); ... audio.play()`, add an analyser:
```js
// lazily create a dedicated playback audio context + analyser
if (!this.ttsCtx) { this.ttsCtx = new (window.AudioContext || window.webkitAudioContext)(); }
const srcNode = this.ttsCtx.createMediaElementSource(audio);
const analyser = this.ttsCtx.createAnalyser();
analyser.fftSize = 256;
srcNode.connect(analyser); analyser.connect(this.ttsCtx.destination);
this._ttsAnalyser = analyser;
```
Add a method `getTtsAmplitude()` that returns a smoothed `0..1`:
```js
getTtsAmplitude() {
  if (!this._ttsAnalyser) return 0;
  const a = this._ttsAnalyser; const buf = new Uint8Array(a.fftSize);
  a.getByteTimeDomainData(buf);
  let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i]-128)/128; sum += v*v; }
  return Math.min(1, Math.sqrt(sum / buf.length) * 3); // RMS, scaled
}
```
On `audio.onended`/cleanup, null out `this._ttsAnalyser` (so amplitude returns 0 when not speaking). Guard `createMediaElementSource` (an element can only be sourced once) — create the analyser per playback for the new element. Keep existing playback behavior intact (still connect to destination so audio is audible).

- [ ] **Step 2: Hook `client/src/audio/useVoiceAmplitude.js`:**
```js
// Returns a stable getter () => 0..1 reading the live TTS amplitude from the voice engine.
export function useVoiceAmplitude(voice) {
  return () => (voice && typeof voice.getTtsAmplitude === 'function' ? voice.getTtsAmplitude() : 0);
}
```

- [ ] **Step 3: Feed CosmicStage.** Give `CosmicStage` an optional `ampGetter` prop; in the mount effect (or a dedicated effect) call `sceneRef.current?.setAmpDriver(ampGetter)` when provided:
```jsx
useEffect(() => { if (ampGetter) sceneRef.current?.setAmpDriver(ampGetter); }, [ampGetter]);
```
(scene.js already overrides the simulated `sAmp` with `ampGetter()` when set — P1 Task 4 wired this.)

- [ ] **Step 4: Thread the voice engine.** App.jsx owns the `VoiceEngine` instance (find it — likely `voice` from an import/singleton). Pass it (or `useVoiceAmplitude(voice)`'s getter) to `<Console ... ampGetter={ampGetter} />`, and Console passes it to `<CosmicStage ampGetter={ampGetter} />`. If the voice engine isn't easily reachable in App's render scope, expose the getter from wherever `speakWithServer` is invoked.

- [ ] **Step 5: Live verify.** Trigger ARIA to speak (mic, or type + submit) and confirm the orb/halo/corona visibly react to her voice (the cloned "Maggie" voice). Capture a before/after note. (No unit test for the WebAudio tap — it needs a real audio element; the scene override path was already unit-covered indirectly. Add a trivial test for `useVoiceAmplitude` returning 0 when voice is null.)

```js
import { describe, it, expect } from 'vitest';
import { useVoiceAmplitude } from './useVoiceAmplitude.js';
describe('useVoiceAmplitude', () => {
  it('returns 0 without a voice engine', () => { expect(useVoiceAmplitude(null)()).toBe(0); });
});
```

- [ ] **Step 6: Commit**
```bash
git add client/src/Voice.js client/src/audio/useVoiceAmplitude.js client/src/audio/useVoiceAmplitude.test.js client/src/cosmic/CosmicStage.jsx client/src/pages/Console.jsx client/src/App.jsx
git commit -m "feat(cosmic): audio-reactive orb driven by real TTS amplitude

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Regression + live verification gate

- [ ] **Step 1:** `cd /Users/randyjewell/ARIA/client && npx vitest run` → all green (P1 + new P2 tests).
- [ ] **Step 2:** `cd /Users/randyjewell/ARIA/server && npm test` → all green (117).
- [ ] **Step 3:** `cd /Users/randyjewell/ARIA/client && npx vite build` → success.
- [ ] **Step 4: Live (preview MCP, ≥1280px, past the Setup gate):** agents dock when a real `agent_state` working event arrives; Activity tab shows real intel/actions; Approvals tab lists `/factory/pending` and Approve/Reject work; the orb reacts to ARIA's spoken (cloned) voice. No console errors.

## Phase 2 exit criteria
- No simulated data left in the Console: agents, Activity, Approvals all read live sources; orb amplitude is real TTS.
- Approve/Reject operate the real factory queue (shared hook; Factory page unaffected or refactored onto the same hook).
- Client + server suites green; build clean.

**Not in P2 (P3):** Agent Tasking CRUD → `dispatch_to_<slug>` execution; the `agent_tasks` table + endpoints; deleting `neural-map/`.
