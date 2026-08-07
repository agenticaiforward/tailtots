import http from "node:http";

const host = process.env.LOCAL_LLM_HOST ?? "0.0.0.0";
const port = Number(process.env.LOCAL_LLM_PORT ?? 18181);
const ollamaUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const defaultModel = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, model: defaultModel, ollamaUrl });
    return;
  }

  if (req.method !== "POST" || req.url !== "/api/ai/parent-helper") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
  });
  req.on("end", async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const prompt = String(body.prompt ?? "").trim();
      if (!prompt) {
        sendJson(res, 400, { error: "prompt is required" });
        return;
      }

      const ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: body.model ?? defaultModel,
          stream: false,
          prompt: [
            "You are TailTots parent-assistant AI.",
            "Be concise, child-safe, parent-first, and never diagnose pet health.",
            "Return practical mission, reward, or values-tracking suggestions.",
            "",
            prompt,
          ].join("\n"),
        }),
      });

      if (!ollamaResponse.ok) {
        sendJson(res, 502, { error: `Ollama returned ${ollamaResponse.status}` });
        return;
      }

      const data = await ollamaResponse.json();
      sendJson(res, 200, { model: data.model, response: data.response });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
});

server.listen(port, host, () => {
  console.log(`TailTots local LLM server listening on http://${host}:${port}`);
});
