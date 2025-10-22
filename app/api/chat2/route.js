import { generateText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { observe, updateActiveObservation, updateActiveTrace } from "@langfuse/tracing";
import { trace } from "@opentelemetry/api";
import { after } from "next/server";
import { langfuseSpanProcessor } from "@/app/instrument";
import { LangfuseClient } from "@langfuse/client";

// Initialize Langfuse client
const langfuse = new LangfuseClient({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

const handler = async (req) => {
  const { messages, chatId, userId } = await req.json();

  // ✅ Convert UIMessage[] → ModelMessage[]
  const modelMessages = convertToModelMessages(messages);

  // Get the latest user input text
  const inputText = modelMessages[modelMessages.length - 1]?.content;

  // Update trace metadata for Langfuse
  updateActiveObservation({ input: inputText });
  updateActiveTrace({
    name: "my-ai-sdk-trace",
    sessionId: chatId,
    userId,
    input: inputText,
  });

  // Fetch a prompt from Langfuse
  const prompt = await langfuse.prompt.get("my-prompt");

  // ✅ Use generateText instead of streamText
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    messages: modelMessages,
    experimental_telemetry: {
      isEnabled: true,
      metadata: { langfusePrompt: prompt.toJSON() },
    },
  });

  // Update Langfuse with the output
  updateActiveObservation({ output: result.text });
  updateActiveTrace({ output: result.text });

  // End the active OpenTelemetry span
  trace.getActiveSpan()?.end();

  // Ensure all spans flush after request finishes
  after(async () => await langfuseSpanProcessor.forceFlush());

  // ✅ Return normal JSON response
  return new Response(
    JSON.stringify({
      output: result.text,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
};

// Wrap with Langfuse observation
export const POST = observe(handler, {
  name: "handle-chat-message",
  endOnExit: true, // can be true since no streaming now
});
