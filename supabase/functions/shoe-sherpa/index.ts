import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Question is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch reviews with model+brand info
    const { data: reviews, error: dbErr } = await sb
      .from("reviews")
      .select("id, content, rating, terrain, location, distance_km, created_at, model_id")
      .order("created_at", { ascending: false })
      .limit(200);

    if (dbErr) throw dbErr;

    // Fetch models and brands
    const modelIds = [...new Set((reviews ?? []).map((r: any) => r.model_id))];
    const { data: models } = await sb
      .from("models")
      .select("id, name, brand_id, category")
      .in("id", modelIds);

    const brandIds = [...new Set((models ?? []).map((m: any) => m.brand_id))];
    const { data: brands } = await sb
      .from("brands")
      .select("id, name")
      .in("id", brandIds);

    const brandMap = Object.fromEntries((brands ?? []).map((b: any) => [b.id, b.name]));
    const modelMap = Object.fromEntries(
      (models ?? []).map((m: any) => [m.id, { name: m.name, brand: brandMap[m.brand_id] || "Unknown", category: m.category }])
    );

    // Serialize reviews compactly
    const reviewContext = (reviews ?? []).map((r: any) => {
      const m = modelMap[r.model_id] || { name: "?", brand: "?", category: null };
      return `[${r.id}] ${m.brand} ${m.name} (${m.category || "n/a"}) | rating:${r.rating ?? "?"}/10 | terrain:${r.terrain || "n/a"} | ${r.content?.slice(0, 200) || "no text"}`;
    }).join("\n");

    const systemPrompt = `You are "The Shoe Sherpa" — a friendly, knowledgeable shoe expert who helps people find the perfect shoe based on real user reviews.

You have access to the following user reviews from our database:

${reviewContext}

When answering:
- Be concise and helpful (2-4 sentences max for the answer)
- Reference specific shoes and why they're recommended
- Always call the recommend_shoes tool with your answer and the IDs of the most relevant reviews (up to 10)
- If no reviews match, say so honestly and still call the tool with an empty array`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_shoes",
              description: "Return a text answer and relevant review IDs",
              parameters: {
                type: "object",
                properties: {
                  answer: { type: "string", description: "Brief helpful answer to the user's question" },
                  relevant_review_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of review IDs that are relevant to the question",
                  },
                },
                required: ["answer", "relevant_review_ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_shoes" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // Fallback: use content directly
      const content = aiData.choices?.[0]?.message?.content || "I couldn't find an answer.";
      return new Response(JSON.stringify({ answer: content, reviewIds: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ answer: args.answer, reviewIds: args.relevant_review_ids || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shoe-sherpa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
