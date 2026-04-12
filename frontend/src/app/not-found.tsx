import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-7xl font-bold text-violet-500">404</p>

        <h1 className="text-2xl font-bold text-zinc-100">Page not found</h1>
        <p className="text-zinc-400 text-sm">
          The page you are looking for does not exist or has been moved.
        </p>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-600 transition"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
