// Firebase web config for the GraphL platform.
//
// This is the EXISTING project, `schemabot-ae922`, shared with the owner's other products — not a
// new one. Auth and subscriptions are already built there: the `firestore-stripe-payments`
// extension owns `customers/{uid}/subscriptions`, the Stripe webhook writes them, and the client
// only ever reads. None of that backend is reimplemented here; this repo ports the client to
// vanilla ESM so the catalog can stay buildless.
//
// These values are NOT secrets. A Firebase web config ships inside every client bundle by design;
// it identifies the project rather than authorising anything, and Google documents it as public.
// What actually guards the data is elsewhere and stays elsewhere:
//
//   1. Firestore security rules, deployed to the project (NOT from this repo — see below)
//   2. Authentication -> Authorized domains, which must list graphl.in or sign-in fails
//   3. App Check, if it is ever turned on
//
// DO NOT add a firestore.rules file to this repo. Rules are per-project and deploying them
// REPLACES the entire ruleset, so a GraphL-only file would delete the customers/products rules
// that the owner's other apps depend on. There is one canonical ruleset and it does not live here.

export const firebaseConfig = {
  apiKey: 'AIzaSyD_3UqLvvbO7JRFJ1KBw0RP39uANNOngVs',
  authDomain: 'schemabot-ae922.firebaseapp.com',
  projectId: 'schemabot-ae922',
  storageBucket: 'schemabot-ae922.firebasestorage.app',
  messagingSenderId: '550352706068',
  appId: '1:550352706068:web:95c2ed4083667c7b2e6501',
}

// Pinned rather than floating. The SDK loads straight from Google's CDN as native ESM, which is
// what keeps this repo buildless — no npm install, no bundler, still push-to-publish. Pinning
// means the live site cannot change under us the day a new SDK ships.
export const SDK = 'https://www.gstatic.com/firebasejs/11.0.2'
