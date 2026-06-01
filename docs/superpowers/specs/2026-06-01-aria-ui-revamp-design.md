# ARIA — UI Revamp Design Spec

**Status:** Approved · awaiting implementation plan
**Date:** 2026-06-01
**Author:** Randy Jewell + collaborator
**Reference mockups:** `/Users/randyjewell/ARIA/mockups/aria-ui-v9-1.html` (final visual direction), `aria-ui-v8.html` (Factory page sibling)

---

## 1. Overview

ARIA is the AI co-founder of **Jack & Jewell Consulting** (Randy Jewell's IT managed services + AI consulting firm, Greenwood, IN). Her existing UI is a sci-fi HUD (teal-on-black, three-column panels, CSS-ring orb) that reads as "weekend project." This revamp replaces it with a **voice-first, 3D-immersive cofounder interface** in the visual lineage of Trillion (hellotrillion.ai) and the technical lineage of Refik Anadol / Active Theory / Edan Kwan.

**Three things change:**

1. **The visual system** — color, type, motion, motifs unified across every surface.
2. **The home screen** — the existing three-column dashboard is replaced by a 3D *neural map* (Data Bloom) with ARIA at its center and her sub-agents orbiting as living forms. The dashboard becomes a slide-up drawer, opened on demand.
3. **The Factory page** — Randy's interface for reviewing Factory-spawned sub-agents (separate spec sibling: `2026-06-01-aria-agent-factory-design.md`).

**What stays unchanged:** the entire backend (Express + WebSocket + Anthropic SDK + Supabase + Edge TTS pipeline). The four real sub-agents (Scout, Hunter, Creative, Hermes). The voice contract (Web Speech API STT in Chrome, Edge Neural TTS server-side). MRR target, business logic, Factory architecture.

---

## 2. Visual System

These tokens apply to every surface — Home, Factory, Clients, Pipeline, Memory, Settings.

### 2.1 Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `rgb(3, 3, 7)` | Page background (Trillion's exact spec — warm near-black, not pure black) |
| `--text` | `#FFFFFF` | Primary text |
| `--text-dim` | `rgba(255,255,255,0.62)` | Secondary text |
| `--text-mute` | `rgba(255,255,255,0.38)` | Labels, meta, tertiary |
| `--accent` | `#C5FF4D` | Lime — single brand accent. Used sparingly: live signals, active state, hero numbers, eyebrow bullets |
| `--warn` | `#F2B04E` | Amber — soon-due, latency near ceiling, spend |
| `--hot` | `#FF6B5C` | Coral — overdue, errors |
| `--info` | `#6FA8DC` | Blue — shadow-mode agents, ambient signals |
| `--border` | `rgba(255,255,255,0.06)` | Hairlines |
| `--border-2` | `rgba(255,255,255,0.12)` | Card edges |
| `--bg-card` | `rgba(255,255,255,0.025)` | Card surfaces (glass over `--bg`) |

Sub-agent colors are persona-bound and DO NOT change between mockups or screens:

| Agent | Hex |
|---|---|
| Scout | `#6BD08F` |
| Hunter | `#E08B5C` |
| Creative | `#B97FE5` |
| Hermes | `#E3CC68` |
| Beacon (proposed Factory agent) | `#6FA8DC` |
| Verse (proposed Factory agent) | `#C078E5` |

Future Factory-spawned agents pick a color from a curated palette during the Factory's spec-writing step. No color collisions allowed.

### 2.2 Typography

Loaded from Google Fonts. Same stack across the app.

| Family | Weights | Use |
|---|---|---|
| **Space Grotesk** | 500, 600, 700 | Display — page titles, hero numbers, brand mark, ARIA's label, agent names. Letter-spacing: `-0.025em` for big sizes, `0.18em` (uppercase) for the "ARIA" mark itself. |
| **Geist** (Vercel) | 400, 500, 600 | Body, panels, tooltips, action rows |
| **Geist Mono** | 400, 500, 600 | All numerics, slugs, code-shaped data, eyebrow labels, pill values |

Sizes — desktop:
- Page title / hero number: 48-128 px (Space Grotesk 600, tight tracking)
- Section title: 22 px (Space Grotesk 600)
- Body: 14 px (Geist 400)
- Meta / eyebrow / pill label: 10-11 px (Geist Mono 500, letterspacing 0.06em, uppercase)

### 2.3 Motif: the `◦` eyebrow

Every label, every section header, every pill is preceded by `◦ ` (small open bullet) rendered in `--accent`. This is the single most distinctive surface element — Trillion uses it heavily and so do we. Implemented globally:

```css
.eyebrow::before { content: "◦ "; color: var(--accent); margin-right: 4px; }
```

### 2.4 Shapes & elevation

- **Pill** — `border-radius: 999px`, used for live status, accents (token usage, MRR, latency)
- **Card** — `border-radius: 12-14px`, `1px solid var(--border)`, `backdrop-filter: blur(8px)`, `var(--bg-card)` background
- **Hairlines** — `1px` solid `var(--border)` instead of shadows
- **No drop shadows** anywhere; depth comes from blur + transparency + bloom

### 2.5 Motion

- **Slow** — most animations 2-7 second cycles. Pills pulse over 2-2.4s. ARIA breathes over 1.5-1.8s.
- **Camera never auto-orbits.** It drifts on a Bezier figure-eight, mouse-parallaxes, breathes FOV. User can grab and rotate at any time.
- **Hover transitions** — 0.15s ease, transform-based, no opacity-only fades.

---

## 3. App Shell

### 3.1 Top Bar (`height: 64px`, `position: fixed`, `backdrop-filter: blur(14px)`)

Left to right:

- **Brand:** "A.R.I.A." (Space Grotesk 600 15px) · separator · "**Jack & Jewell Consulting**" (Geist 500 dim) · location pill ("Greenwood, IN", muted)
- **Pills row:**
  - `◦ tokens · 12.8K · today` (lime dot pulses, counts live)
  - `◦ spend · $0.42` (amber)
  - `◦ MRR · $1,950 · [progress 12%]`
  - `◦ latency · 0.74s` (lime when < 1.0s, amber when ≥ 1.0s)
- **Presence:** pulsing dot + `idle · "hey ARIA"` (or `listening`, `thinking`, `speaking`)

### 3.2 Mic Bar (`position: fixed bottom`, `width: max-1280px`, centered)

A floating glass card. Grid: mic button | text input | latency mini | state pill | dashboard toggle.

- **Mic button** — 40×40 lime when listening, glow ring active
- **Text input** — placeholder: `Type a message or say "hey ARIA"...`
- **Last latency** — `last 0.74s`, lime number
- **State pill** — Idle / Listening (lime) / Thinking (amber) / Speaking (lime)
- **Dashboard toggle** — `Dashboard ▴` reveals the drawer; rotates 180° when open

### 3.3 Page nav chips

Six routes, rendered as horizontal Geist Mono chips below the top bar (Home only): `◦ Console · Factory · Clients · Pipeline · Memory · Settings`. Active chip inverts to lime background.

---

## 4. Neural Map — "Data Bloom"

The home screen's center stage. Three.js v0.174, single canvas, no build step. CDN imports only.

### 4.1 Composition

- **ARIA core** (hub) at origin — high-poly icosphere (radius 1.55, detail 6)
- **Six sub-agent growth tips** (categories) at ring radius 4.7 with Y-jitter and irregular phi — no flat ring
- **~22 leaves** clustered around each growth tip with spherical jitter + sin-wave drift, rendered as pollen swarms (one particle per leaf, plus ambient pollen)

### 4.2 ARIA core — the centerpiece

- `IcosahedronGeometry(1.55, 6)` with **custom GLSL vertex displacement** via layered 3D simplex noise (3 octaves, time-warped). She visibly *warps* and breathes.
- Fragment shader: **thin-film fresnel iridescence** (three-color interference along view angle). Looks like an oil slick over a hot core.
- **Inner ember:** 0.55-radius lime sphere (additive blending) — fakes subsurface scattering on the cheap.
- **Outer translucent shell:** `IcosahedronGeometry(2.05, 3)` with additive fresnel shader, pulses over 0.6 Hz.
- **Two distinguishing wireframe halos** (v9.1 additions):
  - Inner: `WireframeGeometry(IcosahedronGeometry(1.72, 2))` at opacity 0.22, rotates `y: t * 0.1`
  - Outer: `WireframeGeometry(IcosahedronGeometry(2.55, 1))` at opacity 0.09, counter-rotates `y: -t * 0.06`
  - These give ARIA a "constructed / scientific instrument" gravitas — she's not just a blob, she has readable structure.

### 4.3 Dendrites (hub → category edges)

- `CubicBezierCurve3` per dendrite, two perpendicular-offset control points so they CURVE, not straight-line.
- Swept as `TubeGeometry`, manually tapered along U (root-thick, tip-thin).
- Custom shader sends **two traveling energy pulses outward**, speed scaled by `freshness`.
- Tinted to each sub-agent's color.

### 4.4 Growth tips (sub-agents)

Each sub-agent is an **anemone-like radial burst of crisp filaments**, not a sphere.

- 14 short Bezier filament tubes per tip, oriented outward via per-group `lookAt`.
- `TubeGeometry(curve, 20, 0.014, 10, false)` — 20 path segments, 10 radial (v9.1: crisper than v9's 14×6).
- Fragment shader: sharp taper (1.0 → 0.05), narrow shimmer envelope, **tip-glow boost** over last 22% of filament.
- **Bright additive tip ember** at every filament end (small 0.026-radius sphere) — makes each filament read as having a point, not a fadeout.
- Small lime core sphere (0.13) + halo at each tip's anchor.

### 4.5 Pollen (leaves)

- Single `THREE.Points` cloud of ~540 particles across all categories.
- Per-particle attributes: color (inherited from category), size, phase, theta/phi/radius.
- Animated entirely in JS — each cluster orbits its parent tip in spherical coordinates with curl-noise-like wobble in radius.
- Custom point shader: radial alpha falloff + per-particle flicker.
- Size + intensity scaled by freshness (newer leaves glow brighter).

### 4.6 Float-when-active behavior (v9.1)

Each sub-agent has a **work-state machine** with three states:

| State | Behavior |
|---|---|
| `idle` | Anchored at base ring position with gentle bob (`sin(t * 0.42)` etc.) |
| `working` | Detaches from anchor. Orbits in a Lissajous path at radius 1.7 (different X/Y/Z frequencies: 0.65, 0.75, 0.45). Halo pulses harder. Core brightens. A **pulsing leash line** in the agent's color connects current position back to anchor — opacity oscillates 0.32-0.60 at 5 Hz heartbeat. |
| `returning` | Position eases back to anchor over 1.6 seconds with cubic ease-out. Leash fades out. |

**Trigger:** backend pushes WebSocket event `{type: 'agent_state', slug, state: 'working' | 'idle'}` when a sub-agent starts/finishes a task. Front end updates `workStates[slug]` and the animation loop handles the rest.

**Demo behavior** (until backend wired): Beacon cycles working (8s) → returning (1.6s) → idle (2s) → working...

### 4.7 Camera

- `PerspectiveCamera(fov=42, ...)` at `(0, 0.8, 15.5)`
- **No auto-rotate.** OrbitControls present but only respond to user drag.
- **Idle drift:** slow Bezier figure-eight (`sin(t * 0.06) * 2.2 + sin(t * 0.025) * 0.8`)
- **Breathing FOV:** `42 ± 0.9°` over 4-5s cycle
- **Mouse parallax:** subtle offset based on pointer position
- **Damping:** lerp toward desired pose at 0.012/frame so movement feels weighty, not snappy

### 4.8 Post-processing

`EffectComposer` chain:
1. `RenderPass` (scene + camera)
2. `UnrealBloomPass(strength=0.78, radius=0.72, threshold=0.15)`
3. Custom `ShaderPass`:
   - Radius-scaled chromatic aberration (subtle, increases toward screen edges)
   - Vignette (gentle, ~10% darkening at corners)
   - Film grain (low amplitude, animated noise)
4. `OutputPass`

Tone mapping: `ACESFilmicToneMapping`, exposure 1.0. Fog: `FogExp2(0x000005, 0.018)`.

### 4.9 Atmospheric layers

- **Starfield:** 1600 points on shell radius 45-100, white, size 0.08, opacity 0.8
- **Nebula backdrop:** inside-out sphere (radius 85) with shader gradient (deep purple → deep blue), subtle wave modulation
- **Ambient drift:** 220 lime points drifting + wrapping at bounds — gives volume to the space without being a "constellation"

### 4.10 Performance budget

- **60 fps target** on a 2020+ MacBook Pro (verified in v9.1)
- Single canvas, single composer chain
- No GPGPU FBOs (CPU-side pollen is fine at 540 particles; switch to ping-pong only if particle count exceeds 5K)
- Pixel ratio capped at 2 (`min(devicePixelRatio, 2)`)

### 4.11 Interaction

- **Drag** to orbit camera (overrides idle drift; resumes after release)
- **Scroll** to zoom, clamped 7-24 units
- **Hover** — `Raycaster` intersects every node mesh; tooltip shows label + detail + freshness%. Pollen leaves use screen-space proximity fallback since they're a single points cloud.
- **Click** — reserved for v2: opens a node detail panel (left as TODO)

---

## 5. Data Contract

The neural map renders from one JSON endpoint matching Kevin Fremon's schema (Trillion's open-source pattern). This is a one-line swap from the v9.1 mockup's inline `DATA` constant.

### 5.1 Endpoint

```
GET  /neural-map
→ 200 { nodes: [...], edges: [...] }
```

Implemented in `server/src/index.js` alongside existing REST routes.

### 5.2 Node schema

```ts
type Node = {
  id: string;                  // unique slug, e.g. "aria" | "scout" | "pixel-pools"
  type: "hub" | "category" | "leaf";
  label: string;               // display name
  color?: string;              // hex; leaves inherit from parent
  freshness: number;           // 0.0-1.0; how recently this item was updated
  detail: string;              // hover-tooltip body
  parent?: string;             // leaves require this; references a category id
};
```

### 5.3 Edge schema

Edges are derived from `parent` fields server-side. Hub → categories are implicit (every category attaches to ARIA). Categories → leaves come from `node.parent`.

```ts
type Edge = { from: string; to: string };
```

### 5.4 Server query (`server/src/neural-map.js`, new file)

```js
async function buildNeuralMap(tenantId) {
  const nodes = [{ id: "aria", type: "hub", label: "ARIA", color: "#C5FF4D", freshness: 1.0, detail: "..." }];

  // Categories = built-in sub-agents + Factory-approved active spawned agents
  const subagents = [
    { id: "scout",    label: "Scout",    color: "#6BD08F", detail: "Web intelligence..." },
    { id: "hunter",   label: "Hunter",   color: "#E08B5C", detail: "Lead generation..." },
    { id: "creative", label: "Creative", color: "#B97FE5", detail: "Copywriter..." },
    { id: "hermes",   label: "Hermes",   color: "#E3CC68", detail: "Long-running tasks..." },
  ];
  // ...plus query `spawned_agents` table for approved Factory agents

  for (const sa of subagents) {
    nodes.push({ ...sa, type: "category", freshness: computeFreshness(sa.lastUsed) });
  }

  // Leaves = recent memory rows, active clients, pipeline items, intel alerts
  // Each leaf assigned to a category based on its provenance
  const memoryRows  = await sb.from("aria_memory").select("*").eq("tenant_id", tenantId).limit(20);
  const contactRows = await sb.from("contacts").select("*").eq("tenant_id", tenantId);
  // ...build leaves with parent assignments

  return { nodes, edges: [] };  // edges auto-derived client-side from parent fields
}
```

### 5.5 Real-time updates

WebSocket events (extends existing `connectedClients` Set in `server/src/index.js`):

| Event | Payload | Effect |
|---|---|---|
| `agent_state` | `{slug, state: "idle" \| "working" \| "returning"}` | Front-end updates `workStates[slug]`, triggers float animation |
| `freshness_update` | `{id, freshness}` | Single-node shader uniform update, no scene rebuild |
| `node_added` | `{node}` | Inserts a leaf into the scene with spherical jitter |
| `node_removed` | `{id}` | Animates the leaf out (scale → 0 over 0.4s) then removes |
| `map_refresh` | (none) | Triggers a full refetch of `/neural-map` |

---

## 6. Dashboard Drawer

Slides up from the bottom of the viewport on demand. 60vh height. `transform: translateY(100%) → translateY(0)` over 0.4s with `cubic-bezier(0.32, 0.72, 0.34, 1)`.

**Triggered by:** `Dashboard ▴` button in mic bar.
**Closed by:** handle tap, backdrop click, ESC key.

### Contents (top → bottom)

1. **4 compact KPIs** (grid)
   - MRR vs bridge: `$1,950 / $16,500 · 12% · +$350 wk`
   - Pipeline open: `$8,400 · 4 active · 1 hot`
   - Follow-ups: `3 · 2 OVR`
   - Today's spend: `$0.42 · 12.8K tokens · avg 0.74s`

2. **Today's Actions panel** (left column)
   - 5 prioritized rows
   - Marker color: hot (overdue), warn (soon), accent (today), muted (future)
   - Each row: action title + meta + due date

3. **Intel Feed panel** (right column)
   - Last 4 alerts from any sub-agent
   - Each row: sub-agent avatar tile + source eyebrow + message + relative time

Backdrop overlay (`rgba(3,3,7,0.5)` + blur 2px) covers the neural map but doesn't fully obscure it — the user retains visual context.

---

## 7. Routing & Page Structure

Six routes, all sharing the shell (top bar + mic bar + nebula bg). Only the center content changes.

| Route | Center content | Status |
|---|---|---|
| `/` (Console) | Neural map (Data Bloom) | This spec |
| `/factory` | Factory page (agent approval surface) | See sibling spec |
| `/clients` | Client list + detail | Future |
| `/pipeline` | Deals + stages + revenue forecast | Future |
| `/memory` | ARIA's memory inspector | Future |
| `/settings` | Tenant + integrations | Future |

This spec covers `/` and the shell. `/factory` is specified separately. Others are out of scope.

---

## 8. Implementation Notes (for `writing-plans` skill)

### 8.1 What stays from the existing codebase

- `server/` — backend, all routes, sub-agents, agent loop. Add one new route (`/neural-map`) + one WebSocket event type.
- `client/src/Voice.js` — keep entirely. The mic UX wraps this unchanged.
- `client/src/WakeWord.js` — keep entirely.
- `client/src/App.jsx` — all React state, WebSocket handling, voice flow. Refactor into smaller components but logic survives.

### 8.2 What gets replaced

- `client/src/index.css` — full rewrite to the new token system + shell + drawer + nav chips.
- The 3-column HUD JSX inside `App.jsx` — replaced by `<NeuralMap />` + `<DashboardDrawer />` + new top bar + new mic bar components.
- `client/src/components/CosmicOrb.jsx` — deleted. Replaced by `<NeuralMap />` (Three.js, vanilla, mounted into a `<div ref>` from React).
- The cosmic-orb React-three-fiber setup — gone. Neural map uses vanilla Three.js mounted imperatively from a `useEffect`.

### 8.3 New components

```
client/src/
├── App.jsx                     # routing + WS + voice (slimmer)
├── shell/
│   ├── TopBar.jsx              # brand + pills + presence
│   ├── MicBar.jsx              # mic + input + state pills + drawer toggle
│   └── NavChips.jsx
├── neural-map/
│   ├── NeuralMap.jsx           # mounts Three.js scene into a div
│   ├── scene.js                # all Three.js code from v9-1.html, extracted
│   ├── shaders/
│   │   ├── aria-core.vert.glsl
│   │   ├── aria-core.frag.glsl
│   │   ├── filament.frag.glsl
│   │   ├── pollen.vert.glsl
│   │   ├── pollen.frag.glsl
│   │   └── post-grain.frag.glsl
│   └── tooltip.js              # raycaster + DOM tooltip
├── dashboard/
│   ├── DashboardDrawer.jsx
│   ├── KpiStrip.jsx
│   ├── ActionsPanel.jsx
│   └── IntelFeed.jsx
└── pages/
    ├── Console.jsx             # default route — neural map
    ├── Factory.jsx             # (specified in sibling)
    └── ...future
```

### 8.4 Dependency additions

```json
{
  "dependencies": {
    "three": "^0.174.0"
  }
}
```

The current `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing` setup is removed. We use vanilla Three.js because the scene is imperatively rich (custom shaders, postprocessing chain, hand-tuned animation loop) and R3F adds reconciliation overhead we don't need.

### 8.5 Build phases

Suggested phase breakdown for the `writing-plans` skill:

1. **Phase A — Shell** (1 sitting)
   - Token system in CSS, fonts loaded, top bar, mic bar, nav chips
   - Drawer empty, just opens/closes
   - No neural map yet — placeholder canvas
2. **Phase B — Neural map static** (1-2 sittings)
   - Extract `scene.js` from v9-1.html, fix React mounting
   - Inline DATA from v9-1 (mocked)
   - All visual elements: ARIA core, dendrites, growth tips, pollen, atmosphere, postprocessing
   - Hover tooltips, OrbitControls, parallax
3. **Phase C — Real data** (1 sitting)
   - Implement `/neural-map` server route querying Supabase
   - Replace inline DATA with `fetch('/neural-map')`
   - Verify shape matches schema
4. **Phase D — Real-time** (1 sitting)
   - WebSocket events: `agent_state`, `freshness_update`, `node_added`, `node_removed`
   - Hook `workStates` updates
   - Test: trigger a real Scout call, see the float animation
5. **Phase E — Dashboard drawer content** (1 sitting)
   - Wire KPIs, Actions, Intel Feed to real Supabase data
   - Reuse existing panel rendering logic from old HUD where applicable

### 8.6 Backend changes

- `server/src/index.js` — add `app.get('/neural-map', ...)` route + add `agent_state` broadcast helper
- `server/src/neural-map.js` — new file, query Supabase + assemble JSON
- `server/src/agent.js` — emit `agent_state` events from `callTool` (when sub-agent dispatched + when result returned)
- `server/src/subagents/*.js` — no changes needed; the parent's `onEvent` already wraps their lifecycle

---

## 9. Out of scope

- **Mobile/tablet layouts.** Desktop only for v1. The neural map is desktop-grade WebGL work and doesn't have a useful small-screen fallback yet.
- **Accessibility (a11y).** The neural map is a *graphic*, not a control surface. Tooltips are visible-only. v2 will add a keyboard-navigable agent list as the accessible alternative.
- **Light mode.** Trillion's dark mode IS the brand.
- **Animation performance on integrated GPUs.** Targeting Apple Silicon and discrete GPUs. We'll add `prefers-reduced-motion` and a "lite" toggle in a future pass.
- **Other routes** beyond `/` and `/factory`.

---

## 10. Verification checklist

Before marking the implementation complete, the build must:

- [ ] Load on `http://localhost:5173` (or whichever port) and hit 60 fps on Randy's MacBook
- [ ] Time-to-first-paint < 1.5s, time-to-interactive < 2s
- [ ] Neural map renders with real Supabase data (not the mock)
- [ ] Hovering ARIA's core shows her detail tooltip; hovering any sub-agent shows theirs; hovering a pollen leaf shows that leaf's freshness + detail
- [ ] Voice "hey ARIA" still works (WakeWord.js unchanged)
- [ ] Saying "scout, who's hiring in Carmel" causes Scout's growth tip to detach + orbit + pulse leash, then return when Scout completes
- [ ] Dashboard drawer opens via toggle and ESC, shows live data
- [ ] All four live pills update at ≤ 2.5s intervals
- [ ] Latency pill flips amber if a reply takes ≥ 1.0s
- [ ] No console errors. Network tab clean. Frame profiler shows < 16ms/frame at idle.

---

*End of spec. Implementation plan to be generated by the `writing-plans` skill once Randy signs off on this document.*
