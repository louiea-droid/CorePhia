import { useState } from "react"

// A rendered email in a sandboxed frame: its inline styles stay out of the
// admin, and nothing in it can run (no allow-scripts).
export default function EmailFrame({ html }) {
  const [height, setHeight] = useState(400)
  return (
    <iframe
      title="Email preview"
      sandbox="allow-same-origin"
      srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f5f7fb">${html}</body></html>`}
      onLoad={(event) => setHeight(event.currentTarget.contentDocument?.documentElement.scrollHeight ?? 400)}
      style={{ height }}
      className="block w-full border-0"
    />
  )
}
