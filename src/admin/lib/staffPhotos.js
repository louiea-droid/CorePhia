// Staff profile photos: staffPhotos/{uid} = { image, updatedAt }, where image
// is a small JPEG data URL. Kept in Firestore rather than Firebase Storage
// because new Storage buckets need the paid Blaze plan; at 256 px a photo is
// roughly 15 to 30 KB. firestore.rules lets only the person themselves set or
// remove theirs, caps the size, and lets staff read them. Demo mode keeps them
// in memory instead.
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { useEffect, useState } from "react"
import { db, usingSeedData } from "./firebase"

const PHOTOS = "staffPhotos"
const SIZE = 256
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const TYPES = ["image/jpeg", "image/png", "image/webp"]

// The shrunk, square-cropped JPEG for a chosen file, or an Error saying why not.
export async function photoFromFile(file) {
  if (!TYPES.includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image.")
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Choose an image under 5 MB.")
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image couldn't be read. Try another one.")
  })
  // Centre crop to a square, then scale to SIZE.
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement("canvas")
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext("2d")
  context.fillStyle = "#ffffff" // a transparent PNG gets a white background, not black
  context.fillRect(0, 0, SIZE, SIZE)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close?.()
  return canvas.toDataURL("image/jpeg", 0.85)
}

// Demo mode: an in-memory map with listeners, so changes show everywhere at once.
const demoPhotos = new Map()
const demoListeners = new Set()
const notifyDemo = () => demoListeners.forEach((listener) => listener(new Map(demoPhotos)))

export async function saveStaffPhoto(uid, image) {
  if (usingSeedData) {
    demoPhotos.set(uid, image)
    return notifyDemo()
  }
  await setDoc(doc(db, PHOTOS, uid), { image, updatedAt: serverTimestamp() })
}

export async function removeStaffPhoto(uid) {
  if (usingSeedData) {
    demoPhotos.delete(uid)
    return notifyDemo()
  }
  await deleteDoc(doc(db, PHOTOS, uid))
}

// Every staff photo, live, as a Map of uid → image. The collection is small (a
// handful of staff), so each place that shows photos (the Staff page, the
// account menu, Profile) just listens to all of it, and a change shows in all
// of them straight away.
function listenStaffPhotos(onChange) {
  if (usingSeedData) {
    demoListeners.add(onChange)
    onChange(new Map(demoPhotos))
    return () => demoListeners.delete(onChange)
  }
  if (!db) return () => {}
  return onSnapshot(
    collection(db, PHOTOS),
    (snapshot) => onChange(new Map(snapshot.docs.map((entry) => [entry.id, entry.data().image]))),
    // A failed read (rules not deployed yet) just means letter avatars.
    (cause) => console.warn("Staff photos unavailable:", cause.code ?? cause.message),
  )
}

export function useStaffPhotos() {
  const [photos, setPhotos] = useState(() => new Map())
  useEffect(() => listenStaffPhotos(setPhotos), [])
  return photos
}
