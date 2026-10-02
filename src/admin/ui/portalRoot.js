// Portal target for admin modals/dialogs. Must be a node inside the themed
// wrapper AdminApp renders (see AdminApp.jsx), not document.body — dark
// mode is a CSS variable override scoped to that wrapper, and custom
// properties only cascade through the DOM tree, so a modal portaled
// straight to document.body would sit outside it and stay stuck in light
// mode. Falls back to document.body only if a modal somehow tries to open
// before AdminApp has mounted.
export function getAdminPortalRoot() {
  return document.getElementById("admin-portal-root") ?? document.body
}
