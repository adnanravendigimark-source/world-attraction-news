"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import HeadingExtension, { type Level } from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import FigureImage from "@/lib/figureImage";
import InlineImageModal, { type InlineImageData } from "@/components/dashboard/InlineImageModal";
import InlineLinkModal from "@/components/dashboard/InlineLinkModal";

// Same editor design/toolbar/interaction as the Sagrada/Amsterdam admin
// editors (components/admin/TiptapArticleEditor.tsx there) — ported
// directly, restyled to this app's slate/red tokens. It backs both the
// Contributor "Write Article" page (components/dashboard/ArticleEditor.tsx,
// always omits `allowLinks`) and the Admin "Review Article" panel
// (components/admin/ArticleReviewPanel.tsx, passes `allowLinks`).
//
// By default (allowLinks=false/omitted) the Link extension is never added
// to the `extensions` list below — contributor articles must never contain
// a hyperlink (product requirement: no outbound links from contributor
// content). Without the Link extension registered, the editor's schema has
// no "link" mark at all, so there is no toolbar button, no keyboard
// shortcut, and no programmatic way to create one from inside the editor.
// `transformPastedHTML` below is the second half of that guarantee: it
// strips any <a> tag out of pasted HTML (from another blog, Word, Google
// Docs, etc.) before Tiptap's parser ever sees it, keeping the link's
// visible text but discarding the href and the tag itself. The server
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

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  if (/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(url)) return url;
  return `https://${url}`;
}

// Restrict headings to the allowed levels for this field, and map any
// out-of-schema pasted heading down to a sensible in-schema level instead of
// losing it (an H1 becomes H2 when H1 isn't allowed, since the article's own
// title already IS the page's H1; H4-H6 become H3, the smallest heading the
// site styles).
const Heading = HeadingExtension.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      levels: [2, 3] as Level[],
    };
  },
  parseHTML() {
    const allowed = (this.options.levels as number[]) || [2, 3];
    return [1, 2, 3, 4, 5, 6].map((tagLevel) => {
      let level: number;
      if (tagLevel === 1) level = allowed.includes(1) ? 1 : 2;
      else if (tagLevel === 2) level = 2;
      else level = 3;
      return { tag: `h${tagLevel}`, attrs: { level } };
    });
  },
});

// Adds "target"/"rel" as real per-link attributes (not just a site-wide
// default) so the "No follow" / "Open in new tab" choices in
// InlineLinkModal apply per link. Only ever registered when allowLinks.
const LinkWithAttrs = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      target: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("target"),
        renderHTML: (attrs: Record<string, any>) => (attrs.target ? { target: attrs.target } : {}),
      },
      rel: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("rel"),
        renderHTML: (attrs: Record<string, any>) => (attrs.rel ? { rel: attrs.rel } : {}),
      },
    };
  },
});

const ToolbarButton = ({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: {
  label: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
      active ? "bg-[#DC2626] text-white shadow-2xs font-bold" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    }`}
  >
    {label}
  </button>
);

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your article here...",
  uploadUrl,
  allowedHeadings = [2, 3],
  stickyOffset,
  allowLinks = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadUrl?: string;
  allowedHeadings?: (1 | 2 | 3)[];
  stickyOffset?: string;
  // Admin-only escape hatch (see the comment above stripLinks) — the
  // Contributor Write Article page never sets this, so it stays false there
  // by default with no way to override it from that surface.
  allowLinks?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // `null` = the modal is inserting a brand-new image (wherever the
  // cursor was when the toolbar's Image button was clicked). A real number
  // = editing the image node already sitting at that document position
  // (opened by clicking an existing image in the body).
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalInitial, setImageModalInitial] = useState<InlineImageData | undefined>(undefined);
  const editingImagePosRef = useRef<number | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const editor = useEditor(
    {
      // Avoids a Tiptap/Next.js SSR hydration mismatch — the editor should
      // only render its content after the client mounts.
      immediatelyRender: false,
      content: value || "",
      editorProps: {
        attributes: {
          // Typography/table/figure/placeholder styling comes from the
          // `.editor-body .ProseMirror` rules in app/globals.css (built to
          // match this editor's exact output — the FigureImage node's
          // data-figure-image/img-align-* markup, Tiptap's own auto-added
          // .ProseMirror class, Placeholder's is-editor-empty marker) via
          // the `editor-body` class on the wrapper below. `prose`/
          // `prose-slate` were dead classes here — @tailwindcss/typography
          // isn't installed in this project, so they rendered as inert
          // no-ops, leaving every pasted heading/list/table/link
          // completely unstyled despite parsing correctly.
          class: "px-4 sm:px-6 py-4 sm:py-6 outline-none [&_img]:cursor-pointer [&_figure]:cursor-pointer",
        },
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
      },
      extensions: [
        StarterKit.configure({ heading: false }),
        Heading.configure({ levels: allowedHeadings.length ? allowedHeadings : [2, 3] }),
        Underline,
        FigureImage,
        Placeholder.configure({ placeholder }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        ...(allowLinks ? [LinkWithAttrs.configure({ openOnClick: false, autolink: false })] : []),
      ],
      onUpdate: ({ editor }: { editor: Editor }) => {
        onChangeRef.current(editor.getHTML());
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    []
  );

  // Forces every toolbar/status re-render on selection changes too (not
  // just content changes), so the H2/H3/Bold/etc. active-state highlighting
  // stays accurate as the cursor moves.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => forceRerender((n) => n + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const replaceNodeAt = useCallback((ed: Editor, pos: number, content: Record<string, any>) => {
    ed.chain()
      .focus()
      .command(({ tr }: { tr: any }) => {
        const current = tr.doc.nodeAt(pos);
        if (!current) return false;
        tr.delete(pos, pos + current.nodeSize);
        return true;
      })
      .run();
    ed.chain().focus().insertContentAt(pos, content).run();
  }, []);

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
      replaceNodeAt(editor, editingImagePosRef.current, { type: "image", attrs });
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

  function handleLinkInsert({ url, nofollow, newTab }: { url: string; nofollow: boolean; newTab: boolean }) {
    if (!editor) return;
    const normalized = normalizeUrl(url);
    const attrs: { href: string; target: string | null; rel: string | null } = {
      href: normalized,
      target: null,
      rel: null,
    };
    if (newTab) {
      attrs.target = "_blank";
      attrs.rel = nofollow ? "nofollow noopener noreferrer" : "noopener noreferrer";
    } else if (nofollow) {
      attrs.rel = "nofollow";
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      editor.chain().focus().insertContent({ type: "text", text: normalized, marks: [{ type: "link", attrs }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    }
    setLinkModalOpen(false);
  }

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", false);
    }
  }, [editor, value]);

  const getFormatLabel = () => {
    if (!editor) return "Paragraph (P)";
    if (editor.isActive("heading", { level: 1 })) return "Heading 1 (H1)";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2 (H2)";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3 (H3)";
    if (editor.isActive("bulletList")) return "Bullet List";
    if (editor.isActive("orderedList")) return "Numbered List";
    if (editor.isActive("blockquote")) return "Quote";
    if (editor.isActive("table")) return "Table";
    return "Paragraph (P)";
  };

  if (!editor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-400 min-h-[350px]">
        Loading editor…
      </div>
    );
  }

  const inTable = editor.isActive("table");

  return (
    <div className="editor-body rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all focus-within:border-slate-300">
      <div
        className="sticky z-20 flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 bg-slate-50/95 backdrop-blur-xs p-1.5"
        style={{ top: stickyOffset || 0 }}
      >
        <div className="flex flex-wrap items-center gap-0.5">
          {allowedHeadings.includes(1) && (
            <ToolbarButton
              label="H1"
              title="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
          )}
          {allowedHeadings.includes(2) && (
            <ToolbarButton
              label="H2"
              title="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
          )}
          {allowedHeadings.includes(3) && (
            <ToolbarButton
              label="H3"
              title="Heading 3"
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            />
          )}
          <ToolbarButton
            label="P"
            title="Paragraph (normal text)"
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarButton
            label={<span className="font-bold">B</span>}
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label={<span className="italic">I</span>}
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label={<span className="underline">U</span>}
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarButton
            label="• List"
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="1. List"
            title="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <span className="mx-1 h-4 w-px bg-slate-200" />
          {allowLinks && <ToolbarButton label="Link" title="Insert link" onClick={() => setLinkModalOpen(true)} />}
          {uploadUrl && <ToolbarButton label="Image" title="Insert image" onClick={openNewImageModal} />}
          <ToolbarButton
            label="Table"
            title="Insert 3×3 table"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          />
          {inTable && (
            <>
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <ToolbarButton label="+Row" title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()} />
              <ToolbarButton label="+Col" title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <ToolbarButton label="-Row" title="Delete current row" onClick={() => editor.chain().focus().deleteRow().run()} />
              <ToolbarButton label="-Col" title="Delete current column" onClick={() => editor.chain().focus().deleteColumn().run()} />
              <ToolbarButton label="Del Table" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} />
            </>
          )}
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolbarButton
            label="Clear"
            title="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          />
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-slate-500">
          <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
          <span>Current:</span>
          <span className="font-semibold text-slate-800">{getFormatLabel()}</span>
        </div>
      </div>

      <EditorContent editor={editor} />

      {imageModalOpen && uploadUrl && (
        <InlineImageModal
          initial={imageModalInitial}
          uploadUrl={uploadUrl}
          onInsert={handleImageModalInsert}
          onRemove={editingImagePosRef.current !== null ? handleImageModalRemove : undefined}
          onClose={closeImageModal}
        />
      )}
      {linkModalOpen && <InlineLinkModal onInsert={handleLinkInsert} onClose={() => setLinkModalOpen(false)} />}
    </div>
  );
}
