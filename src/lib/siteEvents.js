import { getApp, getApps, initializeApp } from "firebase/app"
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore"

// Anonymous page-view and click counts (meeting item 15). Imported lazily by
// SiteAnalytics.jsx, and only once a visitor has accepted the privacy banner,
// so anyone who declines never downloads the Firebase SDK for this.
//
// What is stored: the event type, the page path (no query string), a button
// or link label, and the day. No cookies, no IP, no visitor or session ID, so
// two events can never be tied to the same person. firestore.rules accepts
// only that exact shape and refuses every client read.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(config.apiKey && config.projectId)
const app = isConfigured ? (getApps().length ? getApp() : initializeApp(config)) : null
const db = app ? getFirestore(app) : null

// Matches SITE_EVENTS_COLLECTION in admin/firebase.js, which reads these back.
const SITE_EVENTS_COLLECTION = "siteEvents"

// ponytail: one document per event, written straight from the browser. The
// rules cap the shape but cannot rate-limit, so a script could pad the counts.
// Move writes behind a Cloud Function (or aggregate into daily counters) if
// that ever happens.
export async function sendSiteEvent({ type, path, label = "" }) {
  if (!db) return
  await addDoc(collection(db, SITE_EVENTS_COLLECTION), {
    type,
    path,
    label: label.slice(0, 80),
    day: new Date().toLocaleDateString("en-CA"),
    at: serverTimestamp(),
  })
}
