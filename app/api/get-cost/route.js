// app/api/get-cost/route.js
const BASE_URL = process.env.LANGFUSE_HOST || "https://cloud.langfuse.com";
const AUTH = Buffer.from(
  `${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`
).toString("base64");

export async function POST(req) {
  try {
    const { traceId } = await req.json();
    if (!traceId) {
      return Response.json(
        { error: "Missing traceId in request body" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BASE_URL}/api/public/traces/${traceId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("❌ Langfuse trace fetch error:", data);
      return Response.json(
        { error: data.message || "Failed to fetch trace" },
        { status: res.status }
      );
    }

    // Extract key cost details if available
    const costScore = data.scores?.find((s) => s.name === "cost_usd");
    const generation = data.observations?.find(
      (obs) => obs.type === "GENERATION"
    );

    const costDetails = {
      traceId: data.id,
      totalCost:
        costScore?.value ||
        generation?.costDetails?.total ||
        data.totalCost ||
        0,
      model: generation?.model || "Unknown",
      tokens: {
        input: generation?.usage?.input || 0,
        output: generation?.usage?.output || 0,
        total: generation?.usage?.total || 0,
      },
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    return Response.json({
      success: true,
      traceId: data.id,
      costDetails,
      fullTrace: data, // optional: complete trace object
    });
  } catch (error) {
    console.error("❌ Error in /api/get-cost:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
