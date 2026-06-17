import { NextRequest } from "next/server";
import https from "node:https";

function httpsPost(url: string, data: object, key: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let chunk = "";
        res.on("data", (c) => (chunk += c));
        res.on("end", () => resolve(chunk));
      }
    );
    req.on("error", (e) => reject(e));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.write(body);
    req.end();
  });
}

export async function POST(req: NextRequest) {
  const { question } = await req.json();

  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { answer: "L'assistant IA n'est pas configuré. Contactez l'administrateur." }
    );
  }

  try {
    const raw = await httpsPost(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "google/gemma-4-31b-it:free",
        messages: [
          {
            role: "system",
            content:
              "Tu es un expert du métier de libraire au Cameroun. Réponds en français de façon concise et claire (max 5 phrases). Si la question ne concerne pas le métier de libraire, dis poliment que tu ne peux pas répondre et redirige vers le sujet.",
          },
          { role: "user", content: question },
        ],
        temperature: 0.7,
        max_tokens: 300,
      },
      process.env.OPENROUTER_API_KEY
    );

    const data = JSON.parse(raw);

    if (data.error) {
      console.error("OpenRouter error:", JSON.stringify(data.error));
      return Response.json(
        { answer: "Désolé, l'assistant IA a rencontré une erreur. Réessayez plus tard." }
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content?.trim() ??
      "Désolé, je n'ai pas pu générer de réponse.";
    return Response.json({ answer });
  } catch (e) {
    console.error("Chat error:", e instanceof Error ? e.message : String(e));
    return Response.json(
      { answer: "Désolé, l'assistant IA est momentanément indisponible." }
    );
  }
}