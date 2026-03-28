"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();
  const showRegisteredHint = searchParams.get("registered") === "demo";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      router.push("/?signedIn=demo");
    }, 1_200);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {showRegisteredHint ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          Demo account created. Sign in with any valid email and an 8+ character
          password.
        </p>
      ) : null}
      {formError ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <div>
        <label
          htmlFor={`${formId}-email`}
          className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Email
        </label>
        <input
          id={`${formId}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label
            htmlFor={`${formId}-password`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Password
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Demo — any 8+ chars
          </span>
        </div>
        <div className="relative">
          <input
            id={`${formId}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 pr-24 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="••••••••"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/50"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 touch-manipulation">
        <input
          type="checkbox"
          checked={remember}
          onChange={(ev) => setRemember(ev.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Keep me signed in on this device
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full min-h-12 touch-manipulation rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-600 dark:hover:bg-sky-500"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        No account yet?{" "}
        <Link
          href="/signup"
          className="font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
