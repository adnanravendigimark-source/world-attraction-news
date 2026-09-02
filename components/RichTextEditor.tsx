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
  placeholder = "Start writing your article here...",
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
          “ Quote
        </button>
        <button
          type="button"
          className={btn(editor.isActive("link"))}
          onClick={() => {
            const currentHref = editor.getAttributes("link").href;
            const url = window.prompt("Enter link URL:", currentHref || "");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
            } else {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          title="Insert / Edit Link"
        >
          🔗 Link
        </button>

        {uploadUrl && (
          <>
            <span className="mx-1 h-3.5 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              disabled={uploading}
              className={btn(false, uploading ? "animate-pulse" : "")}
              onClick={() => fileInputRef.current?.click()}
              title="Insert Image in Body"
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
      </div>

      {/* Editor Content Writing Surface */}
      <div className="p-4 sm:p-6 min-h-[350px]">
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none focus:outline-none text-slate-800 text-sm sm:text-base leading-relaxed"
        />
      </div>
    </div>
  );
}
