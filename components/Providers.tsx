"use client";

import ToastProvider from "./ToastProvider";
import ConfirmProvider from "./ConfirmProvider";

// Single client-side wrapper mounted once in the root layout so useToast()/
// useConfirm() work the same way on every page — public site, contributor
// dashboard, and admin panel alike.
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
