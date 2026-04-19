"use client";

import { useEffect, useState } from "react";
import type { EvaluationReport } from "@/lib/types";

function Badge({ label, type = "default" }: { label: string; type?: "default" | "success" | "warning" }) {
  const colors = {
    default: "bg-zinc-100 text-zinc-700 border-zinc-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-orange-50 text-orange-700 border-orange-200"
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide uppercase ${colors[type]}`}>
      {label}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((Math.max(1, Math.min(10, value)) / 10) * 100);
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-sm font-bold text-zinc-800">{label}</span>
        <span className="text-sm font-black text-zinc-900">{value} <span className="text-zinc-400 font-medium text-xs">/10</span></span>
      </div>
      <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out" 
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

// Custom Loader UI specific to Dashboard
function DashboardLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-100" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <p className="mt-6 text-sm font-bold text-zinc-500 animate-pulse">{label}</p>
    </div>
  );
}

export default function ResultsPage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("sessionId") ?? sessionStorage.getItem("ai_tutor_session");
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    async function load() {
      setError(null);
      try {
        const res = await fetch("/api/generate-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message ?? "Failed to generate report.");
        setReport(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load report.");
      }
    }
    load();
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg md:p-8 p-4">
        <div className="mx-auto max-w-4xl rounded-[2.5rem] bg-white p-8 md:p-12 shadow-2xl shadow-primary/5 border border-zinc-100 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-6">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Oops, something went wrong</h1>
          <p className="mt-4 text-base text-zinc-600">{error}</p>
          <button
            type="button"
            onClick={() => (window.location.href = "/interview")}
            className="mt-8 rounded-2xl bg-zinc-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-zinc-800 transition-colors shadow-lg"
          >
            Back to interview
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-brand-bg md:p-8 p-4 flex items-center justify-center">
        <div className="w-full max-w-4xl rounded-[2.5rem] bg-white p-8 md:p-12 shadow-2xl shadow-primary/5 border border-zinc-100">
          <DashboardLoader label={sessionId ? "Analyzing interview & generating insights..." : "Locating your session..."} />
        </div>
      </div>
    );
  }

  const avg =
    (report.scores.clarity +
      report.scores.simplicity +
      report.scores.patience +
      report.scores.warmth +
      report.scores.fluency) /
    5;

  const isPass = report.final_decision.toLowerCase().includes("pass");

  return (
    <div className="min-h-screen bg-brand-bg font-sans pb-16 selection:bg-primary/20">
      {/* Header Area */}
      <div className="bg-white border-b border-zinc-200/60 pb-8 pt-8 md:pt-12 px-6">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge 
                label={`Decision: ${report.final_decision}`} 
                type={isPass ? "success" : "warning"} 
              />
              <Badge label={`Avg Score: ${avg.toFixed(1)}/10`} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Performance Report</h1>
            <p className="mt-2 text-zinc-500">Based on your AI interview session</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="group flex items-center gap-2 rounded-xl border-2 border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-all active:scale-95"
            >
              <svg className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <button
              onClick={() => (window.location.href = "/interview")}
              className="rounded-xl border border-transparent bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-900/20"
            >
              Retry Interview
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column: Scores */}
          <div className="lg:col-span-1 border border-zinc-100 rounded-3xl bg-white p-8 shadow-xl shadow-primary/5">
            <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2 mb-8">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Core Metrics
            </h2>
            <div className="space-y-6">
              <ScoreBar label="Clarity" value={report.scores.clarity} />
              <ScoreBar label="Simplicity" value={report.scores.simplicity} />
              <ScoreBar label="Patience" value={report.scores.patience} />
              <ScoreBar label="Warmth" value={report.scores.warmth} />
              <ScoreBar label="Fluency" value={report.scores.fluency} />
            </div>
            
            <div className="mt-10 rounded-2xl bg-brand-bg p-5 border border-zinc-100">
               <h3 className="text-sm font-bold text-zinc-900 mb-2">Overall Assessment</h3>
               <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                 {isPass 
                   ? "You have demonstrated strong pedagogical communication skills. Excellent work!" 
                   : "There are areas requiring improvement. Review the feedback to refine your approach."}
               </p>
            </div>
          </div>

          {/* Right Column: Feedback */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-900/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                <h2 className="text-lg font-bold text-emerald-900 flex items-center gap-2">
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Strengths
                </h2>
                <ul className="mt-5 space-y-3">
                  {report.strengths.length ? report.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-emerald-800/80 font-medium leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {s}
                    </li>
                  )) : <li className="text-sm text-emerald-700/60 font-medium">No particular strengths highlighted.</li>}
                </ul>
              </div>

              <div className="rounded-3xl border border-orange-100 bg-white p-8 shadow-xl shadow-orange-900/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
                <h2 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                  <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Areas to Improve
                </h2>
                <ul className="mt-5 space-y-3">
                  {report.improvements.length ? report.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-orange-800/80 font-medium leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                      {s}
                    </li>
                  )) : <li className="text-sm text-orange-700/60 font-medium">No major areas of improvement found.</li>}
                </ul>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-xl shadow-primary/5">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Ideal Sample Answers</h2>
              <div className="space-y-4">
                {report.ideal_answers.length ? (
                  report.ideal_answers.map((a, i) => (
                    <div key={i} className="relative rounded-2xl bg-zinc-50 p-6 border border-zinc-100">
                      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-4 ring-white">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="none" stroke="currentColor"/>
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-zinc-700 leading-relaxed whitespace-pre-wrap pl-2">
                        {a}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-zinc-500 font-medium italic">— No ideal answers provided —</div>
                )}
              </div>
            </div>

            {report.transcript?.length ? (
              <details className="group rounded-3xl border border-zinc-100 bg-white p-6 shadow-xl shadow-primary/5 transition-all open:bg-zinc-50/50">
                <summary className="flex cursor-pointer items-center justify-between font-bold text-zinc-900 outline-none">
                  <span className="text-lg">View Full Transcript</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 group-open:rotate-180 transition-transform">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <div className="mt-8 space-y-4 border-t border-zinc-100 pt-6">
                  {report.transcript.map((t, i) => (
                    <div key={i} className="flex gap-4 items-start">
                       <span className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest ${t.role === 'assistant' ? 'bg-primary/10 text-primary' : 'bg-zinc-200 text-zinc-700'}`}>
                         {t.role === "assistant" ? "AI" : "You"}
                       </span>
                       <p className="text-sm text-zinc-700 font-medium leading-relaxed">{t.text}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}

