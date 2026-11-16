import { Node } from "@tiptap/core"

// The "first name" chip: stands in for the patient's first name when the email is built.
export const firstNameNode = Node.create({
  name: "firstName",
  group: "inline",
  inline: true,
  atom: true,
  parseHTML: () => [{ tag: "span[data-first-name]" }],
  renderHTML: () => [
    "span",
    {
      "data-first-name": "",
      class: "mx-0.5 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent-dark [.dark_&]:text-accent-text",
    },
    "first name",
  ],
})
