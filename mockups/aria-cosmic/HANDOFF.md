# ARIA Cosmic Console — Design Handoff

Self-contained, approved **design prototype** for ARIA's redesigned console (voice-first AI cofounder UI).
This is vanilla HTML + Three.js (r128, CDN) — the **design artifact**, not the shipping app. Next step is
porting the approved look into the real React client at `~/ARIA/client`.

## Run it
```
# from a stable static server (already wired as the "cosmic-proto" launch config):
python3 -m http.server 8899 --directory /Users/randyjewell/ARIA/mockups/aria-cosmic
# open http://localhost:8899/   (serves index.html)
```
Demo automation: agents auto-cycle working↔idle; ARIA auto-"speaks" ~every 17s (and when you click the mic,
then click again). Resize ≥1280px wide for the intended layout.

## The design (what's approved & locked)
- **Identity:** teal hero (`#2DD4A8`) + lime accent (`#C5FF4D`) on a deep cosmic background (`~#08090d`). Font Inter.
- **Center = ARIA, the "Luminous Orb":** a generated **cosmic-orb image** (`models/cosmic-orb.png`, galaxy swirl
  in a glass sphere) on a camera-facing plane. A shader turns its black bg transparent (alpha from luminance).
  Slow swirl; **scale 0.9 at rest, grows ~+10% while speaking**; brightens with her voice.
- **Halo:** bright **red + teal** additive halo hugging the orb (teal inner edge → red outer), blooms, grows on speak.
- **Speaking rays:** red corona (`#ff1a2a`) radiating from the orb, fluttering, driven by voice amplitude.
- **Agents (6):** Scout, Hunter, Creative, Hermes, Beacon, Verse — each a generated portrait (`avatars/<slug>.png`)
  in a color-rimmed orb. **Roam when idle, dock top-center when working** (dock card = avatar + live task + progress).
- **Left panel — "Agent Tasking":** collapsible; per-agent task queue with add/remove.
- **Right panel — tabbed "ACTIVITY | APPROVALS":** collapsible.
  - Activity = passive feed (Inbox Replies, Scout/Hunter Tasks, Creative Drafts).
  - **Approvals = human-in-the-loop queue** (avatar + draft title + preview + ✓Approve / Edit / Reject; red count
    badge; "All caught up" empty state).
- **Both side panels recede/dim while ARIA listens/speaks** so focus snaps to the orb. Pointer parallax on the cosmos.
- **Top bar:** wordmark + status dot (idle/listening/processing/speaking). **Bottom:** 64px mic button
  (idle ↔ listening, pulse ring, "TAP OR SAY 'HEY ARIA'").
- **Post-FX:** UnrealBloom (threshold 0.93 so only glows bloom) + sRGB + ACES tonemapping.

## Assets
- `models/cosmic-orb.png` — ARIA's center orb. Swap = drop a new **black-background** square here, reload.
- `avatars/<slug>.png` — the 6 agent portraits (slugs: scout, hunter, creative, hermes, beacon, verse).
- Prompt packs / generation instructions: `avatars/README.md`, `models/README.md`.

## Porting to React (the real next step)
Target: `~/ARIA/client` (Vite + React + Three.js; existing neural-map scene in `src/neural-map/`).
1. Replace the neural-map scene with this cosmic scene (orb plane + halo + rays + bloom via EffectComposer).
   Move CDN `examples/js` scripts to proper `three/examples/jsm` imports.
2. Avatars → `client/public/avatars/`; orb → `client/public/models/cosmic-orb.png`.
3. Wire **agent roam/dock** to live `agent_state` WS events (App.jsx already receives them; note the new behavior
   INVERTS the old `workStates.js` which floated on *working*).
4. Build the **left Agent Tasking** editor (real task CRUD) and the **right Activity/Approvals** tabs against real data.
5. Drive the **speaking rays + orb scale/glow** from real TTS audio amplitude (replace the simulated `sAmp`).
6. Approvals queue → real backend (drafts awaiting sign-off; Approve/Reject actions).

## Decisions log (so they aren't relitigated)
- Tried a humanoid 3D ARIA (image→3D `models/aria.glb`) — **abandoned**: static mesh can't lip-sync (0 bones/
  blendshapes), felt lifeless. Realistic lips = talking-head video (HeyGen/D-ID/Hedra) — kept as a **fallback** only
  (adds cost/latency, loses the 3D model). Randy chose the abstract Luminous Orb (glow + rays = her voice).
- Old teal ring outline + a noise-shader plasma core were both tried and dropped (dead code may remain in `index.html`
  as `ring.visible=false` / `coreSphere.visible=false` — **delete during the port**).
