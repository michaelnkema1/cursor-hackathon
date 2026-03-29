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
  if (/already registered/i.test(message)) {
    return "That email already has an account. Sign in instead.";
  }
  return message;
}

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!EMAIL_RE.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setFormError("Passwords do not match.");
      return;
    }

    if (!agree) {
      setFormError("Please agree to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        startTransition(() => {
          router.replace(nextPath);
          router.refresh();
        });
        return;
      }

      startTransition(() => {
        router.replace(`/login?registered=1&next=${encodeURIComponent(nextPath)}`);
      });
    } catch (error) {
      const message =
        error instanceof Error ? humanizeError(error.message) : "Sign up failed.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">
          Create account
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Set up your investigator account
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          We use Supabase auth so the workspace, uploads, and investigation API share the same identity.
        </p>
      </div>

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
          htmlFor={`${formId}-name`}
          className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Full name
        </label>
        <input
          id={`${formId}-name`}
          name="name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(ev) => setFullName(ev.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Ama Mensah"
          required
        />
      </div>

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
        <label
          htmlFor={`${formId}-password`}
          className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Password
        </label>
        <div className="relative">
          <input
            id={`${formId}-password`}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-24 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            placeholder="At least 8 characters"
            required
            minLength={8}
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

      <div>
        <label
          htmlFor={`${formId}-confirm`}
          className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
        >
          Confirm password
        </label>
        <input
          id={`${formId}-confirm`}
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(ev) => setConfirm(ev.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Repeat password"
          required
          minLength={8}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-600 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        <input
          type="checkbox"
          checked={agree}
          onChange={(ev) => setAgree(ev.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
        />
        <span className="leading-6">
          I understand this is a working investigation prototype and I want my account linked to submitted cases.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white shadow-[0_18px_35px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
      >
        {submitting ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link
          href={`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
          className="font-semibold text-sky-700 underline-offset-2 hover:underline dark:text-sky-300"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
