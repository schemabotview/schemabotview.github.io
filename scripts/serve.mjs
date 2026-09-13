// Local dev server for the GraphL catalog index.
//
// This repo is a pure static site with no build, so there is nothing to compile — the point of
// this script is only to serve the folder the way GitHub Pages serves it, so that "works locally"
// means "works on graphl.in". Zero dependencies: `npm install` is a no-op and stays that way.
//
//   npm run dev            → http://localhost:8000
//   PORT=3000 npm run dev  → pick another port
//
// Pages behaviours reproduced here:
//   /            → index.html
//   /dir         → 301 redirect to /dir/            (Pages adds the trailing slash)
//   /dir/        → dir/index.html
//   /about       → about.html                       (extension-less fallback)
//   missing      → 404.html if the repo has one, else a plain 404
//   directories  → never listed
//   paths        → CASE-SENSITIVE, because Pages runs on Linux and macOS does not
//
// Not reproduced (and not worth it): Jekyll (.nojekyll disables it anyway), the CDN's caching and
// compression, and the sister apps at graphl.in/<slug>/ — those live in their own repos, so a card
// on the local index 404s here unless you run that app yourself. That is expected.

import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat, realpath } from 'node:fs/promises'
import { join, resolve, relative, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PORT = Number(process.env.PORT) || 8000
const HOST = process.env.HOST || 'localhost'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
}

async function kind(path) {
  try {
    const s = await stat(path)
    return s.isDirectory() ? 'dir' : s.isFile() ? 'file' : null
  } catch {
    return null
  }
}

// macOS filesystems are case-insensitive, so `href="Icon.svg"` loads locally and 404s on Pages.
// realpath.native reports the true on-disk spelling; if it differs, treat the file as missing —
// the same answer production would give — and say why.
async function casingMismatch(path) {
  try {
    const real = await (realpath.native ?? realpath)(path)
    return real === path ? null : relative(ROOT, real)
  } catch {
    return null
  }
}

// Map a URL path to a file on disk, following the Pages resolution order.
// Returns { file } | { redirect } | { missing: true }.
async function resolveRequest(pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
  const target = resolve(ROOT, rel)

  // Never serve outside the repo, whatever ../ games the URL plays.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return { missing: true }

  if (pathname.endsWith('/')) {
    const index = join(target, 'index.html')
    return (await kind(index)) === 'file' ? { file: index } : { missing: true }
  }

  const direct = await kind(target)
  if (direct === 'file') return { file: target }
  if (direct === 'dir') return { redirect: pathname + '/' }

  const html = target + '.html'
  if ((await kind(html)) === 'file') return { file: html }

  return { missing: true }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

async function sendFile(req, res, file, status = 200) {
  const s = await stat(file)
  const headers = {
    'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': s.size,
    // The catalog's JSON is fetched with cache: 'no-cache'; keep the whole dev site honest so an
    // edit is always the thing you reload.
    'Cache-Control': 'no-cache',
  }
  if (req.method === 'HEAD') return send(res, status, headers, null)
  res.writeHead(status, headers)
  createReadStream(file).pipe(res)
}

const server = createServer(async (req, res) => {
  const started = Date.now()
  let status = 200

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      status = 405
      send(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }, 'Method Not Allowed\n')
    } else {
      const { pathname } = new URL(req.url, `http://${req.headers.host}`)
      const found = await resolveRequest(pathname)

      if (found.redirect) {
        status = 301
        send(res, 301, { Location: found.redirect }, null)
      } else if (found.file) {
        const wrongCase = await casingMismatch(found.file)
        if (wrongCase) {
          status = 404
          console.warn(`  ! case mismatch: requested ${pathname} but disk has /${wrongCase}`)
          console.warn(`    (served here by macOS, 404 on GitHub Pages — fix the reference)`)
          await notFound(req, res)
        } else {
          await sendFile(req, res, found.file)
        }
      } else {
        status = 404
        await notFound(req, res)
      }
    }
  } catch (err) {
    status = 500
    console.error(err)
    if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain' }, 'Internal Server Error\n')
  }

  console.log(`${String(status).padEnd(3)} ${req.method} ${req.url}  ${Date.now() - started}ms`)
})

async function notFound(req, res) {
  const page = join(ROOT, '404.html')
  if ((await kind(page)) === 'file') return sendFile(req, res, page, 404)
  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found\n')
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Try: PORT=${PORT + 1} npm run dev`)
    process.exit(1)
  }
  throw err
})

server.listen(PORT, HOST, () => {
  console.log(`GraphL catalog — serving ${ROOT}`)
  console.log(`  http://${HOST}:${PORT}/  (Ctrl-C to stop)`)
})
