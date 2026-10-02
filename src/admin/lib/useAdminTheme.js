import { useState } from "react"

const THEME_KEY = "corephia-admin-theme"

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "light" || saved === "dark") return saved
  } catch {
    /* private browsing / storage disabled */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// The caller applies the returned theme as a class on its own root — never
// on document.documentElement — so this stays scoped to the admin subtree.
// The public marketing site has no dark mode and must not inherit it.
export function useAdminTheme() {
  const [theme, setTheme] = useState(readStoredTheme)

  const toggleTheme = () => {
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* private browsing / storage disabled */
      }
      return next
    })
  }

  return [theme, toggleTheme]
}
