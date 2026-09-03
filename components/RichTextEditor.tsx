"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import FigureImage from "@/lib/figureImage";
import InlineImageModal, { type InlineImageData } from "@/components/dashboard/InlineImageModal";

// This same editor backs both the Contributor "Write Article" page
// (components/dashboard/ArticleEditor.tsx, always omits `allowLinks`) and
// the Admin "Review Article" panel (components/admin/ArticleReviewPanel.tsx,
// passes `allowLinks`). By default (allowLinks=false/omitted) the Link
// extension is never added to the `extensions` list below — contributor
// articles must never contain a hyperlink (product requirement: no outbound
// links from contributor content). Without the Link extension registered,
// the editor's schema has no "link" mark at all, so there is no toolbar
// button, no keyboard shortcut, and no programmatic way to create one from
// inside the editor. `transformPastedHTML` below is the second half of that
// guarantee: it strips any <a> tag out of pasted HTML (from another blog,
// Word, Google Docs, etc.) before Tiptap's parser ever sees it, keeping the
// link's visible text but discarding the href and the tag itself. Belt and
// suspenders — the missing schema mark alone would already drop the href on
// parse, but stripping the tag up front means no HTML link markup can
// survive into the stored contentHtml under any circumstance. The server
// applies the same restriction independently (see stripLinkTags in
// lib/sanitizeHtml.ts, used by lib/articles.ts on every contributor write
// path) so a request that bypasses this editor entirely still can't smuggle
// a link into contributor-authored content.
function stripLinks(html: string): string {
  if (typeof window === "undefined" || !html.includes("<a")) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("a").forEach((a) => {
      const parent = a.parentNode;
      if (!parent) return;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      parent.removeChild(a);
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your article here...",
  uploadUrl,
  onStatsChange,
  allowLinks = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadUrl?: string;
  onStatsChange?: (stats: { words: number; characters: number; readingTimeMinutes: number }) => void;
  // Admin-only escape hatch (see the comment above stripLinks) — the
  // Contributor Write Article page never sets this, so it stays false there
  // by default with no way to override it from that surface.
  allowLinks?: boolean;
}) {
  // `null` pos = the modal is inserting a brand-new image (wherever the
  // contributor's cursor was when they clicked "Photo"). A real number =
  // editing the image node already sitting at that document position
  // (opened by clicking an existing image, or automatically right after a
  // drag-drop/paste upload so alt text gets a first-class prompt instead of
  // silently staying blank).
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalInitial, setImageModalInitial] = useState<InlineImageData | undefined>(undefined);
  const editingImagePosRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      FigureImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      ...(allowLinks
        ? [Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } })]
        : []),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      if (onStatsChange) {
        const text = editor.getText().trim();
        const words = text ? text.split(/\s+/).length : 0;
        onStatsChange({
          words,
          characters: text.length,
          readingTimeMinutes: words ? Math.max(1, Math.round(words / 200)) : 0,
        });
      }
    },
    editorProps: {
      transformPastedHTML: allowLinks ? undefined : stripLinks,
      handleClickOn(_view, pos, node) {
        if (node.type.name === "image") {
          editingImagePosRef.current = pos;
          setImageModalInitial({ url: node.attrs.src || "", alt: node.attrs.alt || "", caption: node.attrs.caption || "" });
          setImageModalOpen(true);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!uploadUrl || !files || !files.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        uploadAndInsertAt(file, coords?.pos ?? view.state.selection.from);
        return true;
      },
      handlePaste(_view, event) {
        const files = event.clipboardData?.files;
        if (!uploadUrl || !files || !files.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        uploadAndInsertAt(file);
        return true;
      },
    },
    immediatelyRender: false,
  });

  // Uploads a dropped/pasted image file, inserts it with blank alt/caption
  // at an explicit, known position, then immediately opens the edit modal
  // pre-targeted at that exact position so the contributor can add alt text
  // right away instead of it silently staying blank forever.
  const uploadAndInsertAt = useCallback(
    async (file: File, pos?: number) => {
      if (!editor || !uploadUrl) return;
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(uploadUrl, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");

        const insertPos = pos ?? editor.state.selection.from;
        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, { type: "image", attrs: { src: data.url, alt: "", caption: "", align: "center" } })
          .run();

        editingImagePosRef.current = insertPos;
        setImageModalInitial({ url: data.url, alt: "", caption: "" });
        setImageModalOpen(true);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Image upload failed.");
      }
    },
    [editor, uploadUrl]
  );

  function openNewImageModal() {
    editingImagePosRef.current = null;
    setImageModalInitial(undefined);
    setImageModalOpen(true);
  }

  function closeImageModal() {
    setImageModalOpen(false);
    setImageModalInitial(undefined);
    editingImagePosRef.current = null;
  }

  function handleImageModalInsert(data: InlineImageData) {
    if (!editor) return;
    const attrs = { src: data.url, alt: data.alt, caption: data.caption, align: "center" };

    if (editingImagePosRef.current !== null) {
      const pos = editingImagePosRef.current;
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node) return false;
          tr.delete(pos, pos + node.nodeSize);
          return true;
        })
        .run();
      editor.chain().focus().insertContentAt(pos, { type: "image", attrs }).run();
    } else {
      editor.chain().focus().setFigureImage(attrs).run();
    }
    closeImageModal();
  }

  function handleImageModalRemove() {
    if (!editor || editingImagePosRef.current === null) return;
    const pos = editingImagePosRef.current;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return false;
        tr.delete(pos, pos + node.nodeSize);
        return true;
      })
      .run();
    closeImageModal();
  }

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, value]);

  if (!editor) return null;

  const btn = (active: boolean, extra = "") =>
    `inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
      active
        ? "bg-[#DC2626] text-white shadow-2xs font-bold"
        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    } ${extra}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all focus-within:border-slate-300">
      {/* TipTap Formatting Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs px-3 py-1.5">
        {/* Undo / Redo */}
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l6-6M3 10l6 6" />
          </svg>
        </button>
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Y)"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-6-6m6 6l-6 6" />
          </svg>
        </button>

        <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />

        {/* Headings */}
        <button
          type="button"
          className={btn(editor.isActive("paragraph"))}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Normal Paragraph"
        >
          Normal
        </button>
        <button
          type="button"
          className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          className={btn(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          H3
        </button>

        <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />

        {/* Text Formats */}
        <button
          type="button"
          className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={btn(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={btn(editor.isActive("strike"))}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>

        <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />

        {/* Lists & Quotes */}
        <button
          type="button"
          className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          1. List
        </button>
        <button
          type="button"
          className={btn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          " Quote
        </button>

        {allowLinks && (
          <>
            <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              className={btn(editor.isActive("link"))}
              onClick={() => {
                const previousUrl = editor.getAttributes("link").href || "";
                const url = window.prompt("Link URL (leave blank to remove)", previousUrl);
                if (url === null) return;
                if (!url.trim()) {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  return;
                }
                editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
              }}
              title="Insert/Edit Link"
            >
              🔗 Link
            </button>
          </>
        )}

        {uploadUrl && (
          <>
            <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              className={btn(false)}
              onClick={openNewImageModal}
              title="Insert Image in Body"
            >
              📷 Photo
            </button>
          </>
        )}
      </div>

      {/* Editor Content Writing Surface */}
      <div className="p-4 sm:p-6 min-h-[350px]">
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none focus:outline-none text-slate-800 text-sm sm:text-base leading-relaxed"
        />
      </div>

      {imageModalOpen && uploadUrl && (
        <InlineImageModal
          initial={imageModalInitial}
          uploadUrl={uploadUrl}
          onInsert={handleImageModalInsert}
          onRemove={editingImagePosRef.current !== null ? handleImageModalRemove : undefined}
          onClose={closeImageModal}
        />
      )}
    </div>
  );
}
