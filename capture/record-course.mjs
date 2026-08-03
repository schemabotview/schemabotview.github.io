// record-course.mjs — the GraphL capture pipeline: a concept-course → one 4K MP4.
//
//   node capture/record-course.mjs <concept> <course> [--force] [--only <tok[,tok]>]
//   node capture/record-course.mjs apache-spark evolution
//
// This is the CAPTURE half + the MERGE half in one file, because GraphL's granularity is the
// BEAT (`1 beat = 1 narration line + 1 reveal delta`; timing = clip length), not the section:
// every beat is recorded as its own concat-safe segment, then the segments are concatenated
// (`-c copy`, no re-encode) into out/<concept>/<course>.mp4.
//
// How one beat is recorded (the locked capture contract — see ../CLAUDE.md):
//   drive the concept app in ?capture=1 mode → window.__capture.seek(section, beat) jumps the
//   cursor off the PURE FOLD → await window.__captureReady (the fold + instant camera fit have
//   painted the frame) → start the Puppeteer screencast → hold exactly the clip's duration →
//   stop → mux the clip. Never driven off the audio `ended` event: a failed clip fetch can't
//   hang the record, because timing comes from ffprobe-ing the wav, not from playback.
//
// The recorder spawns the concept app's own `npm run dev` (deterministic, same-origin audio,
// self-hosted fonts) and shuts it down when done. Set APP_URL to reuse a server you started.
//
// Prerequisites: ffmpeg + ffprobe on PATH (Homebrew ffmpeg preferred — libx264 + deband).

import { execFile, spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha = (data) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const pad2 = (n) => String(n).padStart(2, '0')
const readJson = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }

// ---- YouTube-compatible frame -----------------------------------------------------------
// The app's stage is a fixed 1920×1080 (16:9). page.screencast() records at the CSS viewport
// size (it ignores deviceScaleFactor), so we enlarge the VIEWPORT to W·SCALE × H·SCALE: the
// player's useFitScale auto-scales the 1920×1080 stage to fill it, so text re-rasterizes crisp
// at SCALE×. SCALE=2 → 3840×2160 = 4K UHD (YouTube's 2160p), still exactly 16:9.
const W = 1920
const H = 1080
const SCALE = process.env.SCALE ? +process.env.SCALE : 2
const CW = W * SCALE
const CH = H * SCALE
const FPS = process.env.FPS ? +process.env.FPS : 30
// A brief held tail after each clip so beats breathe and audio is never clipped at the join.
const TAIL_MS = process.env.TAIL_MS ? +process.env.TAIL_MS : 400
// A brand "sting" — a synthesized three-note bell arpeggio (no audio asset) — plays as a LEAD-IN at
// the START OF EACH SECTION (a "slide"): the section's opening frame is held for STING_MS with the
// bell, then narration begins. Only a section's FIRST beat (beat 0) gets the lead. Reused verbatim
// from graphl-movie so it's the identical sound. STING_MS=0 or NO_STING disables it.
const STING_MS = process.env.NO_STING ? 0 : process.env.STING_MS ? +process.env.STING_MS : 2800
const STING_SIG = STING_MS > 0 ? `bell-arp:v1:${STING_MS}` : 'none'
// The per-section transition PAN runs at the engine's live fit speed (FIT_MS ≈ 550ms) by default: a
// quick move reads smoothly, whereas a slow multi-second pan at 30fps judders (tiny per-frame motion
// reads as stepping). It plays at the START of the bell lead; the camera then rests on the band for
// the remainder before narration. PAN_MS must be ≤ STING_MS (it fits inside the bell window).
const PAN_MS = process.env.PAN_MS ? +process.env.PAN_MS : 550

// Prefer a Homebrew ffmpeg (libx264 + gradfun deband kills dark-gradient banding on YouTube's
// codec); fall back to Apple hardware, then plain ffmpeg.
const FFMPEG =
  process.env.FFMPEG ??
  ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(existsSync) ??
  'ffmpeg'
const HAS_X264 = FFMPEG !== 'ffmpeg'
const VIDEO_CODEC = process.env.VIDEO_CODEC ?? (HAS_X264 ? 'libx264' : 'h264_videotoolbox')
const IS_X26X = /^libx26[45]$/.test(VIDEO_CODEC)
const CRF = process.env.VIDEO_CRF ?? '18'
const PRESET = process.env.VIDEO_PRESET ?? 'slow'
const BITRATE = process.env.VIDEO_BITRATE ?? '40M' // 4K needs more than 1080p's 16M
const ENCODE_SIG = IS_X26X ? `${VIDEO_CODEC}:crf${CRF}:${PRESET}` : `${VIDEO_CODEC}:b${BITRATE}`

// ---- ffmpeg helpers ---------------------------------------------------------------------
async function ffprobeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ])
  return parseFloat(stdout.trim())
}

// Concatenate audio inputs into one mono 44.1 kHz WAV via the concat FILTER (per-input resample):
// the sting bed is 44.1 kHz but a narration clip may be 24 kHz, and the concat DEMUXER corrupts the
// timeline on mismatched rates. A single-input call (n=1) passes through cleanly.
async function concatAudio(inputs, dst) {
  const inArgs = inputs.flatMap((f) => ['-i', f])
  const chains = inputs.map((_, i) => `[${i}:a]aresample=44100[a${i}]`).join(';')
  const joins = inputs.map((_, i) => `[a${i}]`).join('')
  const filter = `${chains};${joins}concat=n=${inputs.length}:v=0:a=1[out]`
  await run(FFMPEG, ['-y', ...inArgs, '-filter_complex', filter, '-map', '[out]', '-ar', '44100', '-ac', '1', dst])
}

// Render the brand bell once (the identical synth graphl-movie uses) → bell.wav, and return a
// helper that pads/trims it to a lead of STING_MS onto `dst`. No-op (returns null) when disabled.
async function prepareBell(tmp) {
  if (STING_MS <= 0) return null
  const bell = join(tmp, 'bell.wav')
  await run(FFMPEG, ['-y', '-filter_complex',
    'sine=f=587.33:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp[a];' +
    'sine=f=880:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp,adelay=200[b];' +
    'sine=f=1174.66:d=2.4:sample_rate=44100,afade=t=out:st=0:d=2.4:curve=exp,adelay=400[c];' +
    '[a][b][c]amix=inputs=3:normalize=0,volume=0.22,lowpass=f=3500,aformat=channel_layouts=mono',
    '-t', '2.6', bell])
  const secs = (STING_MS / 1000).toFixed(2)
  return (dst) => run(FFMPEG, ['-y', '-i', bell, '-af', `apad,atrim=0:${secs}`, '-ar', '44100', '-ac', '1', dst])
}

// Mux one beat's webm + clip → MP4 with CONCAT-SAFE settings: forced CFR, a fixed video
// timescale, gradfun deband, and identical codec/pix/audio params for every segment so the
// final `-c copy` concat is glitch-free at the joins. `total` (clip + tail) bounds both
// streams; apad extends the clip with silence to fill the held tail.
async function encodeSegment(webm, clip, total, outMp4) {
  const quality = IS_X26X ? ['-preset', PRESET, '-crf', CRF] : ['-b:v', BITRATE]
  await run(FFMPEG, [
    '-y', '-i', webm, '-i', clip,
    '-map', '0:v:0', '-map', '1:a:0',
    '-vf', 'gradfun=strength=0.9:radius=16',
    '-r', String(FPS), '-vsync', 'cfr', '-video_track_timescale', '90000',
    '-c:v', VIDEO_CODEC, ...quality, '-pix_fmt', 'yuv420p',
    '-af', 'apad', '-t', total.toFixed(3),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '1',
    outMp4,
  ])
}

// ---- the concept app dev server ---------------------------------------------------------
// Spawn `npm run dev` in the sibling concept app and resolve once Vite prints its Local URL.
async function startDevServer(conceptDir) {
  console.log(`Starting dev server: ${conceptDir} …`)
  const child = spawn('npm', ['run', 'dev'], { cwd: conceptDir, env: process.env })
  const url = await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('dev server did not print a URL within 60s')), 60000)
    const onData = (buf) => {
      const m = String(buf).match(/https?:\/\/localhost:\d+\/?/)
      if (m) { clearTimeout(to); child.stdout.off('data', onData); res(m[0].replace(/\/?$/, '/')) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', (b) => process.env.DEBUG && process.stderr.write(b))
    child.on('exit', (code) => rej(new Error(`dev server exited early (code ${code})`)))
  })
  // Poll until it actually serves before driving it.
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(url)).ok) break } catch { /* not up yet */ }
    await sleep(250)
  }
  console.log(`  dev server at ${url}`)
  return { child, url }
}

// ---- capture ----------------------------------------------------------------------------
async function recordCourse(concept, course, { force = false, only = [] } = {}) {
  const conceptDir = resolve(here, '..', '..', concept)
  if (!existsSync(conceptDir)) throw new Error(`concept app not found: ${conceptDir}`)

  const tmp = join(here, '.tmp', concept, course)
  const segDir = join(here, 'segments', concept, course)
  const outDir = join(here, 'out', concept)
  for (const d of [tmp, segDir, outDir]) mkdirSync(d, { recursive: true })

  // Render the section-start bell once (null when the sting is disabled).
  const bellBed = await prepareBell(tmp)

  // Spawn the dev server (unless APP_URL reuses an existing one).
  let server = null
  const base = process.env.APP_URL ? process.env.APP_URL.replace(/\/?$/, '/') : null
  const appBase = base ?? (server = await startDevServer(conceptDir), server.url)

  const puppeteer = (await import('puppeteer')).default
  let browser
  const segments = [] // ordered list of { mp4 } to concat
  try {
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: CW, height: CH, deviceScaleFactor: 1 },
      args: [`--window-size=${CW},${CH}`, '--autoplay-policy=no-user-gesture-required'],
    })
    const page = await browser.newPage()
    await page.goto(`${appBase}?capture=1#/${course}`, { waitUntil: 'networkidle2' })

    // The app lays out its own course for the recorder (section ids + beat counts).
    await page.waitForFunction(() => !!window.__capture, { timeout: 20000 })
    const plan = await page.evaluate(() => window.__capture.plan())
    if (!plan?.length) throw new Error(`course "${course}" has no sections (bad id?)`)
    const totalBeats = plan.reduce((n, s) => n + s.beats, 0)
    console.log(`Course ${concept}/${course}: ${plan.length} sections, ${totalBeats} beats @ ${CW}×${CH}\n`)

    let prevSec = null // the section recorded just before this one (for the transition pan)
    for (const sec of plan) {
      for (let beat = 0; beat < sec.beats; beat++) {
        const tag = `${pad2(sec.section)}-${sec.id}-b${beat}`
        const segMp4 = join(segDir, `${tag}.mp4`)
        const sidecar = join(segDir, `${tag}.json`)
        const clip = join(tmp, `${tag}.wav`)

        // Clip → duration (timing source). Missing clip = a not-yet-generated beat: fall back
        // to 3s silence so the pipeline still yields a video rather than hanging.
        const clipUrl = `${appBase}audio/${course}/${sec.id}-${beat}.wav`
        let dur, audioHash
        try {
          const buf = Buffer.from(await (await fetch(clipUrl)).arrayBuffer())
          writeFileSync(clip, buf)
          audioHash = sha(buf)
          dur = await ffprobeDuration(clip)
        } catch {
          await run(FFMPEG, ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '3', clip])
          audioHash = 'silence3'
          dur = 3
          console.warn(`  §${sec.section} ${sec.id} b${beat}: no audio → 3s silence`)
        }

        // A section's first beat (beat 0) opens with the bell lead-in; other beats have none.
        const leadMs = beat === 0 ? STING_MS : 0
        // During that lead, animate the camera from the PREVIOUS section's band to this one — but
        // only within a scene (a scene change shares no band to travel across) and only when there
        // is a previous section (the first section has nowhere to pan from → static bell).
        const canPan = leadMs > 0 && prevSec != null && prevSec.scene === sec.scene

        // Incremental reuse: re-record iff missing/changed (or --force / --only match).
        const fp = sha(JSON.stringify({
          v: 1, audioHash, scale: SCALE, fps: FPS, tail: TAIL_MS, enc: ENCODE_SIG,
          sting: leadMs > 0 ? STING_SIG : 'none',
          pan: canPan ? `pan:${PAN_MS}:from:${prevSec.id}` : 'none',
        }))
        const selected = only.length > 0 && only.some((t) => sec.id.includes(t) || tag.includes(t))
        const have = existsSync(segMp4) && existsSync(sidecar)
        const record = force || selected || !have || readJson(sidecar)?.fp !== fp
        if (!record) {
          console.log(`  §${sec.section} ${sec.id} b${beat}  reuse`)
          segments.push(segMp4)
          continue
        }

        // Position → wait for the painted, already-framed frame → roll → hold. total (which bounds
        // both streams) and the video hold include the bell lead. For a transition beat we FIRST
        // frame the previous section's band (so frame 0 is continuous with the prior segment, even
        // if that beat was reused this run), roll, THEN animate the fit to this section's band over
        // the sting window — capturing the pan that a plain instant seek loses between segments.
        const total = leadMs / 1000 + dur + TAIL_MS / 1000
        const startAt = canPan ? { s: prevSec.section, b: prevSec.beats - 1 } : { s: sec.section, b: beat }
        await page.evaluate(({ s, b }) => { window.__captureReady = false; window.__capture.seek(s, b) }, startAt)
        await page.waitForFunction(() => window.__captureReady === true, { timeout: 20000 }).catch(() => {})
        await page.waitForSelector('.scene-node, .react-flow', { timeout: 15000 }).catch(() => {})

        const webm = join(tmp, `${tag}.webm`)
        const recorder = await page.screencast({ path: webm })
        if (canPan) {
          await page.evaluate(({ s, b, ms }) => window.__capture.transition(s, b, ms),
            { s: sec.section, b: beat, ms: PAN_MS })
        }
        const panNote = canPan ? ` (pan ${(PAN_MS / 1000).toFixed(2)}s)` : ''
        const lead = leadMs > 0 ? `  ♪ sting ${(leadMs / 1000).toFixed(1)}s${panNote} +` : ''
        console.log(`  §${sec.section} ${sec.id} b${beat}  ▶ record (${lead}${dur.toFixed(1)}s)`)
        await sleep(Math.round(total * 1000))
        await recorder.stop()

        // Segment audio: the section-start bell lead + this beat's clip; mirrors the video hold.
        let segAudio = clip
        if (leadMs > 0 && bellBed) {
          const stingWav = join(tmp, `${tag}-sting.wav`)
          await bellBed(stingWav)
          segAudio = join(tmp, `${tag}-audio.wav`)
          await concatAudio([stingWav, clip], segAudio)
        }
        await encodeSegment(webm, segAudio, total, segMp4)
        writeFileSync(sidecar, JSON.stringify({ fp, builtAt: new Date().toISOString() }, null, 2))
        segments.push(segMp4)
        console.log(`  §${sec.section} ${sec.id} b${beat}  ✓ ${tag}.mp4`)
      }
      prevSec = sec // the next section pans from this one's band (recorded or reused)
    }
  } finally {
    if (browser) await browser.close()
    if (server) server.child.kill('SIGTERM')
  }

  // Merge: concat demuxer + stream copy (uniform params → clean joins, seconds).
  const listFile = join(tmp, 'concat.txt')
  writeFileSync(listFile, segments.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n')
  const out = join(outDir, `${course}.mp4`)
  console.log(`\nMerging ${segments.length} segments → out/${concept}/${course}.mp4`)
  await run(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', out])
  console.log(`\n✅ ${out}`)
  return out
}

// ---- CLI --------------------------------------------------------------------------------
function parse(argv) {
  const pos = []
  const only = []
  let force = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--force') force = true
    else if (a === '--only') only.push(...(argv[++i] ?? '').split(',').filter(Boolean))
    else if (a.startsWith('--only=')) only.push(...a.slice(7).split(',').filter(Boolean))
    else pos.push(a)
  }
  return { pos, only, force }
}

const { pos, only, force } = parse(process.argv.slice(2))
const [concept, course] = pos
if (!concept || !course) {
  console.error('usage: node record-course.mjs <concept> <course> [--force] [--only <tok[,tok]>]')
  process.exit(2)
}
recordCourse(concept, course, { force, only }).catch((e) => {
  console.error('\n✗', e.message)
  process.exit(1)
})
