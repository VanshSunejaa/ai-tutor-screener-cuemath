"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { Loader } from "@/components/Loader";
import { TurnRecorder, type TurnRecorderHandle } from "@/components/TurnRecorder";

type Turn = { role: "assistant" | "user"; text: string };

function fireEvent(tag: string, sessionId?: string, data?: Record<string, unknown>) {
  fetch("/api/client-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag, sessionId, at: Date.now(), data: data ?? {} }),
  }).catch(() => {});
}

let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

async function speakTurnBased(text: string, handlers?: { onStart?: () => void; onEnd?: () => void }) {
  stopSpeaking();

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error("TTS fetch failed");

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    currentAudioUrl = url;

    const audio = new Audio(url);
    currentAudio = audio;

    if (handlers?.onStart) {
      audio.onplay = handlers.onStart;
    }

    if (handlers?.onEnd) {
      audio.onended = () => {
        if (currentAudioUrl === url) {
          URL.revokeObjectURL(url);
          currentAudioUrl = null;
        }
        handlers.onEnd?.();
      };
    }

    audio.onerror = (e) => {
      console.error("Audio playback error", e);
      if (currentAudioUrl === url) {
        URL.revokeObjectURL(url);
        currentAudioUrl = null;
      }
      handlers?.onEnd?.();
    };

    await audio.play();
  } catch (err) {
    console.error("speakTurnBased error:", err);
    // Even if it fails, trigger onEnd so the loop continues
    handlers?.onEnd?.();
  }
}

type UtteranceDecision = {
  action: "followup" | "next" | "end";
  nextPrompt: string;
  reason: string;
  flags: Record<string, boolean>;
};

export default function InterviewPage() {
  const [hasStarted, setHasStarted] = useState(false);
  const [targetClass, setTargetClass] = useState<string | null>(null);

  const [, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<
    "booting" | "ready" | "listening" | "thinking" | "speaking" | "ending" | "error"
  >("booting");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<TurnRecorderHandle | null>(null);
  const loopAbortRef = useRef<AbortController | null>(null);

  const isBusy = useMemo(
    () => status === "booting" || status === "thinking" || status === "speaking" || status === "ending",
    [status],
  );

  useEffect(() => {
    const recorder = recorderRef.current;
    return () => {
      loopAbortRef.current?.abort();
      recorder?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    const saved = sessionStorage.getItem("ai_tutor_session");
    if (saved) setSessionId(saved);

    async function boot() {
      setError(null);
      setStatus("booting");
      try {
        const res = await fetch("/api/start-interview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetClass }),
        });
        if (!res.ok) throw new Error("Failed to start interview.");
        const data = await res.json();
        
        let localState = data.state;
        
        // Use sessionId purely for tracking/logging, it no longer dictates memory lookup
        setSessionId(localState.sessionId);
        fireEvent("boot_ok", localState.sessionId);

        const abort = new AbortController();
        loopAbortRef.current = abort;

        const run = async () => {
          // AI_SPEAKING
          await new Promise<void>((resolve) => {
            setStatus("speaking");
            fireEvent("ai_speaking_start", localState.sessionId);
            speakTurnBased(data.assistantText, { 
              onStart: () => setTurns([{ role: "assistant", text: data.assistantText }]),
              onEnd: () => resolve() 
            });
          });
          fireEvent("ai_speaking_end", localState.sessionId);

          const waitStart = Date.now();
          while (!abort.signal.aborted && !recorderRef.current) {
            if (Date.now() - waitStart > 4000) {
              throw new Error("Recorder not ready. Please refresh the page.");
            }
            await new Promise((r) => setTimeout(r, 50));
          }

          while (!abort.signal.aborted) {
            // LISTENING
            setStatus("listening");
            fireEvent("listening_start", localState.sessionId);
            let userBlob: Blob;
            try {
              const rec = recorderRef.current;
              if (!rec) throw new Error("Recorder not ready");
              userBlob = await rec.startTurn();
              fireEvent("listening_end", localState.sessionId, { bytes: userBlob.size, type: userBlob.type });
            } catch (e) {
              if (abort.signal.aborted) return;
              fireEvent("listening_error", localState.sessionId, {
                message: e instanceof Error ? e.message : "unknown",
              });
              if (e instanceof Error && e.message === "TURN_TOO_SHORT") {
                const msg = "I couldn’t hear anything—could you try again?";
                await new Promise<void>((resolve) => {
                  setStatus("speaking");
                  fireEvent("ai_speaking_start", localState.sessionId);
                  speakTurnBased(msg, { 
                    onStart: () => setTurns((t) => [...t, { role: "assistant", text: msg }]),
                    onEnd: () => resolve() 
                  });
                });
                fireEvent("ai_speaking_end", localState.sessionId);
                continue;
              }
              setError(
                e instanceof Error
                  ? `Mic error: ${e.message}. If prompted, allow microphone access and retry.`
                  : "Microphone permission is required. Please allow it and refresh.",
              );
              setStatus("error");
              return;
            }

            // PROCESSING
            setStatus("thinking");
            fireEvent("processing_start", localState.sessionId);
            const fd = new FormData();
            fd.append("audio", userBlob, "turn.webm");
            fd.append("state", JSON.stringify(localState)); // Pass the full state statelessly!

            const utterRes = await fetch("/api/process-utterance", { method: "POST", body: fd });
            const utter = await utterRes.json();
            if (!utterRes.ok) throw new Error(utter?.message ?? "Failed to process utterance.");

            // Update our client state with the server's modifications
            localState = utter.state;

            fireEvent("processing_done", localState.sessionId, { action: utter?.decision?.action });

            if (utter.action === "retry") {
              await new Promise<void>((resolve) => {
                setStatus("speaking");
                speakTurnBased(utter.message, { 
                  onStart: () => setTurns((t) => [...t, { role: "assistant", text: utter.message }]),
                  onEnd: () => resolve() 
                });
              });
              continue;
            }

            const userText: string = utter.transcriptedText;
            const decision = utter.decision;
            const assistantText: string = utter.assistantText;

            setTurns((prev) => [...prev, { role: "user", text: userText }]);

            // AI_SPEAKING 
            await new Promise<void>((resolve) => {
              setStatus("speaking");
              fireEvent("ai_speaking_start", localState.sessionId);
              speakTurnBased(assistantText, { 
                onStart: () => setTurns((prev) => [...prev, { role: "assistant", text: assistantText }]),
                onEnd: () => resolve() 
              });
            });
            fireEvent("ai_speaking_end", localState.sessionId);

            if (decision.action === "end" || localState.done) {
              setStatus("ending");
              // Write full end state to browser storage for the results page to read
              sessionStorage.setItem("ai_tutor_state", JSON.stringify(localState));
              setTimeout(() => {
                window.location.href = `/results`;
              }, 600);
              return;
            }
          }
        };

        run().catch((e) => {
          setError(e instanceof Error ? e.message : "Loop failed.");
          setStatus("error");
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to start.");
        setStatus("error");
      }
    }

    boot();
  }, [hasStarted, targetClass]);

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 font-sans selection:bg-primary/20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute -top-1/2 -right-1/2 h-full w-full rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 h-full w-full rounded-full bg-accent/5 blur-3xl" />
        
        <div className="relative w-full max-w-md rounded-[2rem] border border-white/60 bg-white/80 backdrop-blur-xl p-8 shadow-2xl shadow-primary/5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#8A5CF6] text-white shadow-lg shadow-primary/20 mb-6">
             <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
             </svg>
          </div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Select Class Level</h2>
          <p className="mt-3 text-base text-zinc-600 mb-8 leading-relaxed">What grade level are you evaluating for? The AI will adjust its difficulty.</p>
           
          <div className="space-y-3">
             {["Class 1-5", "Class 6-8", "Class 9-10"].map((cls) => (
               <button
                 key={cls}
                 onClick={() => setTargetClass(cls)}
                 className={`group flex w-full items-center justify-between rounded-2xl border-2 p-5 text-left transition-all ${
                   targetClass === cls
                     ? "border-primary bg-primary/5 text-primary shadow-sm"
                     : "border-zinc-100 bg-white text-zinc-700 hover:border-zinc-200 hover:shadow-sm"
                 }`}
               >
                 <span className="font-bold text-lg">{cls}</span>
                 {targetClass === cls && (
                   <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                     <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                     </svg>
                   </span>
                 )}
               </button>
             ))}
          </div>
           
          <button
            onClick={() => setHasStarted(true)}
            disabled={!targetClass}
            className="mt-10 w-full rounded-2xl bg-primary px-4 py-4 text-lg font-bold text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans selection:bg-primary/20 relative">
      <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span className="font-bold tracking-tight text-zinc-900">Cuemath AI Screener</span>
        </div>
        <div className="flex items-center gap-3 bg-zinc-100/80 px-4 py-2 rounded-full border border-zinc-200/50">
          <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Progress</div>
          <div className="text-sm font-black text-primary">Question {turns.filter(t => t.role === "assistant").length}</div> 
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 pb-40 scroll-smooth">
        <div className="mx-auto max-w-3xl space-y-8">
          {turns.map((t, idx) => (
            <div key={idx} className={`flex ${t.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
              {t.role === 'assistant' && (
                <div className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#8A5CF6] text-white shadow-sm">
                  <span className="font-bold text-sm">AI</span>
                </div>
              )}
              <div className={`max-w-[80%] rounded-3xl px-6 py-4 text-[15px] sm:text-base leading-relaxed shadow-sm ${t.role === 'assistant' ? 'bg-white border border-zinc-100 text-zinc-900 rounded-tl-sm shadow-zinc-200/50' : 'bg-primary text-white rounded-tr-sm shadow-primary/20 font-medium'}`}>
                {t.text}
              </div>
            </div>
          ))}

          {error && (
            <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-rose-50/80 backdrop-blur p-5 text-sm font-medium text-rose-800 shadow-sm flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}
        </div>
      </main>

      {/* Floating Status Bar */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none z-20">
        <div className="pointer-events-auto">
          {status === "booting" && (
            <div className="flex items-center gap-3 rounded-full bg-white/90 backdrop-blur px-6 py-3.5 text-sm font-bold text-zinc-600 shadow-xl border border-zinc-200/60 transition-all">
              <div className="h-4 w-4 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" />
              Starting interview session...
            </div>
          )}
          {status === "speaking" && (
            <div className="flex items-center gap-3.5 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-primary shadow-2xl shadow-primary/20 ring-1 ring-primary/20 animate-glow-purple transition-all">
              <div className="flex gap-1 h-4 items-end">
                <div className="w-1.5 bg-primary animate-wave-1 h-full rounded-full" />
                <div className="w-1.5 bg-primary animate-wave-2 h-full rounded-full" />
                <div className="w-1.5 bg-primary animate-wave-3 h-full rounded-full" />
              </div>
              <span className="tracking-wide">AI is speaking...</span>
            </div>
          )}
          {status === "listening" && (
            <div className="flex items-center gap-3.5 rounded-full bg-zinc-900 px-6 py-3.5 text-sm font-bold text-white shadow-2xl shadow-zinc-900/20 ring-1 ring-accent/30 animate-pulse-yellow transition-all">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-zinc-900 shadow-sm relative">
                <div className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-50" />
                <svg className="h-3 w-3 relative z-10" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-2a5 5 0 01-10 0H3a7.001 7.001 0 006 6.93V17H6v2h8v-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="tracking-wide text-zinc-100">Listening to you...</span>
            </div>
          )}
          {status === "thinking" && (
            <div className="flex items-center gap-3 rounded-full bg-white/90 backdrop-blur px-6 py-3.5 text-sm font-bold text-zinc-600 shadow-xl border border-zinc-200/60 transition-all">
              <span className="flex gap-1.5 items-center">
                <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{animationDelay: "0ms"}} />
                <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{animationDelay: "150ms"}} />
                <span className="h-2 w-2 rounded-full bg-zinc-400 animate-bounce" style={{animationDelay: "300ms"}} />
              </span>
              Analyzing response...
            </div>
          )}
          {status === "ending" && (
             <div className="flex items-center gap-3 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-all">
               <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
               Generating your professional report...
            </div>
          )}
        </div>
      </div>

      {/* Hidden recorder logic to keep it automated but functional */}
      <div className="fixed bottom-0 opacity-0 pointer-events-none h-0 w-0 overflow-hidden">
        <TurnRecorder ref={recorderRef} disabled={status === "booting" || status === "ending"} />
      </div>
    </div>
  );
}

