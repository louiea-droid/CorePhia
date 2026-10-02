import { useEffect, useMemo, useState } from "react"
import Select from "../../components/Select"
import ConfirmDialog from "../ui/ConfirmDialog"
import { PAGE_SIZE_OPTIONS } from "../lib/constants"
import { AUDIT_ACTIONS, MESSAGES_COLLECTION, recordAuditEvent } from "../lib/firebase"
import MessageModal from "./MessageModal"
import MessagesTable from "./MessagesTable"
import PageHeader from "../layout/PageHeader"
import Pagination from "../ui/Pagination"
import { ApplicantsSkeleton } from "../ui/Skeleton"
import { useContactMessages } from "./useContactMessages"

const PAGE_SIZE_KEY = "corephia-admin-messages-page-size"

// Kept as its own local copy rather than imported from pages/Contact.jsx —
// same reasoning as PLAN_OPTIONS in Patients.jsx: the admin stays
// dependency-free from the marketing bundle.
const TOPIC_OPTIONS = [
  "Starting a weight loss program",
  "Dietitian / nutrition services",
  "Exercise programming",
  "Questions about medication",
  "Billing or membership question",
  "Something else",
]

function readStoredPageSize() {
  try {
    const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : 10
  } catch {
    return 10
  }
}

export default function Messages({ role, messagesViewedAt = 0, onMessagesViewed }) {
  const { messages, error, removeMessage } = useContactMessages()
  // Frozen to whatever messagesViewedAt was when this page mounted — useState's
  // initializer only runs once, so a later prop change (from the mark-viewed
  // call right below) doesn't retroactively un-highlight rows mid-visit. The
  // sidebar badge, by contrast, reads the live prop and clears immediately.
  const [viewedAt] = useState(messagesViewedAt)
  useEffect(() => {
    onMessagesViewed?.()
    // Only ever needs to fire once, on the visit that opened this page —
    // not e.g. every time `onMessagesViewed` itself is redefined.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [pageSize, setPageSize] = useState(readStoredPageSize)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [topicFilter, setTopicFilter] = useState("")

  const canDelete = role === "superAdmin"

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await removeMessage(pendingDelete.id)
      recordAuditEvent({
        action: AUDIT_ACTIONS.deleteMessage,
        targetCollection: MESSAGES_COLLECTION,
        targetId: pendingDelete.id,
        targetLabel: pendingDelete.name ?? "",
      })
      setPendingDelete(null)
      setSelectedMessage(null)
    } catch (cause) {
      setDeleteError(cause.code ?? cause.message ?? "Something went wrong deleting this message.")
    } finally {
      setDeleting(false)
    }
  }

  const filteredMessages = useMemo(() => {
    if (!messages) return null
    const query = search.trim().toLowerCase()
    return messages.filter((message) => {
      if (topicFilter && message.interest !== topicFilter) return false
      if (!query) return true
      const haystack = `${message.name ?? ""} ${message.email ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [messages, search, topicFilter])

  const totalPages = filteredMessages ? Math.max(1, Math.ceil(filteredMessages.length / pageSize)) : 1
  const currentPage = Math.min(page, totalPages)

  const changePageSize = (nextSize) => {
    setPageSize(nextSize)
    setPage(1)
    try {
      localStorage.setItem(PAGE_SIZE_KEY, String(nextSize))
    } catch {
      /* private browsing / storage disabled */
    }
  }

  const updateSearch = (value) => {
    setSearch(value)
    setPage(1)
  }

  const updateTopicFilter = (value) => {
    setTopicFilter(value)
    setPage(1)
  }

  const pageMessages = filteredMessages
    ? filteredMessages.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : []

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Queries" description="Everyone who has reached out through the contact form." />

      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-6 text-center">
          <h2 className="font-semibold text-ink-950">Could not load queries</h2>
          <p className="mt-2 text-sm text-ink-950/60">{error}</p>
        </div>
      ) : !messages ? (
        <ApplicantsSkeleton />
      ) : !messages.length ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-ink-950/10 bg-white p-8 text-center">
          <h2 className="font-serif text-2xl text-ink-950">No queries yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-950/60">
            Queries sent through the contact form will appear here.
          </p>
        </div>
      ) : (
        <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-ink-950/10 bg-white">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-950/10 p-4">
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search by name or email…"
              className="min-w-0 flex-1 rounded-lg border border-ink-950/15 bg-paper-50 px-3 py-2 text-sm text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-950/40 focus:border-ink-950/40"
            />
            <div className="w-60 shrink-0">
              <Select
                value={topicFilter}
                onChange={updateTopicFilter}
                options={[{ value: "", label: "All topics" }, ...TOPIC_OPTIONS.map((topic) => ({ value: topic, label: topic }))]}
                triggerClassName="px-3 py-2 text-sm"
              />
            </div>
          </div>

          {!filteredMessages.length ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <p className="font-medium text-ink-950">No queries match your search</p>
              <p className="mt-1 text-sm text-ink-950/50">Try a different name, email or topic filter.</p>
            </div>
          ) : (
            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 pt-3">
              <MessagesTable
                messages={pageMessages}
                onSelect={setSelectedMessage}
                minRows={pageSize === 10 ? 10 : 0}
                rankOffset={(currentPage - 1) * pageSize}
                viewedAt={viewedAt}
              />
            </div>
          )}

          <div className="shrink-0 px-4 pb-4">
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={changePageSize}
              totalRecords={filteredMessages.length}
            />
          </div>
        </section>
      )}

      <MessageModal
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
        canDelete={canDelete}
        onRequestDelete={setPendingDelete}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this query?"
        description={
          deleteError ??
          `This permanently deletes the query from ${pendingDelete?.name || "this visitor"}. This cannot be undone.`
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        confirmDisabled={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null)
          setDeleteError(null)
        }}
      />
    </div>
  )
}
