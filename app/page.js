"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  const sendPrompt = async () => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    console.log(data);
    setResponse(data.result);
  };

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Langfuse + Vercel Demo</h1>
      <textarea
        rows={4}
        cols={60}
        placeholder="Ask something..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <br />
      <button onClick={sendPrompt} style={{ marginTop: 10 }}>
        Send
      </button>
      <pre style={{ marginTop: 20 }}>{response}</pre>
    </main>
  );
}
