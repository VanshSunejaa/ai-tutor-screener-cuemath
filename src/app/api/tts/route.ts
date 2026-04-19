import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      console.error("Missing SARVAM_API_KEY environment variable");
      return NextResponse.json({ error: "TTS configuration is missing" }, { status: 500 });
    }

    // Clean up markdown bold/italics that the AI might return
    let cleanText = text.replace(/(\*\*|\*)/g, "");

    // Fix pronunciation of hyphenated classes for the TTS model
    cleanText = cleanText.replace(/Class\s+(\d+)-(\d+)/gi, "Classes $1 to $2");

    const payload = {
      text: cleanText,
      target_language_code: "en-IN",
      speaker: "simran",
      model: "bulbul:v3",
      pace: 1.1,
      speech_sample_rate: 22050,
      output_audio_codec: "mp3",
      enable_preprocessing: true,
    };

    const response = await fetch("https://api.sarvam.ai/text-to-speech/stream", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Sarvam API error:", err);
      return NextResponse.json({ error: "Failed to fetch speech audio" }, { status: response.status });
    }

    // Return the audio stream directly back to the client
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        // Do not cache these streamed blobs ideally
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    console.error("Error in TTS route:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
