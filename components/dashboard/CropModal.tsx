"use client";

import { useRef, useState } from "react";

type Rect = { x: number; y: number; w: number; h: number };
type Handle = "nw" | "ne" | "sw" | "se";
type DragMode = "move" | Handle;

const MIN_SIZE = 40;

function resizeCorner(handle: Handle, dx: number, dy: number, s: Rect, d: { w: number; h: number }, ratio: number): Rect {
  if (handle === "se") {
    const maxW = Math.min(d.w - s.x, (d.h - s.y) * ratio);
    const w = Math.max(MIN_SIZE, Math.min(s.w + dx, maxW));
    return { x: s.x, y: s.y, w, h: w / ratio };
  }
  if (handle === "sw") {
    const maxW = Math.min(s.x + s.w, (d.h - s.y) * ratio);
    const w = Math.max(MIN_SIZE, Math.min(s.w - dx, maxW));
    return { x: s.x + s.w - w, y: s.y, w, h: w / ratio };
  }
  if (handle === "ne") {
    const maxW = Math.min(d.w - s.x, (s.y + s.h) * ratio);
    const w = Math.max(MIN_SIZE, Math.min(s.w + dx, maxW));
    const h = w / ratio;
    return { x: s.x, y: s.y, w, h: w / ratio };
  }
  // nw
  const maxW = Math.min(s.x + s.w, (s.y + s.h) * ratio);
  const w = Math.max(MIN_SIZE, Math.min(s.w - dx, maxW));
  const h = w / ratio;
  return { x: s.x, y: s.y, w, h: w / ratio };
}

export default function CropModal({
  src,
  aspectRatio,
  onCancel,
  onConfirm,
  onUseOriginal,
}: {
  src: string;
  aspectRatio: number;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onUseOriginal?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; startRect: Rect } | null>(null);

  const [disp, setDisp] = useState({ w: 480, h: 480 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      setError("Couldn't read this image's dimensions.");
      return;
    }
    const nW = img.naturalWidth;
    const nH = img.naturalHeight;
    const maxW = Math.min(520, window.innerWidth - 80);
    const maxH = Math.min(460, window.innerHeight - 300);
    let dW = maxW;
    let dH = dW * (nH / nW);
    if (dH > maxH) {
      dH = maxH;
      dW = dH * (nW / nH);
    }
    let rW: number;
    let rH: number;
    if (dW / dH > aspectRatio) {
      rH = dH;
      rW = rH * aspectRatio;
    } else {
      rW = dW;
      rH = rW / aspectRatio;
    }
    setNatural({ w: nW, h: nH });
    setDisp({ w: dW, h: dH });
    setRect({ x: (dW - rW) / 2, y: (dH - rH) / 2, w: rW, h: rH });
    setReady(true);
  }

  function handleImgError() {
    setError(
      "This image can't be loaded for cropping — it may be hosted somewhere that blocks cross-site use. You can still use it as-is without cropping."
    );
  }

  function startDrag(mode: DragMode, e: React.PointerEvent) {
    if (!ready) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startRect: rect };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const s = drag.startRect;

    if (drag.mode === "move") {
      const x = Math.min(Math.max(0, s.x + dx), disp.w - s.w);
      const y = Math.min(Math.max(0, s.y + dy), disp.h - s.h);
      setRect({ x, y, w: s.w, h: s.h });
      return;
    }

    setRect(resizeCorner(drag.mode, dx, dy, s, disp, aspectRatio));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    if (!imgRef.current || !natural.w) return;
    setSaving(true);
    setError("");
    try {
      const scale = natural.w / disp.w;
      const sx = rect.x * scale;
      const sy = rect.y * scale;
      const sW = rect.w * scale;
      const sH = rect.h * scale;
      const outW = Math.round(Math.min(1600, Math.max(320, sW)));
      const outH = Math.round(outW / aspectRatio);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no-canvas");
      ctx.drawImage(imgRef.current, sx, sy, sW, sH, 0, 0, outW, outH);
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("tainted");
      onConfirm(blob);
    } catch {
      setError(
        "This image can't be cropped in the browser (likely a cross-origin restriction on where it's hosted). Try re-uploading the file directly, or use it as-is without cropping."
      );
      setSaving(false);
    }
  }

  const handleClass =
    "absolute h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow touch-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-stone-900">Adjust crop</h3>
        <p className="mt-1 text-sm text-stone-500">Drag the box to reposition it, drag a corner handle to resize.</p>

        <div
          className="relative mx-auto mt-4 select-none overflow-hidden rounded-lg border border-stone-300 bg-stone-100"
          style={{ width: disp.w, height: disp.h }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            onLoad={handleImgLoad}
            onError={handleImgError}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={ready ? undefined : { opacity: 0 }}
          />
          {!ready && !error && (
            <div className="flex h-full items-center justify-center text-sm text-stone-400">Loading…</div>
          )}

          {ready && (
            <div
              className="absolute touch-none"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                cursor: "move",
              }}
              onPointerDown={(e) => startDrag("move", e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <div className="pointer-events-none absolute inset-0 border-2 border-white/90">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/50" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/50" />
                <div className="absolute top-1/3 left-0 h-px w-full bg-white/50" />
                <div className="absolute top-2/3 left-0 h-px w-full bg-white/50" />
              </div>
              <div className={`${handleClass} -left-2 -top-2 cursor-nwse-resize`} onPointerDown={(e) => startDrag("nw", e)} />
              <div className={`${handleClass} -right-2 -top-2 cursor-nesw-resize`} onPointerDown={(e) => startDrag("ne", e)} />
              <div className={`${handleClass} -bottom-2 -left-2 cursor-nesw-resize`} onPointerDown={(e) => startDrag("sw", e)} />
              <div className={`${handleClass} -bottom-2 -right-2 cursor-nwse-resize`} onPointerDown={(e) => startDrag("se", e)} />
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
          >
            Cancel
          </button>
          {onUseOriginal && (
            <button
              type="button"
              onClick={onUseOriginal}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
            >
              Use original, uncropped
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!ready || saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
