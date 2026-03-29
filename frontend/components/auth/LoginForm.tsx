"use client";

import Link from "next/link";
import { startTransition, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/browser";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/dashboard";
  }
  return nextPath;
}

function humanizeError(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return "Those credentials did not match an account. Check your email and password.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Check your email first, then come back and sign in.";
  }
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();
  const nextPath = safeNextPath(searchParams.get("next"));
  const showRegisteredHint = searchParams.get("registered") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      startTransition(() => {
        router.replace(nextPath);
        router.refresh();
      });
    } catch (error) {
      const message =
        error instanceof Error ? humanizeError(error.message) : "Sign in failed.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">
          Sign in
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Welcome back
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Sign in to open the protected map, log new cases, and track evidence-backed investigations.
        </p>
      </div>

      {showRegisteredHint ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          Account created. Sign in with the email and password you just set up.
        </p>
      ) : null}

      {formError ? (
        <p
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <div>
        <label
          htmlFor={`${formId}-email`}
          className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
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
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor={`${formId}-password`}
            className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Password
          </label>
          <Link
            href="/signup"
            className="text-xs font-semibold text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200"
          >
            Need an account?
          </Link>
        </div>
        <div className="relative">
          <input
            id={`${formId}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={remember ? "current-password" : "off"}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-24 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            placeholder="At least 8 characters"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/50"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        <input
          type="checkbox"
          checked={remember}
          onChange={(ev) => setRemember(ev.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
        />
        Keep me signed in on this device
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white shadow-[0_18px_35px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        New here?{" "}
        <Link
          href={`/signup${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
