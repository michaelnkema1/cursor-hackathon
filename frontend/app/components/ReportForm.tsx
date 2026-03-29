"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/browser";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tw", label: "Twi" },
  { value: "custom", label: "Custom language code" },
] as const;

type SubmitState = "idle" | "uploading" | "submitting";

function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location was blocked. Allow location access in your browser settings and try again.";
    case err.POSITION_UNAVAILABLE:
      return "Could not determine position. Turn on Location Services and try again.";
    case err.TIMEOUT:
      return "Location timed out. Try again near a window or outdoors.";
    default:
      return err.message?.trim() || "Could not read your location.";
  }
}

function getCurrentPositionPromise(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

type SubmitSuccess = {
  issueId: string;
  message: string;
};

export function ReportForm() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGE_OPTIONS)[number]["value"]>("en");
  const [customLanguage, setCustomLanguage] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);

  const revokePreview = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setLanguage("en");
    setCustomLanguage("");
    setMediaFile(null);
    revokePreview();
    setLatitude("");
    setLongitude("");
    setLocationStatus("idle");
    setLocationError(null);
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [revokePreview]);

  const resolvedLanguage =
    language === "custom" ? customLanguage.trim().toLowerCase() : language;

  const handleGetLocation = async () => {
    setLocationStatus("loading");
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Location is not supported in this browser.");
      return;
    }

    try {
      const pos = await getCurrentPositionPromise({
        enableHighAccuracy: false,
        timeout: 25_000,
        maximumAge: 120_000,
      });
      setLatitude(String(pos.coords.latitude));
      setLongitude(String(pos.coords.longitude));
      setLocationStatus("idle");
    } catch (first) {
      try {
        const pos = await getCurrentPositionPromise({
          enableHighAccuracy: true,
          timeout: 35_000,
          maximumAge: 0,
        });
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setLocationStatus("idle");
      } catch (second) {
        const err = (second || first) as GeolocationPositionError;
        setLocationStatus("error");
        setLocationError(geolocationErrorMessage(err));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setMediaFile(file);
    revokePreview();

    if (!file) return;

    if (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/")
    ) {
      const url = URL.createObjectURL(file);
      previewObjectUrlRef.current = url;
      setPreviewUrl(url);
    }
  };

  const uploadMediaIfNeeded = async () => {
    if (!mediaFile) {
      return {
        photo_path: undefined,
        audio_path: undefined,
        video_path: undefined,
      };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Please sign in again before uploading media.");
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "reports";
    const path = `${user.id}/${crypto.randomUUID()}_${cleanFilename(mediaFile.name)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, mediaFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: mediaFile.type || undefined,
    });

    if (error) {
      throw new Error(error.message || "Could not upload media.");
    }

    if (mediaFile.type.startsWith("video/")) {
      return { photo_path: undefined, audio_path: undefined, video_path: path };
    }

    if (mediaFile.type.startsWith("audio/")) {
      return { photo_path: undefined, audio_path: path, video_path: undefined };
    }

    return { photo_path: path, audio_path: undefined, video_path: undefined };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);

    if (!title.trim()) {
      setSubmitError("Add a short title so the case is easy to scan later.");
      return;
    }

    if (!description.trim()) {
      setSubmitError("Describe the problem before submitting.");
      return;
    }

    if (!latitude || !longitude) {
      setSubmitError("Capture your location first.");
      return;
    }

    if (!resolvedLanguage) {
      setSubmitError("Provide a valid language code.");
      return;
    }

    try {
      setSubmitState(mediaFile ? "uploading" : "submitting");
      const mediaPayload = await uploadMediaIfNeeded();

      setSubmitState("submitting");
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          description_language: resolvedLanguage,
          voice_language:
            mediaFile &&
            (mediaFile.type.startsWith("audio/") || mediaFile.type.startsWith("video/"))
              ? resolvedLanguage
              : undefined,
          lat: Number(latitude),
          lng: Number(longitude),
          ...mediaPayload,
        }),
      });

      const payload = (await response.json()) as {
        issue_id?: string;
        message?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(payload.detail || payload.message || "Could not log case.");
      }

      setSuccess({
        issueId: payload.issue_id ?? "unknown",
        message: payload.message ?? "Case received successfully.",
      });
      resetForm();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not log case.",
      );
    } finally {
      setSubmitState("idle");
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <div className="rounded-[2rem] border border-emerald-200 bg-white/85 p-8 shadow-[0_24px_90px_rgba(16,185,129,0.16)] backdrop-blur-xl dark:border-emerald-900 dark:bg-slate-950/85">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Case logged
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            {success.message}
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            Issue ID: <span className="font-mono">{success.issueId}</span>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              Log another case
            </button>
            <Link
              href="/dashboard"
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Return to workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:gap-10">
      <div className="lg:w-[min(100%,26rem)]">
        <div className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">
            New case
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Capture the problem clearly
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            This form uploads evidence to Supabase storage and sends the case to the protected FastAPI backend.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Multilingual intake
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Use English, Twi, or a custom Khaya language code. Audio and video can reuse the same language hint, and the AI will classify the case for you.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Evidence support
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Upload one image, audio file, or video clip. The backend can store and analyze each evidence type separately.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Location context
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Grab location before submission so the map and nearby-case views stay useful.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <form
          id={formId}
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-white/60 bg-white/82 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 sm:p-8"
        >
          {submitError ? (
            <p
              className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label
                htmlFor={`${formId}-title`}
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Title *
              </label>
              <input
                id={`${formId}-title`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Broken login flow after overnight deploy"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor={`${formId}-language`}
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Language *
              </label>
              <select
                id={`${formId}-language`}
                value={language}
                onChange={(e) =>
                  setLanguage(
                    e.target.value as (typeof LANGUAGE_OPTIONS)[number]["value"],
                  )
                }
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {language === "custom" ? (
              <div className="lg:col-span-2">
                <label
                  htmlFor={`${formId}-custom-language`}
                  className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  Custom language code *
                </label>
                <input
                  id={`${formId}-custom-language`}
                  type="text"
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  placeholder="Example: tw"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                  required
                />
              </div>
            ) : null}

            <div className="lg:col-span-2">
              <label
                htmlFor={`${formId}-description`}
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Description *
              </label>
              <textarea
                id={`${formId}-description`}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem in whatever language is easiest for the reporter."
                className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base leading-7 text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor={`${formId}-media`}
                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
              >
                Media (image, audio, or video)
              </label>
              <input
                ref={fileInputRef}
                id={`${formId}-media`}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
                className="sr-only"
                tabIndex={-1}
              />
              <label
                htmlFor={`${formId}-media`}
                className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center transition hover:border-sky-400 hover:bg-sky-50/60 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
              >
                {mediaFile && previewUrl ? (
                  <>
                    {mediaFile.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt=""
                        className="max-h-60 w-full rounded-2xl object-contain"
                      />
                    ) : mediaFile.type.startsWith("video/") ? (
                      <video
                        src={previewUrl}
                        controls
                        className="max-h-60 w-full rounded-2xl object-contain"
                      />
                    ) : (
                      <div className="rounded-full bg-sky-100 p-4 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18.75a6.75 6.75 0 006.75-6.75v-4.5a6.75 6.75 0 10-13.5 0V12A6.75 6.75 0 0012 18.75z"
                          />
                        </svg>
                      </div>
                    )}
                    <span className="mt-3 max-w-full truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {mediaFile.name}
                    </span>
                    <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Tap to change media
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rounded-full bg-sky-100 p-4 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                      <svg
                        className="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 16.5V3.75m0 12.75l4.5-4.5m-4.5 4.5l-4.5-4.5M3.75 16.5v1.125A2.625 2.625 0 006.375 20.25h11.25a2.625 2.625 0 002.625-2.625V16.5"
                        />
                      </svg>
                    </span>
                    <span className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">
                      Upload one image, video, or audio clip
                    </span>
                    <span className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Video and audio uploads can carry the same language code for later Khaya transcription.
                    </span>
                  </>
                )}
              </label>
            </div>

            <div className="lg:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Location *
              </span>
              <div className="grid gap-3 sm:grid-cols-[220px_1fr_1fr]">
                <button
                  type="button"
                  onClick={() => {
                    void handleGetLocation();
                  }}
                  disabled={locationStatus === "loading"}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/40"
                >
                  {locationStatus === "loading" ? "Getting location..." : "Get location"}
                </button>
                <input
                  readOnly
                  value={latitude}
                  placeholder="Latitude"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
                <input
                  readOnly
                  value={longitude}
                  placeholder="Longitude"
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              {locationError ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
                  {locationError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Signed-in submissions are sent to <span className="font-mono">/api/reports</span>, which forwards the case to the FastAPI backend using your Supabase session.
            </p>
            <button
              type="submit"
              disabled={submitState !== "idle"}
              className="rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(15,23,42,0.22)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              {submitState === "uploading"
                ? "Uploading media..."
                : submitState === "submitting"
                  ? "Logging case..."
                  : "Log case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
