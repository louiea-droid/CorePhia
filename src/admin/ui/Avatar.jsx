// A staff member's photo, or their initials in a circle when there isn't one.
// Decorative: the name always sits next to it, so it's hidden from screen readers.
export default function Avatar({ photo, initials, className = "", fallbackClassName = "" }) {
  return photo ? (
    <img src={photo} alt="" aria-hidden="true" className={`shrink-0 rounded-full object-cover ${className}`} />
  ) : (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full ${fallbackClassName} ${className}`}>
      {initials}
    </span>
  )
}
