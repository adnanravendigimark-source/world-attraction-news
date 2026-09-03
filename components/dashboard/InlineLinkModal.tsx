"use client";

import { useState } from "react";

// The link-insert dialog for RichTextEditor's "Link" toolbar button — only
// ever rendered when the editor is opened with allowLinks (admin's Article
// Review panel). Contributors never see this: RichTextEditor omits the
// Link extension and this modal entirely unless allowLinks is set.
export default function InlineLinkModal({
  onInsert,
  onClose,
}: {
  onInsert: (opts: { url: string; nofollow: boolean; newTab: boolean }) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [nofollow, setNofollow] = useState(false);
  const [newTab, setNewTab] = useState(false);

  function handleInsert() {
    if (!url.trim()) return;
    onInsert({ url: url.trim(), nofollow, newTab });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">Insert link</h3>
        <p className="mt-1 text-sm text-slate-500">
          Paste a full address, or a relative path for an internal link (e.g. /latest-news/some-article).
          &quot;https://&quot; is added automatically if you leave it off.
        </p>

        <input
          type="text"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleInsert();
            }
          }}
          placeholder="example.com or /latest-news/some-article"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#DC2626] focus:outline-none focus:ring-1 focus:ring-[#DC2626]"
        />

        <div className="mt-4">
          <span className="mb-1.5 block text-xs font-medium text-slate-700">Open link in</span>
          <div className="flex gap-4 text-sm text-slate-700">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="link-target"
                checked={!newTab}
                onChange={() => setNewTab(false)}
                className="h-4 w-4 border-slate-300"
              />
              Same tab
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="link-target"
                checked={newTab}
                onChange={() => setNewTab(true)}
                className="h-4 w-4 border-slate-300"
              />
              New tab
            </label>
          </div>
        </div>

        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={nofollow}
            onChange={(e) => setNofollow(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            No follow
            <span className="block text-xs text-slate-500">
              Adds rel=&quot;nofollow&quot; — tells search engines not to pass ranking credit through
              this link. Good for sponsored, affiliate, or untrusted links.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!url.trim()}
            className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#B91C1C] disabled:opacity-60 cursor-pointer"
          >
            Insert link
          </button>
        </div>
      </div>
    </div>
  );
}
