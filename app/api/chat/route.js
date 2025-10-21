import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

const openai = observeOpenAI(
  new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  {
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST,
  }
);

export async function POST(req) {
  const { prompt } = await req.json();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json({
    result: response.choices[0].message.content,
    usage: response.usage,
  });
}
