# Staff page as a users table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Staff page as a searchable, filterable users table (user, role, status, added, last sign in, actions) and start recording each person's last admin sign-in.

**Architecture:** A pure `filterStaff` helper (node self-check), a narrow Firestore rule letting a person stamp only their own `lastSignInAt` (emulator tests), a fire-and-forget `recordSignIn` after each admin sign-in, and `Staff.jsx` rebuilt as a table with the add form and role change moved into dialogs. Permissions (`canManageMember`, `grantableRoles`, the rules' `canActOn`) are unchanged.

**Tech Stack:** React 19, Tailwind v4, Firebase JS SDK 12, node:assert, `@firebase/rules-unit-testing` (Java 21 at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`).

**Spec:** `docs/superpowers/specs/2026-10-02-staff-table-design.md`

## Global Constraints

- No Client portals, Templates or Bulk add.
- Your own row: Edit → your Profile (`/admin/security`), ⋯ → Profile and Sign out; never your own role change, Remove access or Delete.
- Admin tokens, dark mode, hover = colour only; phone (< 640px) stacks rows, no sideways scroll.
- A failed sign-in stamp is logged and ignored; it must never block signing in.
- Leave Louie's uncommitted `src/admin/layout/Sidebar.jsx` title edit and `CLAUDE.md` out of every commit; don't edit `CLAUDE.md`.

## Review Focus

1. **An admin changes the role of someone who already has a sign-in time.** Expected: works. Pinned: Task 2 test "role change still works on a stamped record" (the rules' field allow-list must include `lastSignInAt`).
2. **Someone forges a sign-in time or slips a role change in with their stamp.** Expected: refused. Pinned: Task 2 tests.
3. **A search that matches nobody.** Expected: "No staff match …", not an empty table with no message. Pinned: Task 1 check (empty result) + Task 4 empty state.
4. **The super admin opens their own row.** Expected: Profile and Sign out only. Pinned: Task 5 browser check.
5. **A narrow phone.** Expected: stacked rows, no sideways scroll. Pinned: Task 5 browser check.

---

### Task 1: `filterStaff`

**Files:** Create `src/admin/staff/staffMath.js`, `src/admin/staff/staffMath.check.js`; `package.json` `check` appends ` && node src/admin/staff/staffMath.check.js`.

**Interfaces:** Produces `filterStaff(members, { search = "", role = "all" }) → member[]` (case-insensitive name/email match; role `"all"`, `""` for No access, or a role key; sorted by display name).

- [ ] **Failing check** — `staffMath.check.js`:

```js
import assert from "node:assert/strict"
import { filterStaff } from "./staffMath.js"

const staff = [
  { uid: "1", name: "Sam Rivera, RD", email: "sam@corephia.com", role: "dietitian" },
  { uid: "2", name: "", email: "ProviderMD@CorePhia.com", role: "provider" },
  { uid: "3", name: "Jordan Lee, NP", email: "jordan@corephia.com", role: "" },
  { uid: "4", name: "Alex Admin", email: "alex@corephia.com", role: "admin" },
]
const uids = (list) => list.map((member) => member.uid)

// Sorted by what's shown: the name, or the part of the email before @.
assert.deepEqual(uids(filterStaff(staff, {})), ["4", "3", "2", "1"])
// Search matches name or email, ignoring case.
assert.deepEqual(uids(filterStaff(staff, { search: "RIVERA" })), ["1"])
assert.deepEqual(uids(filterStaff(staff, { search: "providermd@" })), ["2"])
assert.deepEqual(filterStaff(staff, { search: "nobody" }), [])
// Role filter: a role, or "" for No access.
assert.deepEqual(uids(filterStaff(staff, { role: "provider" })), ["2"])
assert.deepEqual(uids(filterStaff(staff, { role: "" })), ["3"])
assert.deepEqual(uids(filterStaff(staff, { role: "provider", search: "sam" })), [])

console.log("staffMath: all checks passed")
```

- [ ] `npm run check` → FAIL (module missing).
- [ ] **Implement** — `staffMath.js`:

```js
// Search, role filter and sort for the Staff table. Pure: staffMath.check.js
// runs it under node.
import { staffDisplayName } from "./roles.js"

export function filterStaff(members, { search = "", role = "all" } = {}) {
  const needle = search.trim().toLowerCase()
  return members
    .filter((member) => role === "all" || (member.role ?? "") === role)
    .filter((member) => !needle || `${member.name ?? ""} ${member.email ?? ""}`.toLowerCase().includes(needle))
    .toSorted((a, b) => staffDisplayName(a).localeCompare(staffDisplayName(b)))
}
```

- [ ] `npm run check` → pass. Commit "Staff: search, role filter and sort".

### Task 2: Rules — stamp your own sign-in time

**Files:** `firestore.rules` (`user/{uid}` block, `isRoleChange`), `tests/firestore.rules.test.js`.

- [ ] **Failing tests** — append:

```js
describe("last sign in", () => {
  test("anyone stamps their own sign-in at server time", async () => {
    await assertSucceeds(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: serverTimestamp() }))
  })
  test("a client-chosen time is refused", async () => {
    await assertFails(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: new Date("2020-01-01") }))
  })
  test("you can't stamp someone else", async () => {
    await assertFails(updateDoc(doc(as("admin"), "user", "provider"), { lastSignInAt: serverTimestamp() }))
  })
  test("you can't change your role alongside your stamp", async () => {
    await assertFails(updateDoc(doc(as("provider"), "user", "provider"), { lastSignInAt: serverTimestamp(), role: "admin" }))
  })
  test("role change still works on a stamped record", async () => {
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), "user", "provider"), { lastSignInAt: new Date() }))
    await assertSucceeds(updateDoc(doc(as("admin"), "user", "provider"), { role: "coAdmin" }))
  })
  test("an admin can't set someone's sign-in time", async () => {
    await assertFails(setDoc(doc(as("admin"), "user", "newbie"), { role: "provider", name: "N", lastSignInAt: serverTimestamp() }))
  })
})
```

- [ ] Run rules tests → the two "succeeds" tests fail (stamp refused; stamped record rejected by the field allow-list).
- [ ] **Rules** — in `isRoleChange`, add `'lastSignInAt'` to `next.keys().hasOnly([...])` and add `&& !('lastSignInAt' in changed)`. Add:

```
    // Each admin sign-in stamps the person's own record with the server's
    // time (Staff page "Last sign in"). Only that one field, only their own.
    function isOwnSignInStamp(uid) {
      return request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastSignInAt'])
        && request.resource.data.lastSignInAt == request.time;
    }
```

and split the write rule: `allow create: if request.auth != null && isRoleChange(uid);` / `allow update: if request.auth != null && (isRoleChange(uid) || isOwnSignInStamp(uid));`.

- [ ] Rules tests → all pass. Commit "Rules: stamp your own last sign-in".

### Task 3: Record the sign-in

**Files:** `src/admin/lib/firebase.js`, `src/admin/AdminApp.jsx`, `src/admin/patients/seedCharts.js`.

- [ ] `firebase.js`:

```js
// Stamps the signed-in person's staff record (Staff page "Last sign in").
// Fire and forget: a failed stamp is logged and never blocks signing in.
export function recordSignIn(uid) {
  if (!db || usingSeedData) return
  updateDoc(doc(db, USERS_COLLECTION, uid), { lastSignInAt: serverTimestamp() }).catch((cause) =>
    console.warn("Couldn't record the sign-in time:", cause.code ?? cause.message),
  )
}
```

(import `updateDoc`, `serverTimestamp` if not already imported).
- [ ] `AdminApp.jsx` auth effect: after `const access = …`, `if (nextUser && access.role) recordSignIn(nextUser.uid)`. This fires once per auth state change (each sign-in or page load), which is what "last sign in" should mean here.
- [ ] Seed staff: `lastSignInAt` on Dr. Antonious (2 hours ago) and Jordan Lee (yesterday); Sam Rivera none ("Never").
- [ ] Build passes. Commit "Admin: record each staff member's last sign-in".

### Task 4: The table

**Files:** Rewrite `src/admin/staff/Staff.jsx`; create `src/admin/staff/AddStaffDialog.jsx`, `src/admin/staff/EditRoleDialog.jsx`.

- [ ] `AddStaffDialog({ actor, open, onClose, onAdded(member) })`: the current add form (name, email, role from `grantableRoles`, the same error messages and the "they'll get an email" notice) inside the admin dialog pattern (portal, scrim, Escape, focus).
- [ ] `EditRoleDialog({ member, actor, onClose, onSaved(role) })`: role `Select` from `grantableRoles` plus "No access" (`""`), current role preselected, **Save** confirms (no second ConfirmDialog; the dialog is the confirmation) → `setStaffRole` + `changeStaffRole` audit, as today.
- [ ] `Staff.jsx`:
  - PageHeader "Staff"; toolbar: search input (magnifier icon, "Search by name or email"), role filter `Select` (All roles, each of `ROLE_LABELS` except Super admin unless the viewer is one, No access), **+ Add user** (primary).
  - Table (sm and up): columns User (initials circle from `staffDisplayName`, name, email under), Role (badge with the role label, uppercase small), Status (✓ Active in accent, ✕ No access muted), Added (`formatDay`), Last sign in (date and time, or ⏱ Never), Actions (✎ and ⋯ icon buttons, `aria-label`s naming the person).
  - Actions: `canManageMember` rows: ✎ → EditRoleDialog; ⋯ → menu with Remove access (when they have a role) and Delete account, each through the existing ConfirmDialogs. Own row: ✎ links to `/admin/security`; ⋯ → Profile, Sign out (asks first, as the account menu does). Other rows you can't manage: no buttons.
  - Phone (< sm): the same rows as stacked cards.
  - Footer: "Showing a–b of n", page size `Select` (`PAGE_SIZE_OPTIONS`), `Pagination`.
  - Empty states: no staff ("No staff yet."), no match ("No staff match your search.").
- [ ] Lint, build, `npm run check`. Commit "Staff: users table with search, role filter and dialogs".

### Task 5: Verification

- [ ] `npm run check`, lint, build, rules tests.
- [ ] Demo :5180, Playwright, 1280 and 375, light and dark, as superAdmin and admin: table columns present; search narrows and "No staff match" shows; role filter; Add user dialog adds a row; Edit changes a role; ⋯ Remove access / Delete confirm; own row has Profile and Sign out only; super admin hidden from admin's view; Last sign in shows times and "Never"; no sideways scroll; no page errors.
- [ ] Phase 1 suite still passes (it adds staff roles indirectly) and the rest of the suites.
