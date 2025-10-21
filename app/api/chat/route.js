import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === Langfuse configuration ===
const BASE_URL = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
const AUTH = Buffer.from(
  `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`
).toString("base64");

// 🔹 Helper for Langfuse API (using built-in fetch)
async function callLangfuse(path, method = "POST", body = null) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${AUTH}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error(`❌ Langfuse API error (${path})`, data);
    throw new Error(data.message || "Langfuse API call failed");
  }
  return data;
}

export async function POST(req) {
  try {
    const { prompt } = await req.json();

    // === 1️⃣ CALL OPENAI ===
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const result = response.choices[0].message.content;
    const usage = response.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = inputTokens + outputTokens;

    // === 2️⃣ CALCULATE COST ===
    const inputCost = inputTokens * 0.00000015; // Example GPT-4o-mini pricing
    const outputCost = outputTokens * 0.00000060;
    const totalCost = parseFloat((inputCost + outputCost).toFixed(8));

    // === 3️⃣ CREATE TRACE IN LANGFUSE ===
    const trace = await callLangfuse("/api/public/traces", "POST", {
      name: "nextjs_chat_trace",
      metadata: { env: "vercel", user: "demo-user" },
    });

    // === 4️⃣ CREATE GENERATION (linked to trace) ===
    const generation = await callLangfuse("/api/public/generations", "POST", {
      traceId: trace.id,
      name: "chat_generation",
      model: "gpt-4o-mini",
      input: prompt,
      output: result,
      usage: {
        unit: "TOKENS",
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
      },
      metadata: { provider: "OpenAI" },
    });

    // === 5️⃣ CREATE SCORE (linked to trace & generation) ===
    await callLangfuse("/api/public/scores", "POST", {
      traceId: trace.id,
      observationId: generation.id,
      name: "cost_usd",
      value: totalCost,
      comment: "Auto cost tracking for chat generation",
    });

    // === 6️⃣ RETURN RESULT TO CLIENT ===
    return Response.json({
      result,
      usage,
      cost: {
        input: inputCost,
        output: outputCost,
        total: totalCost,
      },
      traceId: trace.id,
      generationId: generation.id,
      dashboardLink: `${BASE_URL}/project/<YOUR_PROJECT_ID>/traces/${trace.id}`,
    });
  } catch (error) {
    console.error("❌ Error in /api/chat:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
