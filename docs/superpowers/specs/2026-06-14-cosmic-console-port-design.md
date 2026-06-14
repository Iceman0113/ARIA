# ARIA Cosmic Console Port — Design

**Date:** 2026-06-14
**Status:** Approved (brainstorm), pending implementation plan
**Visual reference:** `mockups/aria-cosmic/` (run `python3 -m http.server 8899 --directory mockups/aria-cosmic`, open http://localhost:8899/)
**Source handoff:** `mockups/aria-cosmic/HANDOFF.md`

## Goal

Port the approved **Cosmic Console** design prototype into the real React client at
`client/`, replacing the current neural-map Console with the cosmic scene + layout, wired
to live data, with the left Agent Tasking panel fully wired to autonomous agent execution
behind a human approval gate.

The cosmic look stops living only as a standalone static mockup on `:8899` and *becomes*
the Console route on `:5174`.

## Decisions (locked — do not relitigate)

- **Full port**, not a cut-down version (user choice).
- **Agent Tasking is fully wired to execution** — adding a task dispatches it to that agent
  to run autonomously; every result is gated behind human approval before any outward action.
- **Other pages (Voice, Factory, …) get a full cosmic redesign**, but as **follow-on specs**,
  not in this one (they have no approved mockup — they need their own design pass). This spec
  ships a reusable cosmic **design system** so every page immediately adopts the theme and the
  full per-page redesigns are fast. **The Voice page is the first follow-on spec, and it is
  design-first**: it begins by putting cosmic Voice-page mockups in front of the user to choose
  "the look I want" before any code.
- **Approach A — phased, visible-first.** One spec, strict phase order, each phase
  independently shippable and verifiable on `:5174`.

Carried over from the mockup's own decisions log (HANDOFF.md), still binding:
- ARIA is the abstract **Luminous Orb** (glow + rays = her voice). The humanoid 3D model and
  talking-head video were tried and abandoned/kept-as-fallback-only.
- The old teal ring outline + noise-shader plasma core are dropped — not ported.

## Architecture & module layout

`App.jsx` stays the orchestrator (WebSocket hub, routing via `activeRoute`/`NavChips`, voice/STT
state). New pieces plug into it; it is not rewritten.

```
client/src/
  cosmic/
    CosmicStage.jsx        # React wrapper: mounts canvas, owns lifecycle, props -> scene
    scene.js               # Three.js scene: orb + halo + rays + bloom (EffectComposer)
    orb.js                 # luminance->alpha shader plane; scale/glow driven by {amp, speaking}
    halo.js                # red+teal additive halo
    rays.js                # red speaking corona, amplitude-driven
    agents.js              # 6 agent sprites; roam (idle) <-> dock (working) logic
    shaders/*.glsl.js      # ported shaders (same pattern as neural-map/shaders)
  shell/
    TopBar.jsx             # (exists) wordmark + NavChips(7 routes incl Voice) + status dot
    MicBar.jsx             # (exists) reused unchanged
    NavChips.jsx           # (exists) restyled into cosmic TopBar
    AgentTasking.jsx       # LEFT panel: per-agent task queue + add/remove (P3)
    ActivityApprovals.jsx  # RIGHT panel: tabbed Activity | Approvals
    panels.css
  audio/
    useVoiceAmplitude.js   # AnalyserNode tapped off Voice.js TTS playback -> amp 0..1
  theme/
    cosmic.css             # design system: tokens, panel/orb/chip components, dark teal-lime
  pages/
    Console.jsx            # rebuilt: CosmicStage + left/right panels (replaces neural-map mount)
    Voice.jsx              # P1: light theme adoption only; full redesign = follow-on spec
    Factory.jsx            # P1: light theme adoption only; full redesign = follow-on spec
```

**Reused as-is:** `App.jsx` WS handling (`agent_state`, `metrics`, …), `Voice.js`
(`AudioContext` + playback — add an analyser tap), `/factory/pending` +
`/factory/tasks/:id/{approve,reject,feedback}`, `/neural-map` + `/factory/agents` for roster.

**Retired (deleted in P3, not P1):** `neural-map/scene.js` + its shaders + `workStates.js`.
Kept on disk/history until the cosmic scene is proven through P1–P3.

**Design system (`theme/cosmic.css`):** teal hero `#2DD4A8`, lime accent `#C5FF4D`, deep cosmic
bg `~#08090d`, font Inter; panel, orb-chrome, chip, tab, and status-dot components. Every route
imports it so nothing clashes; follow-on per-page redesigns build on it.

## Navigation & the Voice tab

The cosmic console is immersive but the app has **7 routes**. `NavChips` (all 7, including
**Voice**) folds into the cosmic `TopBar`, restyled to the cosmic aesthetic, and dims with the
chrome while ARIA listens/speaks. The Three.js stage mounts/unmounts with the **Console route
only** — other routes do not run the GPU scene. In this spec the Voice and Factory pages adopt
the design-system theme but keep their current layouts/behavior; their full redesigns are
follow-on specs (Voice first, design-first).

## Phase 1 — Look (visual parity, simulated data)

**Three.js port:** mockup's r128 CDN globals (`EffectComposer`, `RenderPass`, `UnrealBloomPass`,
`ShaderPass`) become `three/examples/jsm/...` ESM imports against installed `three@0.174` — same
ESM pattern the existing `neural-map/scene.js` already uses. Renderer: sRGB output + ACES
tonemapping; rAF loop owned by `CosmicStage`, cleaned up on unmount.

Scene (each its own small module, composed in `scene.js`):
- **orb** — camera-facing plane textured with `public/models/cosmic-orb.png`; fragment shader
  derives alpha from luminance (black bg -> transparent), slow UV swirl. Uniforms `{amp, speaking}`.
  Rest scale `0.9`, speaking `~1.0` (+10%), brightness scales with `amp`.
- **halo** — additive radial mesh, teal `#2DD4A8` inner -> red `#ff1a2a` outer; grows on speak.
- **rays** — red corona `#ff1a2a` radiating from orb, per-ray flutter modulated by `amp`.
- **agents** — 6 sprites (`public/avatars/<slug>.png`) in color-rimmed orbs. P1: simulated roam
  cycle; roam/dock *logic* lives here so P2 only swaps the data source.
- **bloom** — `EffectComposer`: `RenderPass` -> `UnrealBloomPass(threshold 0.93)` -> output.

Dead code from the mockup (`ring.visible=false`, `coreSphere.visible=false`, plasma core) is
**not** ported.

**Assets:** `mockups/aria-cosmic/avatars/*` -> `client/public/avatars/`; `models/cosmic-orb.png`
-> `client/public/models/cosmic-orb.png`.

**Layout shell (CSS):** full-viewport stage, canvas behind; overlay layers = TopBar (+ nav +
status dot), left/right panels (P1 = styled static shells), MicBar (reused). Two presentation
behaviors land here:
- **Recede/dim** — panels fade + translate outward on status `listening`/`speaking` (CSS class
  from `App.jsx` voice state).
- **Pointer parallax** — cosmos/orb shift with mouse position.

**P1 exit bar:** `:5174` Console visually matches `:8899` at >=1280px — orb, halo, rays, bloom,
6 roaming agents, both panels styled, mic + status dot — data still simulated.

## Phase 2 — Live data wiring

- **Agent roam/dock <- `agent_state` WS.** `App.jsx` already receives it; route into `agents.js`.
  **Behavior inverts old `workStates.js`**: dock when working, roam when idle. Fresh mapping in
  `agents.js` (do not reuse `workStates.js`). Docked agent shows avatar + live task + progress.
- **Activity tab <- existing intel/actions** arrays already passed into Console (used by
  `IntelFeed`/`ActionsPanel`); render in cosmic feed style. No backend change.
- **Approvals tab <- `/factory/pending`** + refresh on relevant WS event; each item = avatar +
  draft title + preview + Approve/Edit/Reject, red count badge, "all caught up" empty state;
  actions call `/factory/tasks/:id/{approve,reject,feedback}`. This is the human-in-the-loop gate
  that P3's agent outputs also flow into.
- **Audio-reactive orb <- `AnalyserNode`** in `useVoiceAmplitude.js`, tapping `Voice.js`'s
  existing `AudioContext`: route playing TTS audio through an analyser, compute smoothed `0..1`
  amplitude per frame, feed scene `{amp, speaking}`. Drives orb scale/brightness + ray flutter
  from ARIA's real cloned voice. Replaces simulated `sAmp`.
- **Status dot <- voice state** (idle/listening/processing/speaking) from `App.jsx` — same state
  that drives recede/dim.

**P2 exit bar:** agents dock on real work, Activity shows real intel, Approvals operates the real
factory queue, orb pulses to ARIA's real voice.

## Phase 3 — Agent Tasking -> execution (behind the approvals gate)

Rides the existing dispatch substrate (`factory/dispatch-tool.js` builds `dispatch_to_<slug>`;
`factory/runtime.js` `ConfigDrivenAgent`; specialization is configuration). Per-agent work is
config + prompt, not new code per agent.

1. **6 personas as config-driven agents** in the factory registry (Supabase, where Echo lives):
   slug + system prompt/role + **scoped tool allowlist**. `scout`/`hunter` point at existing
   capabilities (`subagents/scout.js`, lead hunting). `creative`/`hermes`/`beacon`/`verse` are
   new persona configs starting **read-mostly**; toolsets expand later.
2. **Task lifecycle** (thin layer over the factory state machine):
   `queued -> running -> awaiting_approval -> approved | rejected -> done`.
   New Supabase table `agent_tasks (id, slug, text, state, result, created_at)` + endpoints
   `POST /agents/:slug/tasks`, `GET /agents/:slug/tasks`, `DELETE /agents/:slug/tasks/:id`. Enqueue calls
   `dispatch_to_<slug>` with the task text; `ConfigDrivenAgent.run()` executes; output written
   back as `awaiting_approval`.
3. **Safety spine:** every agent result lands in the **same Approvals queue from P2**. Agents
   draft; the human approves. No outward-action tool (send email, post, spend) fires without an
   explicit Approve — enforced by per-persona allowlists + approval gating. (This is why
   Approvals is built in P2.)
4. **Loop to the scene:** running task docks the agent, empty queue roams it — reuse P2's
   `agent_state` path, now driven by real task state.
5. **Cleanup:** delete retired `neural-map/` + `workStates.js`.

**P3 exit bar:** queue a task to any of the 6 agents from the console, it executes autonomously,
its result waits for one-click approval before anything leaves the system.

## Testing & verification

- **Unit (Vitest):** `agents.js` state mapping incl. the inversion; `useVoiceAmplitude` smoothing;
  Approvals/Activity render from fixtures; `AgentTasking` add/remove reducer. Follows existing
  `*.test.jsx` pattern.
- **Backend (P3):** task-lifecycle transitions + `/agents/:slug/tasks` endpoints, alongside
  existing factory tests.
- **Scene:** not unit-tested (GPU/visual); `CosmicStage` mount/unmount cleanup *is* tested
  (no leaked contexts/animation frames).
- **Live per phase:** P1 screenshot parity vs `:8899` at >=1280px; P2 real agent_state + cloned-voice
  speak -> dock + orb reacts + operate one approval; P3 queue -> dock -> approve -> complete.
- **Regression:** full `npm test` (client + server) green before each phase merges; the 172 voice
  tests stay green.

## Out of scope (this spec)

- Full per-page cosmic redesigns of Voice, Factory, and other routes (follow-on specs; Voice first,
  design-first).
- Expanding the `creative`/`hermes`/`beacon`/`verse` toolsets beyond a read-mostly starting set.
- Talking-head video / humanoid 3D ARIA (explicitly abandoned in the mockup decisions log).

## Follow-on specs (sequenced)

1. **Cosmic Voice page** — design-first (mock options -> user picks -> build) on the design system.
2. **Cosmic Factory page.**
3. Remaining routes.
4. Persona toolset expansion (grant `creative`/`hermes`/`beacon`/`verse` real outward tools, each
   still behind the approval gate).
