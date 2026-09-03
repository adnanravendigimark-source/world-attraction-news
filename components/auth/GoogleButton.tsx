// Plain <a> to a server route (not a client fetch) — Google's OAuth flow
// requires a real top-level browser navigation to accounts.google.com, not
// an XHR/fetch call.
export default function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <a
      href="/api/auth/google"
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300"
    >
      <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7.1 29.6 5 24 5c-7.5 0-14 4.2-17.3 10.4z"
          transform="translate(0 -1)"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6c-2 1.5-4.6 2.4-7.7 2.4-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C41.4 36.2 44 30.6 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
      </svg>
      <span>{label}</span>
    </a>
  );
}
