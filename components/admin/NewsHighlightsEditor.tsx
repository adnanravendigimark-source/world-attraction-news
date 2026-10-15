"use client";

import { useState } from "react";

// Editor for the two boxes shown beside a news story on the public page:
// "Key Updates" and "What Travelers Should Do". One item per line; saved
// with the article's Save button. "Write with AI" fills both from the
// story's research and fact-checks them (bullets the check flags are removed).
export default function NewsHighlightsEditor({
  articleId,
  keyUpdates,
  travelerSteps,
  onChange,
  hasUnsavedEdits,
}: {
  articleId: string;
  keyUpdates: string;
  travelerSteps: string;
  onChange: (field: "keyUpdates" | "travelerSteps", value: string) => void;
  hasUnsavedEdits: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const count = (v: string) => v.split("\n").filter((l) => l.trim()).length;

  async function writeWithAi() {
    setConfirm(false);
    setBusy(true);
    setMsg("Writing the bullets and checking them against the research… about 40 seconds.");
    try {
      const res = await fetch("/api/admin/news/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, action: "highlights" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Failed.");
      window.location.reload(); // show the saved bullets and the new check
      return;
    } catch (e: any) {
      setMsg(e.message || "Request failed. Try again.");
    }
    setBusy(false);
  }

  const box = "w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none leading-relaxed shadow-2xs";
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <div>
        <p className="text-xs font-bold text-slate-900">Key Updates and What Travelers Should Do</p>
        <p className="text-[11px] text-slate-500">
          Shown in two boxes beside the story. One item per line. They are fact-checked with the story; edit them, save, then re-run the fact check.
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="key-updates" className="text-xs font-bold text-slate-900">
            Key Updates <span className="font-normal text-slate-400">(3–4 short facts)</span>
          </label>
          <span className={`font-mono text-[11px] ${count(keyUpdates) > 4 ? "font-bold text-amber-600" : "text-slate-400"}`}>{count(keyUpdates)}/4</span>
        </div>
        <textarea
          id="key-updates"
          rows={4}
          value={keyUpdates}
          onChange={(e) => onChange("keyUpdates", e.target.value)}
          placeholder={"Multiple airlines have cancelled or suspended flights to Riyadh.\nOperations at King Khalid International Airport remain suspended."}
          className={box}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="traveler-steps" className="text-xs font-bold text-slate-900">
            What Travelers Should Do <span className="font-normal text-slate-400">(2–4 steps, start with a verb; leave empty if none)</span>
          </label>
          <span className={`font-mono text-[11px] ${count(travelerSteps) > 4 ? "font-bold text-amber-600" : "text-slate-400"}`}>{count(travelerSteps)}/4</span>
        </div>
        <textarea
          id="traveler-steps"
          rows={4}
          value={travelerSteps}
          onChange={(e) => onChange("travelerSteps", e.target.value)}
          placeholder={"Check your flight status directly with your airline before travelling.\nAllow extra time for airport security checks."}
          className={box}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!confirm ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirm(true)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? "Writing…" : "Write both with AI"}
          </button>
        ) : (
          <>
            <span className="text-[11px] text-slate-700">
              Replaces both lists{hasUnsavedEdits ? " and discards your unsaved edits" : ""}.
            </span>
            <button type="button" onClick={writeWithAi} className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-bold text-white">
              Replace
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">
              Cancel
            </button>
          </>
        )}
      </div>
      {msg && <p className="text-[11px] text-slate-600">{msg}</p>}
    </div>
  );
}
