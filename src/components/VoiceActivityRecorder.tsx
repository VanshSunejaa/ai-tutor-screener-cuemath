"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onUtterance: (blob: Blob) => Promise<void> | void;
  onUserSpeakingChange?: (speaking: boolean) => void;
  onModeChange?: (mode: "idle" | "listening" | "sending" | "error") => void;
};

type Mode = "idle" | "listening" | "sending" | "error";

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export function VoiceActivityRecorder({
  disabled,
  onUtterance,
  onUserSpeakingChange,
  onModeChange,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const modeRef = useRef<Mode>("idle");
  const disabledRef = useRef<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceAtRef = useRef<number>(0);
  const utteranceStartedAtRef = useRef<number>(0);
  const flushingRef = useRef(false);

  useEffect(() => {
    disabledRef.current = !!disabled;
  }, [disabled]);

  const setModeSafe = useCallback(
    (m: Mode) => {
      modeRef.current = m;
      setMode(m);
      onModeChange?.(m);
    },
    [onModeChange],
  );

  const canRecord = useMemo(() => typeof window !== "undefined" && !!navigator.mediaDevices, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    chunksRef.current = [];
    speakingRef.current = false;
    setSpeaking(false);
    onUserSpeakingChange?.(false);
  }, [onUserSpeakingChange]);

  useEffect(() => cleanup, [cleanup]);

  async function start() {
    if (disabled) return;
    setError(null);
    if (!canRecord) {
      setError("Your browser doesn’t support microphone recording.");
      setModeSafe("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      // Some browsers start AudioContext suspended until user gesture. This is a user gesture.
      await audioCtx.resume().catch(() => {});
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      src.connect(analyser);

      const mimeType = pickMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onerror = () => {
        setError("Recording error. Please retry.");
        setModeSafe("error");
      };
      mr.start(250); // capture in small chunks

      lastVoiceAtRef.current = Date.now();
      utteranceStartedAtRef.current = Date.now();
      setModeSafe("listening");

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const THRESHOLD = 0.02; // RMS threshold
      const SILENCE_MS = 600; // faster turn-taking
      const MIN_UTTERANCE_MS = 600;

      const loop = () => {
        if (!analyserRef.current) return;
        const analyserNode = analyserRef.current;
        analyserNode.getByteTimeDomainData(buf);

        // Draw waveform
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const { width, height } = canvas;
            ctx.clearRect(0, 0, width, height);

            ctx.fillStyle = "#f4f4f5";
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = speakingRef.current ? "#18181b" : "#71717a";
            ctx.lineWidth = 2;
            ctx.beginPath();
            const sliceWidth = width / buf.length;
            let x = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = buf[i]! / 255;
              const y = v * height;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
            ctx.stroke();
          }
        }

        // RMS over centered waveform
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i]! - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);

        const now = Date.now();
        const isVoice = rms > THRESHOLD;
        if (isVoice) lastVoiceAtRef.current = now;

        const newSpeaking = now - lastVoiceAtRef.current < 250;
        if (newSpeaking !== speakingRef.current) {
          speakingRef.current = newSpeaking;
          setSpeaking(newSpeaking);
          onUserSpeakingChange?.(newSpeaking);
        }

        // If we’ve been silent long enough, flush an utterance
        if (
          !flushingRef.current &&
          now - lastVoiceAtRef.current > SILENCE_MS &&
          now - utteranceStartedAtRef.current > MIN_UTTERANCE_MS &&
          chunksRef.current.length > 0
        ) {
          flushingRef.current = true;
          flushUtterance()
            .catch(() => {})
            .finally(() => {
              flushingRef.current = false;
              utteranceStartedAtRef.current = Date.now();
            });
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setError("Microphone permission denied. Please allow access and retry.");
      setModeSafe("error");
    }
  }

  async function flushUtterance() {
    if (disabledRef.current) return;
    if (modeRef.current !== "listening") return;
    const mr = recorderRef.current;
    if (!mr) return;

    const parts = chunksRef.current;
    chunksRef.current = [];
    const blob = new Blob(parts, { type: mr.mimeType || "audio/webm" });
    if (blob.size < 1500) return;

    setModeSafe("sending");
    try {
      await onUtterance(blob);
    } finally {
      setModeSafe("listening");
    }
  }

  function stop() {
    cleanup();
    setModeSafe("idle");
    setError(null);
  }

  const isListening = mode === "listening";
  const isSending = mode === "sending";

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isListening || isSending ? stop : start}
          disabled={disabled}
          className={[
            "inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition",
            isListening || isSending
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "bg-zinc-900 text-white hover:bg-zinc-800",
            disabled ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {isListening || isSending ? "Stop" : "Enable mic"}
        </button>

        <div className="text-sm text-zinc-600">
          {isSending ? "Sending..." : isListening ? (speaking ? "Listening…" : "Listening (waiting)…") : "Hands-free mode"}
        </div>
      </div>

      <div className="mt-3">
        <canvas
          ref={canvasRef}
          width={560}
          height={64}
          className={[
            "w-full rounded-xl border",
            isListening || isSending ? "border-zinc-200" : "border-zinc-100 opacity-60",
          ].join(" ")}
        />
      </div>

      {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
    </div>
  );
}

