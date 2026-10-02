# Staff page as a users table — design

2026-10-02. Louie's decisions in conversation the same day, from a reference screenshot of a
users table. Replaces the layout of `src/admin/staff/Staff.jsx`; permissions are unchanged.

## Decisions

- Columns: **User** (initials circle, name, email under it), **Role** (badge), **Status**
  ("Active" or "No access"), **Added**, **Last sign in** ("Never" until recorded), **Actions**.
- Left out: Client portals (no portal yet; add it when there is one), Templates, Bulk add.
- Last sign in is **recorded from now on**: each admin sign-in saves the time on the person's
  staff record.

## Page

- Toolbar: search (name or email), role filter (All roles, Admin, Co-admin, Provider,
  Dietitian, No access; Super admin only for a super admin viewer), **+ Add user** opening the
  existing add form (name, email, role) in a dialog.
- Table: one row per staff record from `loadStaff(actor.role)` (super admins hidden from
  non-super viewers, as today). Sorted by name.
- Actions per row, only where `canManageMember(actor, member)` (unchanged):
  **Edit** (✎) opens a small dialog to change the role (`grantableRoles`, plus "No access");
  **⋯** opens Remove access / Delete account, each confirmed as today. Your own row shows no
  actions.
- Footer: "Showing a–b of n", page size (shared `PAGE_SIZE_OPTIONS`), `Pagination`.
- Phone (< 640px): rows become stacked cards (name, email, role badge, status, last sign in,
  actions); no sideways page scroll.
- Admin tokens, dark mode, hover = colour only.

## Last sign in

- `user/{uid}.lastSignInAt` (timestamp), written by `recordSignIn(uid)` in `lib/firebase.js`
  right after `getAdminAccess` confirms a clinical role. Failures are logged and ignored (a
  missed stamp must never block sign-in). Not written in demo mode; demo staff get sample
  values.
- Rule: a signed-in person may update **only** `lastSignInAt` on **their own** `user/{uid}`
  document, and only to `request.time`. Nothing else about self-writes changes (nobody edits
  their own role, name or email). `isRoleChange` must keep accepting `lastSignInAt` on an
  existing doc it doesn't change.
- Tests: own stamp at server time succeeds; a client-chosen time fails; stamping someone
  else fails; changing your role alongside the stamp fails; an admin changing someone's role
  still works when that doc has `lastSignInAt`.

## Code

- `src/admin/staff/Staff.jsx` rewritten around the table; the add form moves into
  `src/admin/staff/AddStaffDialog.jsx`; role editing into `src/admin/staff/EditRoleDialog.jsx`.
- Pure helper `filterStaff(members, { search, role })` in `src/admin/staff/staffMath.js`, checked by
  `staffMath.check.js` under `npm run check`.
- `src/admin/lib/firebase.js`: `recordSignIn`. `src/admin/AdminApp.jsx`: call it once per
  sign-in.
- `firestore.rules` + `tests/firestore.rules.test.js`.
- Browser check in demo mode at 1280 and 375, light and dark.
