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

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start writing your dispatch...",
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
        onStatsChange({
          words,
          characters: text.length,
          readingTimeMinutes: words ? Math.max(1, Math.round(words / 200)) : 0,
        });
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
        if (pos !== undefined) {
          chain.insertContentAt(pos, { type: "image", attrs: { src: data.url, alt: "", align: "center" } });
        } else {
          chain.setFigureImage({ src: data.url, alt: "" });
        }
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
    `inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all ${
      active
        ? "bg-ink-950 text-white shadow-subtle"
        : "text-ink-700 hover:bg-paper-200/80 hover:text-ink-950"
    } ${extra}`;

  const imageSelected = editor.isActive("image");

  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white shadow-card overflow-hidden transition-all focus-within:border-ink-400 focus-within:shadow-lift">
      {/* Sticky Minimalist Toolbar */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-ink-200/80 bg-paper-50/95 backdrop-blur-sm px-3 py-2">
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          ↺
        </button>
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          ↻
        </button>
        
        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />

        <button
          type="button"
          className={btn(editor.isActive("heading", { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={btn(editor.isActive("heading", { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>

        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />

        <button
          type="button"
          className={btn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={btn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={btn(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </button>

        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />

        <button
          type="button"
          className={btn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </button>
        <button
          type="button"
          className={btn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </button>
        <button
          type="button"
          className={btn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          “ Quote
        </button>
        <button
          type="button"
          className={btn(editor.isActive("link"))}
          onClick={() => {
            const url = window.prompt("Enter link URL:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          title="Add link"
        >
          🔗 Link
        </button>

        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />

        {uploadUrl && (
          <>
            <button
              type="button"
              disabled={uploading}
              className={btn(false, uploading ? "animate-pulse" : "")}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "📷 Photo"}
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
            <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />
            <button
              type="button"
              className={btn(false)}
              onClick={() => editor.chain().focus().updateFigureImage({ align: "left" }).run()}
              title="Align left"
            >
              Left
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={() => editor.chain().focus().updateFigureImage({ align: "center" }).run()}
              title="Align center"
            >
              Center
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={() => editor.chain().focus().updateFigureImage({ align: "full" }).run()}
              title="Full width"
            >
              Full
            </button>
            <button
              type="button"
              className={btn(false)}
              onClick={() => {
                const caption = window.prompt("Image caption (optional):");
                if (caption !== null) editor.chain().focus().updateFigureImage({ caption }).run();
              }}
            >
              Caption
            </button>
          </>
        )}

        <span className="mx-1 h-4 w-px bg-ink-200" aria-hidden="true" />
        
        <button
          type="button"
          className={btn(false)}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          ⊞ Table
        </button>

        {editor.isActive("table") && (
          <>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addRowAfter().run()}>
              +Row
            </button>
            <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addColumnAfter().run()}>
              +Col
            </button>
            <button type="button" className={btn(false, "text-signal")} onClick={() => editor.chain().focus().deleteTable().run()}>
              ✕ Table
            </button>
          </>
        )}
      </div>

      {/* Editor Content Surface */}
      <div className="editor-body px-6 sm:px-10 py-6 min-h-[420px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
