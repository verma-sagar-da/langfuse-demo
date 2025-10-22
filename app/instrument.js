import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

// Optional: skip Next.js internal spans
const shouldExportSpan = (span) => {
  return span.otelSpan.instrumentationScope.name !== "next.js";
};

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  shouldExportSpan,
});

const tracerProvider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor],
});

tracerProvider.register();
