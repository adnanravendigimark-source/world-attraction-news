"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import HeadingExtension, { type Level } from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Node, mergeAttributes } from "@tiptap/core";
import RichImageModal, { type ImageModalData } from "./RichImageModal";
import RichLinkModal from "./RichLinkModal";

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return url;
  if (/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(url)) return url;
  return `https://${url}`;
}

// Contributor articles must never contain a hyperlink (product requirement
// — no outbound links from contributor content; see the same guarantee
// previously enforced in components/RichTextEditor.tsx). When allowLinks is
// false (the default — the Contributor "Write Article" page never passes
// it), the Link extension below is never added to the schema, so there's
// no mark to paste into in the first place; this strips any <a> tag out of
// pasted HTML before Tiptap's parser sees it, keeping the visible text and
// discarding the href. Admin's ArticleReviewPanel passes allowLinks so
// editors keep the ability to add links while polishing a submission.
// Server-side enforcement (stripLinkTags in lib/sanitizeHtml.ts, applied on
// every contributor write path) is the independent second half of this
// guarantee in case a request skips the editor entirely.
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

const Heading = HeadingExtension.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      levels: [1, 2, 3] as Level[],
    };
  },
  parseHTML() {
    const allowed = (this.options.levels as number[]) || [1, 2, 3];
    return [1, 2, 3, 4, 5, 6].map((tagLevel) => {
      let level: number;
      if (tagLevel === 1) level = allowed.includes(1) ? 1 : 2;
      else if (tagLevel === 2) level = 2;
      else level = 3;
      return { tag: `h${tagLevel}`, attrs: { level } };
    });
  },
});

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

const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "inline*",
  isolating: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        contentElement: "figcaption",
        getAttrs: (el: HTMLElement | string) => {
          if (typeof el === "string") return false;
          const img = el.querySelector("img");
          if (!img) return false;
          return { src: img.getAttribute("src"), alt: img.getAttribute("alt") || "" };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }: { node: any; HTMLAttributes: Record<string, any> }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes),
      ["img", { src: node.attrs.src, alt: node.attrs.alt || "" }],
      ["figcaption", 0],
    ];
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
    className={`rounded px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer ${
      active
        ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
        : "text-stone-600 hover:bg-stone-200 hover:text-stone-900"
    }`}
  >
    {label}
  </button>
);

export default function TiptapArticleEditor({
  value,
  onChange,
  placeholder = "Write the article here… use the toolbar for headings, bold, links, lists, tables, or images.",
  minHeight = "26rem",
  allowedHeadings = [2, 3],
  stickyOffset,
  uploadUrl = "/api/dashboard/upload",
  allowLinks = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  allowedHeadings?: (1 | 2 | 3)[];
  stickyOffset?: string;
  uploadUrl?: string;
  // Admin-only escape hatch (see the comment above stripLinks) — the
  // Contributor Write Article page never sets this, so it stays false there
  // by default with no way to override it from that surface.
  allowLinks?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingImageData, setEditingImageData] = useState<ImageModalData | null>(null);
  const editingImageRef = useRef<{ pos: number } | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "tiptap rich-content max-w-none px-3 py-2.5 text-sm text-stone-900 outline-none [&_img]:cursor-pointer [&_figure]:cursor-pointer",
      },
      transformPastedHTML: allowLinks ? undefined : stripLinks,
      handleClickOn: (_view: any, pos: number, node: any) => {
        if (node.type.name === "image") {
          editingImageRef.current = { pos };
          setEditingImageData({ url: node.attrs.src || "", alt: node.attrs.alt || "", caption: "" });
          setImageModalOpen(true);
          return true;
        }
        if (node.type.name === "figure") {
          editingImageRef.current = { pos };
          setEditingImageData({
            url: node.attrs.src || "",
            alt: node.attrs.alt || "",
            caption: node.textContent || "",
          });
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
      Image,
      Figure,
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
  }, []);

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

  const replaceNodeAt = useCallback(
    (ed: Editor, pos: number, content: Record<string, any>) => {
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
    },
    []
  );

  function openNewImageModal() {
    editingImageRef.current = null;
    setEditingImageData(null);
    setImageModalOpen(true);
  }

  function handleImageModalSave(opts: ImageModalData) {
    if (!editor) return;
    const caption = opts.caption.trim();
    const content = caption
      ? {
          type: "figure",
          attrs: { src: opts.url, alt: opts.alt || "" },
          content: [{ type: "text", text: caption }],
        }
      : { type: "image", attrs: { src: opts.url, alt: opts.alt || "" } };

    if (editingImageRef.current) {
      replaceNodeAt(editor, editingImageRef.current.pos, content);
    } else {
      editor.chain().focus().insertContent(content).run();
    }
    setImageModalOpen(false);
    setEditingImageData(null);
    editingImageRef.current = null;
  }

  function handleImageDelete() {
    if (!editor || !editingImageRef.current) return;
    const pos = editingImageRef.current.pos;
    editor
      .chain()
      .focus()
      .command(({ tr }: { tr: any }) => {
        const node = tr.doc.nodeAt(pos);
        if (!node) return false;
        tr.delete(pos, pos + node.nodeSize);
        return true;
      })
      .run();
    setImageModalOpen(false);
    setEditingImageData(null);
    editingImageRef.current = null;
  }

  function handleLinkInsert({
    url,
    nofollow,
    newTab,
  }: {
    url: string;
    nofollow: boolean;
    newTab: boolean;
  }) {
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
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: normalized, marks: [{ type: "link", attrs }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink(attrs).run();
    }
    setLinkModalOpen(false);
  }

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
      <div
        className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-400"
        style={{ minHeight }}
      >
        Loading editor…
      </div>
    );
  }

  const inTable = editor.isActive("table");

  return (
    <div className="rounded-lg border border-stone-300 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600">
      <div
        className="sticky z-10 flex flex-wrap items-center justify-between gap-1 rounded-t-lg border-b border-stone-200 bg-stone-50/95 backdrop-blur p-1.5 shadow-xs"
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
          <span className="mx-1 h-4 w-px bg-stone-300" />
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
          <span className="mx-1 h-4 w-px bg-stone-300" />
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
          <ToolbarButton
            label="Quote"
            title="Blockquote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <span className="mx-1 h-4 w-px bg-stone-300" />
          {allowLinks && <ToolbarButton label="Link" title="Insert link" onClick={() => setLinkModalOpen(true)} />}
          <ToolbarButton label="Image" title="Insert image" onClick={openNewImageModal} />
          <ToolbarButton
            label="Table"
            title="Insert 3×3 table"
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          />
          {inTable && (
            <>
              <span className="mx-1 h-4 w-px bg-stone-300" />
              <ToolbarButton label="+Row" title="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()} />
              <ToolbarButton label="+Col" title="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <ToolbarButton label="-Row" title="Delete current row" onClick={() => editor.chain().focus().deleteRow().run()} />
              <ToolbarButton label="-Col" title="Delete current column" onClick={() => editor.chain().focus().deleteColumn().run()} />
              <ToolbarButton label="Del Table" title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()} />
            </>
          )}
          <span className="mx-1 h-4 w-px bg-stone-300" />
          <ToolbarButton
            label="Clear"
            title="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          />
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-stone-500">
          <span className="h-2 w-2 rounded-full bg-blue-600" />
          <span>Current:</span>
          <span className="font-semibold text-stone-800">{getFormatLabel()}</span>
        </div>
      </div>

      <EditorContent editor={editor} style={{ minHeight }} />

      {imageModalOpen && (
        <RichImageModal
          initialValues={editingImageData || undefined}
          isEditing={!!editingImageData}
          uploadUrl={uploadUrl}
          onInsert={handleImageModalSave}
          onDelete={editingImageData ? handleImageDelete : undefined}
          onClose={() => {
            setImageModalOpen(false);
            setEditingImageData(null);
            editingImageRef.current = null;
          }}
        />
      )}
      {allowLinks && linkModalOpen && (
        <RichLinkModal onInsert={handleLinkInsert} onClose={() => setLinkModalOpen(false)} />
      )}
    </div>
  );
}
