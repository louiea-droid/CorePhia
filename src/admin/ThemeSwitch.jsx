// Light/dark switch, top right, just left of the account menu. A <label> wrapping a
// real checkbox (index.css's .theme-toggle rules draw the sun→moon morph),
// since an <input> can't legally nest inside a <button>.
export default function ThemeSwitch({ theme, onToggle }) {
  return (
    <label htmlFor="admin-theme-toggle" className="flex cursor-pointer items-center rounded-full p-1">
      <span className="theme-toggle shrink-0" data-mode={theme}>
        <span className="theme-toggle__wrap">
          <input
            id="admin-theme-toggle"
            className="theme-toggle__input"
            type="checkbox"
            role="switch"
            aria-label="Dark mode"
            checked={theme === "dark"}
            onChange={onToggle}
          />
          <span className="theme-toggle__icon" aria-hidden="true">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} className="theme-toggle__icon-part" />
            ))}
          </span>
        </span>
      </span>
    </label>
  )
}
