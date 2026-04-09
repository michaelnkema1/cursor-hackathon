"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { saveUser } from "@/lib/auth";

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
      // Save user to local auth store (demo — uses email prefix as name)
      const name = email.split("@")[0].replace(/[._]/g, " ");
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      saveUser(displayName, email);
      void router.push("/?signedIn=1");
    }, 900);
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {showRegisteredHint && (
        <p
          className="rounded-xl border px-3 py-2.5 text-sm animate-fade-in"
          style={{ background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)", color: "#6ee7b7" }}
        >
          Account created. Sign in with your email and 8+ character password.
        </p>
      )}
      {formError && (
        <p
          className="rounded-xl border px-3 py-2 text-sm animate-fade-in"
          style={{ background: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.3)", color: "#fca5a5" }}
          role="alert"
        >
          {formError}
        </p>
      )}

      <div>
        <label htmlFor={`${formId}-email`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,247,240,0.6)" }}>
          Email
        </label>
        <input id={`${formId}-email`} name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className="input-dark" placeholder="you@example.com" required />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor={`${formId}-password`} className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(250,247,240,0.6)" }}>Password</label>
          <span className="text-[10px]" style={{ color: "rgba(250,247,240,0.35)" }}>Demo — any 8+ chars</span>
        </div>
        <div className="relative">
          <input id={`${formId}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(ev) => setPassword(ev.target.value)} className="input-dark pr-20" placeholder="••••••••" required minLength={8} />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--gold-400)" }}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 touch-manipulation">
        <input type="checkbox" checked={remember} onChange={(ev) => setRemember(ev.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: "var(--gold-500)" }} />
        <span className="text-sm" style={{ color: "rgba(250,247,240,0.65)" }}>Keep me signed in</span>
      </label>

      <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--surface-0)] border-t-transparent" />
            Signing in…
          </span>
        ) : "Sign in"}
      </button>

      <p className="text-center text-sm" style={{ color: "rgba(250,247,240,0.45)" }}>
        No account?{" "}
        <Link href="/signup" className="font-semibold" style={{ color: "var(--gold-400)" }}>Create one</Link>
      </p>
    </form>
  );
}
