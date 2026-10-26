// A pick in the custom popup only sets React state, so the form never hears a
// change the way it would from a native control: the intake left its
// "required" alert up and didn't re-read its answers. Write the hidden
// input's value through the prototype setter (an instance write would update
// React's change tracker and the date input's onChange would be skipped) and
// fire a bubbling change, as the browser does.
export function announceChange(input, value) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set.call(input, value)
  input.dispatchEvent(new Event("change", { bubbles: true }))
}
