type GroqChatMessage = { role: "system" | "user" | "assistant"; content: string };

type GroqChatCompletionsResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
};

export function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function groqBaseUrl() {
  return process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
}

export async function groqChatJson<T>(args: {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
}): Promise<T> {
  const apiKey = requireEnv("GROQ_API_KEY");

  const res = await fetch(`${groqBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.3,
      messages: args.messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq chat error (${res.status}): ${txt || res.statusText}`);
  }

  const data = (await res.json()) as GroqChatCompletionsResponse;
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1)) as T;
    throw new Error("Groq model did not return valid JSON.");
  }
}

export async function groqChatStream(args: {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
}): Promise<Response> {
  const apiKey = requireEnv("GROQ_API_KEY");
  const res = await fetch(`${groqBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature ?? 0.4,
      messages: args.messages,
      stream: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq stream error (${res.status}): ${txt || res.statusText}`);
  }
  return res;
}

export async function groqTranscribe(args: { file: File; model?: string; language?: string }) {
  const apiKey = requireEnv("GROQ_API_KEY");
  const form = new FormData();
  form.set("file", args.file, args.file.name || "audio.webm");
  form.set("model", args.model ?? (process.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo"));
  if (args.language) form.set("language", args.language);
  form.set("response_format", "json");
  form.set("temperature", "0");

  const res = await fetch(`${groqBaseUrl()}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Groq STT error (${res.status}): ${txt || res.statusText}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

