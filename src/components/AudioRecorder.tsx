"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onRecorded: (blob: Blob) => Promise<void> | void;
};

type RecState = "idle" | "recording" | "processing";

export function AudioRecorder({ disabled, onRecorded }: Props) {
  const [state, setState] = useState<RecState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);

  const canRecord = useMemo(() => typeof window !== "undefined" && !!navigator.mediaDevices, []);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    if (disabled) return;
    if (!canRecord) {
      setError("Your browser doesn’t support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onerror = () => setError("Recording error. Please try again.");
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const durationMs = Date.now() - startedAtRef.current;
        if (durationMs < 800 || blob.size < 1200) {
          setState("idle");
          setError("That was too short—please record a bit longer.");
          return;
        }
        setState("processing");
        try {
          await onRecorded(blob);
        } finally {
          setState("idle");
        }
      };

      setState("recording");
      mr.start();
    } catch {
      setError("Microphone permission denied. Please allow access and retry.");
    }
  }

  function stop() {
    if (disabled) return;
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    try {
      mr.stop();
    } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const isRecording = state === "recording";
  const isProcessing = state === "processing";

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? stop : start}
          disabled={disabled || isProcessing}
          className={[
            "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition",
            isRecording ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-zinc-900 text-white hover:bg-zinc-800",
            disabled || isProcessing ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {isRecording ? "Stop" : "Record"}
        </button>

        <div className="text-sm text-zinc-600">
          {isRecording ? "Listening..." : isProcessing ? "Uploading..." : "Tap record and answer out loud"}
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
    </div>
  );
}

