"use client";

import { useCallback, useState } from "react";
import Recaptcha from "@/components/Recaptcha";

export const RECAPTCHA_ENABLED = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

// Shared reCAPTCHA gating logic for every auth form (signup, login,
// admin-login). This used to be copy-pasted three times — the same state,
// the same "disable submit until verified" condition, and the same
// widget-or-fallback JSX, with the light/dark theme classes as the only
// real difference between call sites. useAuthRecaptcha() owns the state;
// <AuthRecaptcha /> renders the themed widget/fallback from it, so each
// form now just wires the two together instead of re-declaring all of it.
export function useAuthRecaptcha() {
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [recaptchaFailed, setRecaptchaFailed] = useState(false);

  const reset = useCallback(() => setRecaptchaToken(""), []);

  // True while the submit button should stay disabled: reCAPTCHA is
  // configured for this environment, hasn't failed/been skipped, and
  // hasn't produced a token yet.
  const blocked = RECAPTCHA_ENABLED && !recaptchaFailed && !recaptchaToken;

  return {
    recaptchaToken,
    recaptchaFailed,
    blocked,
    onVerify: setRecaptchaToken,
    onExpire: reset,
    onError: () => setRecaptchaFailed(true),
  };
}

export function AuthRecaptcha({
  state,
  theme = "light",
}: {
  state: ReturnType<typeof useAuthRecaptcha>;
  theme?: "light" | "dark";
}) {
  if (!RECAPTCHA_ENABLED) return null;

  if (state.recaptchaFailed) {
    return (
      <p
        className={
          theme === "dark"
            ? "rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-slate-400"
            : "rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500"
        }
      >
        {theme === "dark"
          ? "Spam verification bypassed for this session."
          : "Spam verification widget skipped for this session."}
      </p>
    );
  }

  return <Recaptcha onVerify={state.onVerify} onExpire={state.onExpire} onError={state.onError} />;
}
