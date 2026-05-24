// Transcribes a short audio clip via Lovable AI Gateway (Gemini multimodal).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { audioBase64, mimeType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip data URL prefix if present
    const b64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const mt = (mimeType || "audio/webm").split(";")[0];
    // Map mime to format string Gemini accepts
    const fmt = mt.includes("wav") ? "wav"
      : mt.includes("mp3") || mt.includes("mpeg") ? "mp3"
      : mt.includes("ogg") ? "ogg"
      : mt.includes("flac") ? "flac"
      : "webm";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a verbatim transcription engine. Transcribe the user's speech exactly. Reply with ONLY the transcript text — no preamble, no quotes, no markdown.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio." },
              { type: "input_audio", input_audio: { data: b64, format: fmt } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up the workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error:", res.status, t);
      return new Response(JSON.stringify({ error: "Transcription failed", detail: t }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const transcript = (data?.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
