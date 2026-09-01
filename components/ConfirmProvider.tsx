"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Red/destructive styling for the confirm button (delete, reject,
  // suspend, demote) vs. the default dark styling (approve, publish).
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Returns an async confirm(options) function — `if (!(await confirm({...})))
// return;` — used everywhere an admin (or contributor) action needs an "are
// you sure?" step before it fires, instead of the browser's unstyled
// window.confirm().
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  function resolve(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink-900/50"
            onClick={() => resolve(false)}
            aria-hidden="true"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-lift"
          >
            <p id="confirm-dialog-title" className="font-serif text-base font-bold text-ink-900">
              {pending.options.title}
            </p>
            {pending.options.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{pending.options.description}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolve(false)}
                className="rounded-md border border-ink-300 px-3.5 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                {pending.options.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => resolve(true)}
                autoFocus
                className={`rounded-md px-3.5 py-1.5 text-xs font-semibold text-white ${
                  pending.options.danger ? "bg-signal hover:bg-signal-dark" : "bg-ink-900 hover:bg-ink-800"
                }`}
              >
                {pending.options.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
