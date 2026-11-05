import { useState } from "react"

function readStoredTheme(key) {
  try {
    const saved = localStorage.getItem(key)
    if (saved === "light" || saved === "dark") return saved
  } catch {
    /* private browsing / storage disabled */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// The caller applies the returned theme as a class on its own root — never
// on document.documentElement — so this stays scoped to the admin subtree.
// The public marketing site has no dark mode and must not inherit it.
// key: the admin and the patient portal keep their own choice.
export function useAdminTheme(key = "corephia-admin-theme") {
  const [theme, setTheme] = useState(() => readStoredTheme(key))

  const toggleTheme = () => {
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(key, next)
      } catch {
        /* private browsing / storage disabled */
      }
      return next
    })
  }

  return [theme, toggleTheme]
}
