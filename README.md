# AI Tutor Screener

**🔴 Live Demo:** [https://tutorscreenercuemath.netlify.app/](https://tutorscreenercuemath.netlify.app/)

A production-grade, voice-based AI interviewer designed to screen and evaluate potential math tutors. The system acts as a conversational AI persona ("Simran"), conducting dynamic voice interviews, asking adaptive follow-up questions, and providing a structured evaluation report.

## 🚀 Features

- **Conversational Voice Interview**: Real-time voice interaction using Groq Whisper (STT) and Sarvam AI (Text-To-Speech) for a natural, low-latency experience.
- **Adaptive Questioning**: The AI dynamically generates context-aware follow-up questions based on the candidate's answers.
- **Class-Level Selection**: Candidates select the grade they want to teach, and the interview automatically adjusts its mathematical content.
- **Comprehensive Evaluation**: Analyzes candidates on communication clarity, simplicity, patience, warmth, and fluency, before generating a structured feedback report.
- **Professional UI/UX**: Built with a sleek, modern, responsive UI utilizing a custom design system for an immersive candidate experience.

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, TypeScript
- **Backend API**: Next.js Serverless Route Handlers
- **AI Integrations**:
  - **LLM**: Groq (Llama 3 models)
  - **Speech-to-Text (STT)**: Groq Whisper
  - **Text-to-Speech (TTS)**: Sarvam AI

## 💻 Local Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file in the root of the project and add your API keys:

   ```env
   GROQ_API_KEY="YOUR_GROQ_API_KEY"
   SARVAM_API_KEY="YOUR_SARVAM_API_KEY"

   # Optional Overrides
   GROQ_MODEL_INTERVIEW="llama-3.3-70b-versatile"
   GROQ_MODEL_EVAL="llama-3.3-70b-versatile"
   GROQ_STT_MODEL="whisper-large-v3-turbo"
   ```

3. **Run the development server:**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser to start.

## 🔌 Core API Routes

- `POST /api/start-interview`: Initializes an interview session and generates the first class-specific question.
- `POST /api/process-response`: Accepts user audio, transcribes it, and evaluates whether to ask a follow-up, move on to the next question, or end the interview.
- `POST /api/tts`: Calls Sarvam AI to stream high-quality, localized text-to-speech audio.
- `POST /api/generate-report`: Evaluates the full transcript and generates a detailed, structured JSON report on the candidate's performance.

## 🚀 Deployment

This application operates on a 100% Stateless Client-Driven Architecture and is deployed on **Netlify**.

**Live Link:** [https://tutorscreenercuemath.netlify.app/](https://tutorscreenercuemath.netlify.app/)

1. Push your code to a GitHub repository.
2. Import the project into your Netlify dashboard.
3. Add the required environment variables (`GROQ_API_KEY`, `SARVAM_API_KEY`, etc.) in the Netlify site settings.
4. Deploy. All API routes run safely server-side without requiring persistent server memory.
