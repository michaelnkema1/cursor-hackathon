"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupForm() {
  const router = useRouter();
  const formId = useId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
      setFormError("Please agree to the terms to continue.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      router.push("/login?registered=demo");
    }, 1_200);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
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
          htmlFor={`${formId}-name`}
          className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
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
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Ama Mensah"
          required
        />
      </div>

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
        <label
          htmlFor={`${formId}-password`}
          className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
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
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 pr-24 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="At least 8 characters"
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

      <div>
        <label
          htmlFor={`${formId}-confirm`}
          className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
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
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          placeholder="Repeat password"
          required
          minLength={8}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 touch-manipulation">
        <input
          type="checkbox"
          checked={agree}
          onChange={(ev) => setAgree(ev.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900"
        />
        <span className="text-sm leading-snug text-slate-700 dark:text-slate-300">
          I agree to the{" "}
          <span className="font-medium text-slate-900 dark:text-slate-100">
            demo terms
          </span>{" "}
          — this is a hackathon prototype with no real legal agreement.
        </span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full min-h-12 touch-manipulation rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-600 dark:hover:bg-sky-500"
      >
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
