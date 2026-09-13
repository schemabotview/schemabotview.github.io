// Sign-in and subscription state for the GraphL catalog.
//
// A port, not a new implementation. The owner's other products already run this against Firebase
// project schemabot-ae922 (see schematic1/src/stores/useAuthStore.ts): Google popup sign-in, the
// `firestore-stripe-payments` extension for billing. Same project, same collections, same Stripe
// price — only the client layer is rewritten, from React + zustand + the npm SDK to vanilla ESM
// off Google's CDN, so this repo stays buildless.
//
// How the money side works, since none of it is obvious from here:
//
//   customers/{uid}/subscriptions   written by the Stripe webhook, READ-ONLY to the client.
//                                   Entitlement is any doc with status active | trialing.
//   customers/{uid}/checkout_sessions   the client writes { price, success_url, cancel_url };
//                                   the extension answers on the same doc with a `url`, and we
//                                   send the browser there.
//
// The client can therefore never grant itself a subscription — it can only ask Stripe for one and
// read back what Stripe decided. That is the property worth preserving: do not "improve" this by
// caching entitlement anywhere the client can write.
//
// The subscription check is deliberately NOT scoped to a product. One subscription covers all of
// the owner's products, so a schematic subscriber is premium here too. That is a pricing decision
// (2026-09-13), not an oversight.
//
// EVERYTHING HERE IS ADDITIVE. The catalog is a public directory and must render for a signed-out
// reader, an offline reader, and a reader whose network blocks gstatic.com. Every failure path
// below ends in "leave the Sign in button alone and carry on".

import { firebaseConfig, SDK } from './firebase-config.js'

// The one price for the shared, all-products subscription (Stripe test/live id from schematic1).
const PRICE = 'price_1SoA8sI29ewUA699oAN1AW8e'

const MOUNT = document.getElementById('account')

let ui = { user: null, subscribed: false, busy: false, open: false }
let fb = null // { auth, db, fns… } once the SDK has loaded

// ---------------------------------------------------------------- element helpers

function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const initials = (user) => {
  const source = user.displayName || user.email || '?'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

// ---------------------------------------------------------------- render

// Signed out: one button. Signed in: an avatar that opens the account menu. The menu is built
// fresh each render rather than toggled, so it can never show a stale plan.
function render() {
  if (!MOUNT) return
  MOUNT.replaceChildren(ui.user ? account() : signIn())
}

function signIn() {
  const button = el('button', 'site__signin', ui.busy ? 'Signing in…' : 'Sign in')
  button.type = 'button'
  button.disabled = ui.busy
  button.addEventListener('click', signInWithGoogle)
  return button
}

function account() {
  const wrap = el('div', 'account')

  const avatar = el('button', 'account__avatar')
  avatar.type = 'button'
  avatar.setAttribute('aria-haspopup', 'menu')
  avatar.setAttribute('aria-expanded', String(ui.open))
  avatar.setAttribute('aria-label', `Account: ${ui.user.displayName || ui.user.email}`)

  // A Google photo can fail to load (rate limits, blocked third-party images); initials are the
  // fallback and are written first so there is never an empty circle.
  avatar.textContent = initials(ui.user)
  if (ui.user.photoURL) {
    const img = el('img', 'account__photo')
    img.src = ui.user.photoURL
    img.alt = ''
    img.referrerPolicy = 'no-referrer'
    img.addEventListener('load', () => avatar.replaceChildren(img))
    img.addEventListener('error', () => {})
  }
  avatar.addEventListener('click', () => {
    ui.open = !ui.open
    render()
  })
  wrap.appendChild(avatar)

  if (ui.open) wrap.appendChild(menu())
  return wrap
}

function menu() {
  const box = el('div', 'account__menu')
  box.setAttribute('role', 'menu')

  const head = el('div', 'account__head')
  head.appendChild(el('div', 'account__name', ui.user.displayName || 'Signed in'))
  if (ui.user.email) head.appendChild(el('div', 'account__email', ui.user.email))
  head.appendChild(
    el('div', `account__plan${ui.subscribed ? ' account__plan--premium' : ''}`,
       ui.subscribed ? '◆ Premium' : 'Free plan'),
  )
  box.appendChild(head)

  if (!ui.subscribed) {
    const upgrade = el('button', 'account__item account__item--cta',
                       ui.busy ? 'Opening checkout…' : 'Upgrade to Premium')
    upgrade.type = 'button'
    upgrade.disabled = ui.busy
    upgrade.addEventListener('click', startCheckout)
    box.appendChild(upgrade)
  }

  const out = el('button', 'account__item', 'Sign out')
  out.type = 'button'
  out.addEventListener('click', signOutNow)
  box.appendChild(out)
  return box
}

// Clicking anywhere else, or pressing Escape, closes the menu — table stakes for a popup, and
// especially so on a phone where the menu covers most of the screen.
document.addEventListener('click', (e) => {
  if (ui.open && !e.target.closest('.account')) {
    ui.open = false
    render()
  }
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.open) {
    ui.open = false
    render()
  }
})

// ---------------------------------------------------------------- firebase

// Loaded lazily and tolerantly. If gstatic is unreachable the catalog must still work, so a
// failure here logs and leaves the signed-out UI in place rather than throwing into the page.
async function boot() {
  try {
    const [{ initializeApp }, auth, store] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ])

    const app = initializeApp(firebaseConfig)
    fb = { auth: auth.getAuth(app), db: store.getFirestore(app), a: auth, s: store }

    auth.onAuthStateChanged(fb.auth, async (user) => {
      ui.user = user
      ui.subscribed = false
      ui.busy = false
      ui.open = false
      render()
      if (user) {
        ui.subscribed = await isSubscribed(user)
        render()
      }
    })
  } catch (err) {
    console.error('[graphl] auth unavailable:', err)
  }
}

// Entitlement, read straight from what Stripe wrote. Not product-scoped on purpose (see above).
async function isSubscribed(user) {
  try {
    const snap = await fb.s.getDocs(fb.s.collection(fb.db, `customers/${user.uid}/subscriptions`))
    return snap.docs.some((d) => ['active', 'trialing'].includes(d.data().status))
  } catch (err) {
    // Read denied or offline: fail CLOSED to "free". Showing Premium we cannot verify would be
    // worse than showing Free to someone who has it — the upgrade button is recoverable, a false
    // Premium badge is just a lie.
    console.error('[graphl] subscription check failed:', err)
    return false
  }
}

async function signInWithGoogle() {
  if (!fb) return
  ui.busy = true
  render()
  try {
    await fb.a.signInWithPopup(fb.auth, new fb.a.GoogleAuthProvider())
  } catch (err) {
    // A closed popup is a normal user action, not a fault worth shouting about.
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
      console.error('[graphl] sign-in failed:', err)
    }
  } finally {
    ui.busy = false
    render()
  }
}

async function signOutNow() {
  if (!fb) return
  ui.open = false
  try {
    await fb.a.signOut(fb.auth)
  } catch (err) {
    console.error('[graphl] sign-out failed:', err)
  }
}

// Ask the extension for a Checkout session, then follow the URL it writes back onto the doc.
async function startCheckout() {
  if (!fb || !ui.user) return
  ui.busy = true
  render()
  try {
    const ref = await fb.s.addDoc(
      fb.s.collection(fb.db, `customers/${ui.user.uid}/checkout_sessions`),
      { price: PRICE, success_url: window.location.href, cancel_url: window.location.href },
    )
    const stop = fb.s.onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (data?.url) {
        stop()
        window.location.assign(data.url)
      } else if (data?.error) {
        stop()
        ui.busy = false
        render()
        console.error('[graphl] checkout failed:', data.error.message)
      }
    })
  } catch (err) {
    console.error('[graphl] checkout failed:', err)
    ui.busy = false
    render()
  }
}

render()
boot()
