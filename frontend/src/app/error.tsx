"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-zinc-100">Something went wrong</h1>
        <p className="text-zinc-400 text-sm">
          An unexpected error occurred. Please try again or contact support if the problem
          persists.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-violet-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-600 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
