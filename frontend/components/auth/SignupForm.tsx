"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { saveUser } from "@/lib/auth";

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
    if (fullName.trim().length < 2) { setFormError("Please enter your full name."); return; }
    if (!EMAIL_RE.test(email.trim())) { setFormError("Enter a valid email address."); return; }
    if (password.length < 8) { setFormError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setFormError("Passwords do not match."); return; }
    if (!agree) { setFormError("Please agree to the terms to continue."); return; }
    setSubmitting(true);
    window.setTimeout(() => {
      // Save user immediately — they're now registered and signed in
      saveUser(fullName.trim(), email.trim());
      void router.push("/?signedIn=1");
    }, 900);
  };

  const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wider";
  const labelStyle = { color: "rgba(250,247,240,0.6)" };

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      {formError && (
        <p className="rounded-xl border px-3 py-2 text-sm animate-fade-in" style={{ background: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.3)", color: "#fca5a5" }} role="alert">
          {formError}
        </p>
      )}

      <div>
        <label htmlFor={`${formId}-name`} className={labelClass} style={labelStyle}>Full name</label>
        <input id={`${formId}-name`} name="name" type="text" autoComplete="name" value={fullName} onChange={(ev) => setFullName(ev.target.value)} className="input-dark" placeholder="Ama Mensah" required />
      </div>
      <div>
        <label htmlFor={`${formId}-email`} className={labelClass} style={labelStyle}>Email</label>
        <input id={`${formId}-email`} name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(ev) => setEmail(ev.target.value)} className="input-dark" placeholder="you@example.com" required />
      </div>
      <div>
        <label htmlFor={`${formId}-password`} className={labelClass} style={labelStyle}>Password</label>
        <div className="relative">
          <input id={`${formId}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(ev) => setPassword(ev.target.value)} className="input-dark pr-20" placeholder="At least 8 characters" required minLength={8} />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--gold-400)" }}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div>
        <label htmlFor={`${formId}-confirm`} className={labelClass} style={labelStyle}>Confirm password</label>
        <input id={`${formId}-confirm`} name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} className="input-dark" placeholder="Repeat password" required minLength={8} />
      </div>

      <label className="flex cursor-pointer items-start gap-3 touch-manipulation">
        <input type="checkbox" checked={agree} onChange={(ev) => setAgree(ev.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 rounded" style={{ accentColor: "var(--gold-500)" }} />
        <span className="text-sm leading-snug" style={{ color: "rgba(250,247,240,0.55)" }}>
          I agree to the <span className="font-medium" style={{ color: "var(--cream)" }}>demo terms</span> — this is a hackathon prototype.
        </span>
      </label>

      <button type="submit" disabled={submitting} className="btn-gold w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--surface-0)] border-t-transparent" />
            Creating account…
          </span>
        ) : "Create account"}
      </button>

      <p className="text-center text-sm" style={{ color: "rgba(250,247,240,0.45)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--gold-400)" }}>Sign in</Link>
      </p>
    </form>
  );
}
