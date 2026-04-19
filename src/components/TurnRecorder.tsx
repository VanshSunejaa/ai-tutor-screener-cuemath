"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type TurnRecorderState = "idle" | "listening" | "stopping" | "error";

export type TurnRecorderHandle = {
  startTurn: () => Promise<Blob>;
  stop: () => void;
  getState: () => TurnRecorderState;
};

type Props = {
  disabled?: boolean;
  silenceMs?: number; // stop after this much silence
  minTurnMs?: number; // ignore turns shorter than this
  threshold?: number; // RMS threshold
  maxTurnMs?: number; // hard stop even if noisy
  onStateChange?: (s: TurnRecorderState) => void;
};

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

export const TurnRecorder = forwardRef<TurnRecorderHandle, Props>(function TurnRecorder(
  {
    disabled,
    silenceMs = 1700,
    minTurnMs = 700,
    threshold = 0.02,
    maxTurnMs = 25_000,
    onStateChange,
  }: Props,
  ref,
) {
  const [state, setState] = useState<TurnRecorderState>("idle");
  const stateRef = useRef<TurnRecorderState>("idle");
  const disabledRef = useRef<boolean>(!!disabled);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const lastVoiceAtRef = useRef<number>(0);
  const firstVoiceAtRef = useRef<number | null>(null);
  const resolveRef = useRef<((b: Blob) => void) | null>(null);
  const rejectRef = useRef<((e: unknown) => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setStateSafe = useCallback(
    (s: TurnRecorderState) => {
      stateRef.current = s;
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange],
  );

  useEffect(() => {
    disabledRef.current = !!disabled;
  }, [disabled]);

  const cleanupMedia = useCallback(() => {
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
  }, []);

  useEffect(() => cleanupMedia, [cleanupMedia]);

  const stop = useCallback(() => {
    if (stateRef.current === "idle") return;
    setStateSafe("stopping");
    cleanupMedia();
    setStateSafe("idle");
  }, [cleanupMedia, setStateSafe]);

  const startTurn = useCallback(async (): Promise<Blob> => {
    if (disabledRef.current) throw new Error("Recorder disabled");
    if (stateRef.current !== "idle") throw new Error("Recorder already running");

    setStateSafe("listening");
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    lastVoiceAtRef.current = Date.now();
    firstVoiceAtRef.current = null;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
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
      setStateSafe("error");
      rejectRef.current?.(new Error("MediaRecorder error"));
      stop();
    };

    const donePromise = new Promise<Blob>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
    });

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      const durationMs = Date.now() - startedAtRef.current;
      const resolve = resolveRef.current;
      const reject = rejectRef.current;
      resolveRef.current = null;
      rejectRef.current = null;

      cleanupMedia();
      setStateSafe("idle");
      if (durationMs < minTurnMs || blob.size < 1500) {
        reject?.(new Error("TURN_TOO_SHORT"));
        return;
      }
      resolve?.(blob);
    };

    mr.start(250);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    // Calibrate noise floor for ~300ms to avoid "never silent" in noisy rooms.
    const CALIBRATION_MS = 300;
    const calibrationStart = Date.now();
    let noiseSum = 0;
    let noiseN = 0;
    let dynamicThreshold = threshold;

    const loop = () => {
      if (stateRef.current !== "listening") return;
      const a = analyserRef.current;
      if (!a) return;
      a.getByteTimeDomainData(buf);

      // waveform
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const { width, height } = canvas;
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "#f4f4f5";
          ctx.fillRect(0, 0, width, height);
          ctx.strokeStyle = "#18181b";
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

      // RMS
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();
      if (now - calibrationStart < CALIBRATION_MS) {
        noiseSum += rms;
        noiseN += 1;
      } else if (noiseN > 0) {
        const noiseAvg = noiseSum / noiseN;
        // Threshold = max(user threshold, noiseAvg*3 + small margin)
        dynamicThreshold = Math.max(threshold, noiseAvg * 3 + 0.005);
        noiseN = 0; // only compute once
      }

      if (rms > dynamicThreshold) {
        lastVoiceAtRef.current = now;
        if (firstVoiceAtRef.current == null) firstVoiceAtRef.current = now;
      }

      if (now - lastVoiceAtRef.current > silenceMs) {
        try {
          mr.stop();
        } catch {}
        return;
      }

      // Hard stop so we never get stuck in LISTENING
      if (now - startedAtRef.current > maxTurnMs) {
        try {
          mr.stop();
        } catch {}
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return donePromise;
  }, [cleanupMedia, maxTurnMs, minTurnMs, setStateSafe, silenceMs, stop, threshold]);

  useImperativeHandle(
    ref,
    () => ({
      startTurn,
      stop,
      getState: () => stateRef.current,
    }),
    [startTurn, stop],
  );

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={560}
        height={64}
        className={[
          "w-full rounded-xl border border-zinc-200",
          state === "listening" ? "" : "opacity-60",
        ].join(" ")}
      />
      <div className="mt-2 text-xs text-zinc-500">
        {state === "listening"
          ? "Listening… (auto-stops on ~2s silence)"
          : state === "stopping"
            ? "Stopping…"
            : state === "error"
              ? "Mic error"
              : "Ready"}
      </div>
    </div>
  );
});

