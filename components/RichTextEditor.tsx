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

// Shared write/edit surface for both the contributor dashboard and the
// admin article editor — outputs sanitized-by-construction HTML (Tiptap's
// own schema, no raw paste-through) stored as articles.content_html and
// rendered on the public article page via the matching .article-body CSS
// class. Every image enters through an actual file upload (click-to-browse,
// drag-and-drop, or paste-from-clipboard-file) via `uploadUrl` — there is
// no toolbar action, attribute, or paste path that accepts a pasted
// external image URL as the source of an in-content image.
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the article here...",
  uploadUrl,
  onStatsChange,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadUrl?: string;
  onStatsChange?: (stats: { words: number; characters: number; readingTimeMinutes: number }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer nofollow" } }),
      FigureImage,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      if (onStatsChange) {
        const text = editor.getText().trim();
        const words = text ? text.split(/\s+/).length : 0;
        onStatsChange({ words, characters: text.length, readingTimeMinutes: words ? Math.max(1, Math.round(words / 200)) : 0 });
      }
    },
    editorProps: {
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!uploadUrl || !files || !files.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        uploadAndInsert(file, coords?.pos);
        return true;
      },
      handlePaste(_view, event) {
        const files = event.clipboardData?.files;
        if (!uploadUrl || !files || !files.length) return false;
        const file = Array.from(files).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        uploadAndInsert(file);
        return true;
      },
    },
    immediatelyRender: false,
  });

  const uploadAndInsert = useCallback(
    async (file: File, pos?: number) => {
      if (!editor || !uploadUrl) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(uploadUrl, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        const chain = editor.chain().focus();
        if (pos !== undefined) chain.insertContentAt(pos, { type: "image", attrs: { src: data.url, alt: "", align: "center" } });
        else chain.setFigureImage({ src: data.url, alt: "" });
        chain.run();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Image upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [editor, uploadUrl]
  );

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const btn = (active: boolean, extra = "") =>
    `rounded px-2 py-1 text-xs font-semibold ${active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"} ${extra}`;

  const imageSelected = editor.isActive("image");

  return (
    <div className="rounded-lg border border-ink-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-200 p-2">
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()} title="Undo">
          ↺ Undo
        </button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()} title="Redo">
          ↻ Redo
        </button>
        <span className="mx-1 h-5 w-px bg-ink-200" />

        <button type="button" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </button>
        <span className="mx-1 h-5 w-px bg-ink-200" />

        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          Underline
        </button>
        <span className="mx-1 h-5 w-px bg-ink-200" />

        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullets
        </button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          Numbered
        </button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </button>
        <button
          type="button"
          className={btn(editor.isActive("link"))}
          onClick={() => {
            const url = window.prompt("Link URL (used in-content only — not as an article source)");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Link
        </button>
        <span className="mx-1 h-5 w-px bg-ink-200" />

        {uploadUrl && (
          <>
            <button
              type="button"
              disabled={uploading}
              className={btn(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "🖼 Image"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAndInsert(file);
                e.target.value = "";
              }}
            />
          </>
        )}

        {imageSelected && (
          <>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateFigureImage({ align: "left" }).run()} title="Align left">
              ⬅
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateFigureImage({ align: "center" }).run()} title="Align center">
              ⬍
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateFigureImage({ align: "right" }).run()} title="Align right">
              ➡
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().updateFigureImage({ align: "full" }).run()} title="Full width">
              ↔
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={() => {
                const caption = window.prompt("Image caption (optional)");
                if (caption !== null) editor.chain().focus().updateFigureImage({ caption }).run();
              }}
            >
              Caption
            </button>
          </>
        )}

        <span className="mx-1 h-5 w-px bg-ink-200" />
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          Table
        </button>
        {editor.isActive("table") && (
          <>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addRowAfter().run()}>
              +Row
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addColumnAfter().run()}>
              +Col
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteTable().run()}>
              Delete Table
            </button>
          </>
        )}
      </div>
      <div className="editor-body px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
