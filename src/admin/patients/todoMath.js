// Groups the to-dos staff add, for the To-do page. Pure, so todoMath.check.js
// runs it under plain node.
import { asDate, daysFrom } from "./chartMath.js"

// Done items older than this are hidden from the page (never deleted).
const DONE_DAYS = 30
const millis = (value) => asDate(value)?.getTime() ?? 0

export function groupTodos(todos, today, now = new Date()) {
  const groups = { overdue: [], today: [], week: [], later: [], undated: [], done: [] }
  const cutoff = now.getTime() - DONE_DAYS * 86_400_000
  for (const todo of todos) {
    if (todo.done) {
      if (millis(todo.done.at) >= cutoff) groups.done.push(todo)
      continue
    }
    if (!todo.due) {
      groups.undated.push(todo)
      continue
    }
    const days = daysFrom(today, todo.due)
    const group = days < 0 ? groups.overdue : days === 0 ? groups.today : days <= 7 ? groups.week : groups.later
    group.push(todo)
  }
  const byDue = (a, b) => a.due.localeCompare(b.due) || millis(a.createdAt) - millis(b.createdAt)
  for (const key of ["overdue", "today", "week", "later"]) groups[key].sort(byDue)
  groups.undated.sort((a, b) => millis(a.createdAt) - millis(b.createdAt))
  groups.done.sort((a, b) => millis(b.done.at) - millis(a.done.at))
  return groups
}
