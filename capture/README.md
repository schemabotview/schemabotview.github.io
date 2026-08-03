# capture — the GraphL recorder

Turns a concept **course** into one **4K MP4** by deep-driving the concept app in headless Chrome.
Dev-only tooling: it lives in the catalog repo for convenience but is **never served** by the
branch-deploy Pages site (`../.gitignore` excludes `node_modules/`, `.tmp/`, `segments/`, `out/`).

```bash
node record-course.mjs <concept> <course> [--force] [--only <tok[,tok]>]
node record-course.mjs apache-spark evolution
```

It spawns the concept app's own `npm run dev` (deterministic, same-origin audio, self-hosted fonts)
and shuts it down when finished. Set `APP_URL` to reuse a server you already have running.

## How it records (the locked contract)

GraphL's granularity is the **beat** (`1 beat = 1 narration line + 1 reveal delta`; timing = clip
length), so **every beat is one concat-safe segment**, and the segments are concatenated (`-c copy`,
no re-encode) into `out/<concept>/<course>.mp4`.

Per beat:
1. `window.__capture.seek(section, beat)` jumps the cursor off the **pure fold** (never off the audio
   `ended` event — a failed clip fetch must not hang a recording).
2. `await window.__captureReady` — the fold + camera fit have painted the frame.
3. Start the Puppeteer `screencast` → hold exactly the clip's duration (ffprobe'd from the `.wav`,
   not from playback) + a short `TAIL_MS` → stop.
4. Mux webm + clip with **concat-safe** settings (forced CFR, fixed timescale, `gradfun` deband,
   identical codec/pix/audio for every segment) → the segment MP4.

**Incremental reuse:** each segment carries a fingerprint sidecar (audio hash + scale/fps/tail/encode
+ sting/pan params). A beat re-records only when missing, changed, `--force`d, or `--only`-matched —
so you can retune one beat and rebuild the course in seconds.

## Per-section bell + transition pan

A **"slide" is per section** (domain model), and in the beat model that's **beat 0 of each section**.
Beat 0 opens with a **bell lead-in** (`STING_MS`, default 2800ms): a synthesized three-note arpeggio
(the same synth as `graphl-movie` — no audio asset), prepended to the segment's audio.

During that lead the camera performs the **section transition pan** — the Ken-Burns move to this
section's band that a plain instant seek would lose in the gap between segments. The beat-0 segment is
a **2-phase drive**: instant-fit to the *previous* section's band (frame 0 = continuous with the prior
segment, even if that beat was reused) → roll → `window.__capture.transition(section, beat, PAN_MS)`
animates the fit to *this* band. The pan runs at `PAN_MS` (default **550ms** = the engine's live
`FIT_MS`), then the camera **rests** on the band for the rest of the bell before narration.

- The pan is deliberately **quick**: a slow multi-second pan at 30fps judders (tiny per-frame motion
  reads as stepping); a fast move reads as smooth motion, matching the live app.
- It only fires **within a scene** and when a previous section exists — the **first section** and any
  **scene change** keep the static bell (no shared band to travel across).

## Environment knobs

| var | default | effect |
|-----|---------|--------|
| `SCALE` | `2` | viewport multiplier; 2 → 3840×2160 (4K). The app auto-scales its 1920×1080 stage. |
| `FPS` | `30` | frame rate (uniform across segments — concat needs it). |
| `TAIL_MS` | `400` | held tail after each clip (breathing room; audio never clipped at the join). |
| `STING_MS` | `2800` | section-start bell lead length. `NO_STING=1` disables the bell entirely. |
| `PAN_MS` | `550` | transition-pan duration (must be ≤ `STING_MS`). |
| `APP_URL` | — | reuse a running dev server instead of spawning one. |
| `FFMPEG` | auto | path to ffmpeg; prefers Homebrew (`libx264` + deband), falls back to Apple HW. |
| `VIDEO_CRF` / `VIDEO_PRESET` / `VIDEO_BITRATE` | `18` / `slow` / `40M` | encode quality. |

## Prerequisites

- **ffmpeg + ffprobe** on PATH — a **Homebrew ffmpeg** is preferred (`libx264` + `gradfun` kills
  dark-gradient banding on YouTube's codec; the `--disable-gpl` PATH ffmpeg bands visibly).
- **Node 22+**, and `npm install` here (Puppeteer).
- Wrap long runs in `caffeinate -dimsu …` so sleep can't interrupt a capture/encode.

## Testing a local engine build (gotcha)

The recorder drives the concept app, which installs `flow-engine` from GitHub (a real copy in
`node_modules`, not a symlink). To test **unreleased** engine changes locally:

1. `cd flow-engine && npm run build`
2. Copy `dist/{flow-engine.js,flow-engine.css,index.d.ts}` into the concept app's
   `node_modules/flow-engine/dist/`.
3. **`rm -rf <concept-app>/node_modules/.vite`** — Vite pre-bundles deps and will otherwise serve the
   **stale** engine from its cache (the copied `dist` is ignored until the cache is cleared).

Once the change is released (commit `dist/`, push, `npm i github:schemabotview/flow-engine`), the
reinstall + a `.vite` clear picks it up legitimately.
