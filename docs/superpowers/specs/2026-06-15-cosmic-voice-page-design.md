# Cosmic Voice Page — Design (Option B: Studio Panel)

**Date:** 2026-06-15
**Status:** Approved (brainstorm), pending implementation plan
**Scope:** Presentational redesign only — reskin `client/src/pages/Voice.jsx` into the cosmic "Studio Panel" layout. NO behavior/endpoint changes.

## Goal
Bring the Voice management page into the cosmic design system (deep-space bg, teal `#2DD4A8` + lime `#C5FF4D`, Inter, glass panels) so it matches the redesigned Console, while preserving all existing functionality.

## Locked decisions
- **Layout = Option B (Studio Panel)** — chosen over A (Voice Orbs) and C (Soundstage Grid).
- **Presentation only.** Same endpoints (`GET /voices`, `POST /voices?name=`, `POST /voices/active`, `DELETE /voices/:id`), same handlers (`hydrate`, `upload`, `makeActive`, `remove`, `preview`), same `serverUrl` prop, same reachability via the VOICE nav chip in the cosmic TopBar.
- Waveform is a **static CSS motif** (decorative) — no real audio analysis on this page.

## Layout (top → bottom), inside one centered `.glass` panel on `.cosmic-root`
1. **Header** — "Voice" title + subtitle ("ARIA speaks in your active voice").
2. **Active-voice hero** (`ActiveVoiceHero`) — featured card: active voice `name` + `active` pill + waveform motif + **▶ Preview** button (calls `preview()`). Muted empty state ("No active voice yet — set one below") when `active` is null.
3. **Voice list** (`VoiceRow` × N) — each row: orb avatar · `name` · (`active` badge if active, else "Set active" button → `makeActive(voice_id)`) · delete ✕ → `remove(voice_id)`. Empty-state row ("No cloned voices yet — upload one below") when `voices` is empty.
4. **Upload card** (`UploadCard`) — cosmic dropzone styling around the existing name `input` + file `input[type=file]` + "Upload clip" button → `upload()`.
5. Cosmic-styled error line (existing `error` state).

## Components & files
- Modify: `client/src/pages/Voice.jsx` — keep as the page container holding existing state/handlers; render the three new presentational subcomponents. Extract `ActiveVoiceHero`, `VoiceRow`, `UploadCard` (in the same file or a small `voice/` folder — implementer's call, keep focused).
- Modify: `client/src/theme/cosmic.css` — add `.voice-page`, `.voice-hero`, `.voice-row`, `.voice-upload`, `.voice-wave` classes (reuse existing cosmic tokens; no new colors).
- Modify: `client/src/pages/Voice.test.jsx` — assert new structure.

## Data flow (unchanged)
`hydrate()` on mount → `GET /voices` → `{ voices, active }`. `upload`/`makeActive`/`remove` call endpoints then re-hydrate. `preview()` → `voiceEngine.speakWithServer(PREVIEW_LINE, serverUrl, {})`.

## Testing
Extend `Voice.test.jsx`: hero shows the active voice (and empty state when none); rows render for each voice with Set-active/Delete wired; upload button triggers a POST (mock fetch); empty-list state shows. Keep existing behavior assertions green. Full client suite green; build clean.

## Out of scope
- Real-time waveform from audio amplitude (decorative CSS only here).
- Any change to voice cloning behavior, the TTS engine, or server endpoints.
