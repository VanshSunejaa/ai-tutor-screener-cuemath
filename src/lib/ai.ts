import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export async function llmJson<T>(args: {
  system: string;
  user: string;
  model: string;
  temperature?: number;
}): Promise<T> {
  requireEnv("OPENAI_API_KEY");

  const res = await openai.chat.completions.create({
    model: args.model,
    temperature: args.temperature ?? 0.3,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
  });

  const text = res.choices[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    // Last-resort repair attempt: extract first JSON object substring.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error("LLM did not return valid JSON.");
  }
}

export async function transcribeAudio(args: { file: any; language?: string }) {
  requireEnv("OPENAI_API_KEY");
  const transcript = await openai.audio.transcriptions.create({
    file: args.file,
    model: "whisper-1",
    language: args.language,
  });
  return transcript.text ?? "";
}

export async function textToSpeech(args: { text: string; voice?: string }) {
  requireEnv("OPENAI_API_KEY");
  const audio = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: (args.voice ?? "nova") as any,
    input: args.text,
    format: "mp3",
  });
  const buf = Buffer.from(await audio.arrayBuffer());
  return buf;
}

