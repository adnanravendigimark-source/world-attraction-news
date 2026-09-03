import Link from "next/link";
import Logo from "@/components/Logo";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
      <Logo variant="mark" className="h-10 w-10" />
      <p className="mt-6 font-serif text-6xl font-bold text-ink-900">404</p>
      <h1 className="mt-2 text-lg font-bold text-ink-800">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">
        The page you're looking for doesn't exist or may have been removed.
      </p>
      <Link href="/" className="mt-6 rounded-md bg-signal px-5 py-2.5 text-sm font-semibold text-white hover:bg-signal-dark">
        Back to Homepage
      </Link>
    </div>
  );
}
