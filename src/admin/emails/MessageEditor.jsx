import { useEffect, useState } from "react"
import { useEditor, EditorContent, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { isAllowedLink } from "../../../functions/emailRender.js"
import { firstNameNode } from "./firstNameNode.js"
import { inputClass } from "../ui/formUi.js"
import {
  BoldIcon, ItalicIcon, UnderlineIcon, BulletListIcon, NumberedListIcon,
  LinkIcon, ClearFormatIcon, UndoIcon, RedoIcon,
} from "../ui/icons.jsx"

const extensions = [
  StarterKit.configure({
    heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, strike: false,
    underline: {},
    link: { openOnClick: false, autolink: false, protocols: ["https"], isAllowedUri: (url) => isAllowedLink(url) },
  }),
  firstNameNode,
]

const btn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-950/70 transition-colors duration-200 hover:bg-ink-950/10 hover:text-ink-950 disabled:opacity-40 aria-pressed:bg-accent/20 aria-pressed:text-accent-dark [.dark_&]:aria-pressed:text-accent-text"

function Btn({ label, active, onClick, disabled, children }) {
  return (
    <button type="button" className={btn} aria-label={label.split(" (")[0]} title={label}
      aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

const Sep = () => <span className="mx-1 h-5 w-px bg-ink-950/15" aria-hidden="true" />

function LinkPopover({ editor, onClose }) {
  const [url, setUrl] = useState(editor.getAttributes("link").href || "")
  const ok = isAllowedLink(url.trim())
  const apply = () => {
    if (!ok) return
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
    onClose()
  }
  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run()
    onClose()
  }
  return (
    <div className="absolute left-2 top-full z-20 mt-1 w-72 rounded-lg border border-ink-950/15 bg-paper-50 p-3 shadow-lg">
      <label htmlFor="link-address" className="mb-1 block text-xs font-medium text-ink-950/60">Link address</label>
      <input id="link-address" autoFocus type="url" className={inputClass} value={url} placeholder="https://corephia.com"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); apply() }
          if (e.key === "Escape") { e.stopPropagation(); onClose() }
        }} />
      <p className="mt-1 text-xs text-ink-950/60">Only links to corephia.com or Elation.</p>
      {url.trim() && !ok && <p role="alert" className="mt-1 text-xs text-red-700 [.dark_&]:text-red-400">That address isn't allowed.</p>}
      <div className="mt-3 flex justify-between gap-2">
        <button type="button" onClick={remove} className="text-xs text-ink-950/70 transition-colors duration-200 hover:text-ink-950">Remove link</button>
        <button type="button" onClick={apply} disabled={!ok}
          className="rounded-md bg-ink-950 px-3 py-1 text-xs font-medium text-paper-50 transition-colors duration-200 hover:bg-ink-800 disabled:opacity-40">Apply</button>
      </div>
    </div>
  )
}

export default function MessageEditor({ value, onChange, readOnly = false }) {
  const [linkOpen, setLinkOpen] = useState(false)
  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
    editorProps: { handleKeyDown: (_v, e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setLinkOpen(true); return true } return false }, attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Message", class: "min-h-40 px-3 py-2 text-sm leading-relaxed [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_p+ol]:mt-3 [&_ul+p]:mt-3 [&_ol+p]:mt-3 text-ink-950 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent-dark [&_a]:underline [.dark_&]:[&_a]:text-accent-text" } },
  })
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: !!e?.isActive("bold"), italic: !!e?.isActive("italic"), underline: !!e?.isActive("underline"),
      bullet: !!e?.isActive("bulletList"), ordered: !!e?.isActive("orderedList"), link: !!e?.isActive("link"),
      undo: !!e?.can().undo(), redo: !!e?.can().redo(),
    }),
  })

  // Outside changes (switching templates) replace the content without firing onChange.
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) editor.chain().setMeta("addToHistory", false).setContent(value, { emitUpdate: false }).run()
  }, [editor, value])
  useEffect(() => { editor?.setEditable(!readOnly) }, [editor, readOnly])

  if (!editor) return null
  const c = () => editor.chain().focus()
  return (
    <div className="rounded-lg border border-ink-950/15 bg-paper-50 focus-within:border-ink-950/40 focus-within:ring-2 focus-within:ring-accent/40">
      {!readOnly && (
        <div role="toolbar" aria-label="Formatting" className="relative flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-ink-950/10 bg-ink-950/5 px-2 py-1.5">
          <Btn label="Bold (Ctrl+B)" active={s.bold} onClick={() => c().toggleBold().run()}><BoldIcon className="h-4 w-4" /></Btn>
          <Btn label="Italic (Ctrl+I)" active={s.italic} onClick={() => c().toggleItalic().run()}><ItalicIcon className="h-4 w-4" /></Btn>
          <Btn label="Underline (Ctrl+U)" active={s.underline} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
          <Sep />
          <Btn label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}><BulletListIcon className="h-4 w-4" /></Btn>
          <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}><NumberedListIcon className="h-4 w-4" /></Btn>
          <Sep />
          <Btn label="Link (Ctrl+K)" active={s.link} onClick={() => setLinkOpen((o) => !o)}><LinkIcon className="h-4 w-4" /></Btn>
          <Btn label="Clear formatting" onClick={() => c().unsetAllMarks().clearNodes().run()}><ClearFormatIcon className="h-4 w-4" /></Btn>
          <Sep />
          <Btn label="Undo (Ctrl+Z)" disabled={!s.undo} onClick={() => c().undo().run()}><UndoIcon className="h-4 w-4" /></Btn>
          <Btn label="Redo (Ctrl+Y)" disabled={!s.redo} onClick={() => c().redo().run()}><RedoIcon className="h-4 w-4" /></Btn>
          <button type="button" onClick={() => c().insertContent({ type: "firstName" }).run()}
            className="ml-auto rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-dark transition-colors duration-200 hover:bg-accent/25 [.dark_&]:text-accent-text">
            + First name
          </button>
          {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
