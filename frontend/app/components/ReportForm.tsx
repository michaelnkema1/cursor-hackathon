"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const CATEGORIES = [
  "Electricity",
  "Water",
  "Roads",
  "Health",
  "Sanitation",
] as const;

function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location was blocked. On iPhone: Settings → Privacy → Location Services → Safari → allow, or tap Allow in the browser prompt.";
    case err.POSITION_UNAVAILABLE:
      return "Could not determine position. Turn on Location Services and try again (Wi‑Fi helps indoors).";
    case err.TIMEOUT:
      return "Location timed out. Try again near a window, outdoors, or with Wi‑Fi enabled.";
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

export function ReportForm() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const revokeImagePreview = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setImagePreviewUrl(null);
    setPreviewLoadError(false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const resetForm = useCallback(() => {
    setCategory("");
    setDescription("");
    setImageFile(null);
    revokeImagePreview();
    setLatitude("");
    setLongitude("");
    setLocationStatus("idle");
    setLocationError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [revokeImagePreview]);

  const handleGetLocation = async () => {
    setLocationStatus("loading");
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Location is not supported in this browser.");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      const h = window.location.hostname;
      if (h !== "localhost" && h !== "127.0.0.1") {
        setLocationStatus("error");
        setLocationError(
          "Location needs HTTPS. Use https:// or test on localhost.",
        );
        return;
      }
    }

    const apply = (pos: GeolocationPosition) => {
      setLatitude(String(pos.coords.latitude));
      setLongitude(String(pos.coords.longitude));
      setLocationStatus("idle");
      setLocationError(null);
    };

    try {
      // Mobile (especially iOS) often fails with high accuracy + maximumAge:0 indoors.
      // Prefer a fast approximate fix first, then retry with GPS if needed.
      const pos = await getCurrentPositionPromise({
        enableHighAccuracy: false,
        timeout: 25_000,
        maximumAge: 120_000,
      });
      apply(pos);
    } catch (first) {
      const e1 = first as GeolocationPositionError;
      try {
        const pos2 = await getCurrentPositionPromise({
          enableHighAccuracy: true,
          timeout: 35_000,
          maximumAge: 0,
        });
        apply(pos2);
      } catch (second) {
        const e2 = second as GeolocationPositionError;
        setLocationStatus("error");
        setLocationError(geolocationErrorMessage(e2 || e1));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      resetForm();
      setSubmitting(false);
      setSuccess(true);
    }, 1_500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    revokeImagePreview();
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      previewObjectUrlRef.current = url;
      setImagePreviewUrl(url);
      setPreviewLoadError(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
        <div className="rounded-2xl border border-emerald-200 bg-linear-to-b from-emerald-50 to-white p-8 text-center shadow-lg ring-1 ring-emerald-100 dark:border-emerald-800/80 dark:from-emerald-950/40 dark:to-slate-950 dark:ring-emerald-900/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            <svg
              className="h-9 w-9"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
            Report Submitted Successfully!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-800/90 dark:text-emerald-200/80">
            Thank you. Your infrastructure report has been received. Local
            authorities can use this information to prioritize fixes.
          </p>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="mt-8 w-full rounded-xl bg-emerald-600 px-5 py-4 text-base font-semibold text-white shadow-md transition hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            Submit another report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
          Civic Ghana
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Report an issue
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Describe infrastructure problems in your community. Fields marked
          with * are required.
        </p>
      </div>

      <form
        id={formId}
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
      >
        <div>
          <label
            htmlFor={`${formId}-image`}
            className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Photo (optional)
          </label>
          <input
            ref={fileInputRef}
            id={`${formId}-image`}
            name="image"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="sr-only"
            tabIndex={-1}
          />
          <label
            htmlFor={`${formId}-image`}
            className="flex min-h-[160px] cursor-pointer touch-manipulation flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-6 text-center transition hover:border-sky-400 hover:bg-sky-50/50 active:scale-[0.99] dark:border-slate-600 dark:bg-slate-900/50 dark:hover:border-sky-500 dark:hover:bg-sky-950/30"
          >
            {imagePreviewUrl && !previewLoadError ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt=""
                  className="mt-1 max-h-48 w-full max-w-full rounded-lg object-contain shadow-sm"
                  onError={() => setPreviewLoadError(true)}
                />
                {imageFile && (
                  <span className="mt-2 max-w-full truncate text-xs font-medium text-sky-700 dark:text-sky-300">
                    {imageFile.name}
                  </span>
                )}
                <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Tap to change photo
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-sky-100 p-3 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
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
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </span>
                <span className="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">
                  Tap to upload a photo
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  JPG, PNG, or HEIC — max one image
                </span>
                {previewLoadError && imageFile && (
                  <span className="mt-3 max-w-full text-xs font-medium text-amber-700 dark:text-amber-300">
                    Preview not available for this file type. Selected:{" "}
                    {imageFile.name}
                  </span>
                )}
              </>
            )}
          </label>
        </div>

        <div>
          <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">
            Location
          </span>
          <button
            type="button"
            onClick={() => {
              void handleGetLocation();
            }}
            disabled={locationStatus === "loading"}
            className="relative z-10 mb-3 w-full touch-manipulation rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:active:bg-slate-800"
          >
            {locationStatus === "loading"
              ? "Getting location..."
              : "Get My Location"}
          </button>
          {locationError && (
            <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {locationError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${formId}-lat`}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Latitude
              </label>
              <input
                id={`${formId}-lat`}
                readOnly
                value={latitude}
                placeholder="—"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label
                htmlFor={`${formId}-lng`}
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Longitude
              </label>
              <input
                id={`${formId}-lng`}
                readOnly
                value={longitude}
                placeholder="—"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-base text-slate-800 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor={`${formId}-category`}
            className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Category *
          </label>
          <select
            id={`${formId}-category`}
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full appearance-none rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-base text-slate-900 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${formId}-description`}
            className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
          >
            Description *
          </label>
          <textarea
            id={`${formId}-description`}
            name="description"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Where exactly? Is it blocking traffic or unsafe?"
            className="w-full resize-y rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-base leading-relaxed text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-5 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-sky-600 dark:hover:bg-sky-500"
        >
          {submitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}
