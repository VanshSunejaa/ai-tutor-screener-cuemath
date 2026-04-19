import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-bg font-sans text-zinc-900 selection:bg-primary/20">
      {/* Navigation Bar / Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4 px-6">
          <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-primary">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            Cuemath <span className="text-zinc-900 font-medium">Tutor Screener</span>
          </div>
          <Link
            href="/interview"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-hover shadow-sm hover:shadow-md active:scale-95"
          >
            Get Started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        {/* Hero Section */}
        <div className="grid gap-16 md:grid-cols-2 md:items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              AI-Powered Evaluation
            </div>
            <h1 className="mt-8 text-5xl font-extrabold leading-[1.15] tracking-tight text-zinc-900 sm:text-6xl text-balance">
              Tutor Screening in <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">5 Minutes</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-600 leading-relaxed max-w-md">
              Experience a real interview. Answer natural, conversational questions and get instant feedback on your teaching skills just like a human evaluator would provide.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/interview"
                className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-primary/30 sm:w-auto active:scale-95"
              >
                Start Interview Now
                <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>

            {/* Trust Signals */}
            <div className="mt-12 flex items-center gap-8 border-t border-zinc-200/60 pt-8">
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-3xl font-black text-zinc-900">
                  1000<span className="text-primary">+</span>
                </div>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Tutors Screened</span>
              </div>
              <div className="h-12 w-px bg-zinc-200/60" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-3xl font-black text-zinc-900">
                  <svg className="h-6 w-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  Instant
                </div>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">AI Evaluation</span>
              </div>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-lg">
            {/* Background Glow */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-primary to-accent opacity-20 blur-3xl" />
            <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            
            <div className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-white/60 p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl">
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 shadow-sm items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#8A5CF6] text-white">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Real Voice Interviews</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">Simulate a friendly chat with our AI to showcase your pedagogical empathy and clarity to young learners.</p>
                </div>
              </div>
              
              <div className="my-6 border-t border-zinc-100/80" />
              
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 shrink-0 shadow-sm items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[#EAB308] text-white">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Detailed Feedback</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">Get graded instantly on patience, simplicity, warmth, and fluency with detailed actionable insights.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-32">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">How It Works</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">Three simple steps to benchmark your communication and teaching abilities.</p>
          </div>
          
          <div className="relative mt-16 grid gap-8 sm:grid-cols-3">
            {/* Connecting Line (Desktop) */}
            <div className="absolute top-12 left-[16.66%] right-[16.66%] hidden h-[2px] bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 sm:block" />

            {[
              { num: "01", title: "Select Class Level", desc: "Choose the grade level you prefer teaching. We customize the questions accordingly." },
              { num: "02", title: "Talk with AI", desc: "Speak out your answers. The AI will listen and ask adaptive follow-ups." },
              { num: "03", title: "Review Report", desc: "Instantly receive a professional scorecard covering clarity, patience, and warmth." }
            ].map((step, idx) => (
              <div key={step.num} className="relative flex flex-col items-center text-center">
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-[6px] border-brand-bg bg-white shadow-xl shadow-primary/5">
                  <span className="text-2xl font-black text-primary">{idx + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-zinc-900">{step.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-zinc-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-32 relative overflow-hidden rounded-[2.5rem] bg-zinc-900 px-8 py-20 text-center shadow-2xl sm:px-16">
          {/* Decorative Elements */}
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl mix-blend-screen" />
          <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl mix-blend-screen" />
          
          <div className="relative z-10 mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight">Ready to prove your skills?</h2>
            <p className="mt-6 text-lg text-zinc-300 leading-relaxed">Join thousands of tutors who have tested their communication and improved their teaching techniques.</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/interview"
                className="group inline-flex items-center justify-center rounded-2xl bg-accent px-8 py-4 text-base font-bold text-zinc-900 shadow-xl shadow-accent/20 transition-all hover:bg-yellow-400 hover:shadow-accent/40 hover:-translate-y-0.5 active:scale-95 w-full sm:w-auto"
              >
                Start Your Free Interview
                <svg className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
