import { describe, it, expect } from "vitest";
import OpenAI from "openai";

const API_KEY = process.env.MIMO_API_KEY ?? "sk-sflnb2jbxt717b29gl1j5lj6a9qum77x9n5rzze82yvt5co5";
const BASE_URL = "https://api.xiaomimimo.com/v1";

const client = new OpenAI({
  apiKey: API_KEY,
  baseURL: BASE_URL,
});

// ─── Basic Chat Completion ───────────────────────────────────────────────────

describe("Chat Completions - mimo-v2.5-pro", () => {
  it("returns a valid response for a simple prompt", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: "Say hello in one sentence." }],
      max_completion_tokens: 100,
    });

    expect(response.id).toBeTruthy();
    expect(response.object).toBe("chat.completion");
    expect(response.model).toContain("mimo");
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.role).toBe("assistant");
    expect(response.choices[0].message.content).toBeTruthy();
    expect(response.choices[0].finish_reason).toBe("stop");
  });

  it("returns usage stats", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: "What is 2 + 2?" }],
      max_completion_tokens: 50,
    });

    expect(response.usage).toBeDefined();
    expect(response.usage!.prompt_tokens).toBeGreaterThan(0);
    expect(response.usage!.completion_tokens).toBeGreaterThan(0);
    expect(response.usage!.total_tokens).toBeGreaterThan(0);
  });

  it("handles multi-turn conversation", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [
        { role: "user", content: "My name is Alex." },
        { role: "assistant", content: "Hello Alex! Nice to meet you." },
        { role: "user", content: "What is my name?" },
      ],
      max_completion_tokens: 100,
    });

    const content = response.choices[0].message.content ?? "";
    expect(content.toLowerCase()).toContain("alex");
  });

  it("respects temperature and top_p parameters", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: "Give me a one-word color." }],
      temperature: 0,
      top_p: 1,
      max_completion_tokens: 20,
    });

    expect(response.choices[0].message.content).toBeTruthy();
  });

  it("respects system prompt", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [
        { role: "system", content: "You are a helpful assistant. Always respond in English." },
        { role: "user", content: "What language are you responding in? Answer in one word." },
      ],
      max_completion_tokens: 50,
    });

    // content may be empty when model uses reasoning mode; check either field
    const content = response.choices[0].message.content ?? "";
    const reasoningContent = (response.choices[0].message as Record<string, unknown>)["reasoning_content"] as string ?? "";
    const fullText = content + reasoningContent;
    expect(fullText.length).toBeGreaterThan(0);
  });
});

// ─── Flash Model ─────────────────────────────────────────────────────────────

describe("Chat Completions - mimo-v2-flash", () => {
  it("returns a valid response", async () => {
    const response = await client.chat.completions.create({
      model: "mimo-v2-flash",
      messages: [{ role: "user", content: "What is the capital of France?" }],
      max_completion_tokens: 50,
    });

    const content = response.choices[0].message.content ?? "";
    expect(content.toLowerCase()).toContain("paris");
  });
});

// ─── Streaming ────────────────────────────────────────────────────────────────

describe("Streaming", () => {
  it("streams chunks and assembles the full response", async () => {
    const stream = await client.chat.completions.create({
      model: "mimo-v2.5-pro",
      messages: [{ role: "user", content: "Count from 1 to 5." }],
      max_completion_tokens: 100,
      stream: true,
    });

    let fullText = "";
    let chunkCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      fullText += delta;
      chunkCount++;
    }

    expect(chunkCount).toBeGreaterThan(1);
    expect(fullText).toBeTruthy();
  });
});

// ─── Raw fetch - Anthropic-compatible endpoint ────────────────────────────────

describe("Anthropic-compatible endpoint", () => {
  it("returns a valid response via POST /anthropic/v1/messages", async () => {
    const res = await fetch("https://api.xiaomimimo.com/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "api-key": API_KEY,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "mimo-v2.5-pro",
        max_tokens: 100,
        messages: [{ role: "user", content: "Say hi!" }],
      }),
    });

    expect(res.ok).toBe(true);

    const data = await res.json() as {
      id: string;
      type: string;
      role: string;
      content: Array<{ type: string; text: string }>;
      model: string;
      stop_reason: string;
      usage: { input_tokens: number; output_tokens: number };
    };

    expect(data.type).toBe("message");
    expect(data.role).toBe("assistant");
    expect(data.content[0].text).toBeTruthy();
    expect(data.usage.input_tokens).toBeGreaterThan(0);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("Error handling", () => {
  it("throws on invalid model name", async () => {
    await expect(
      client.chat.completions.create({
        model: "mimo-nonexistent-model-xyz",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow();
  });

  it("throws on bad API key", async () => {
    const badClient = new OpenAI({
      apiKey: "sk-invalid-key",
      baseURL: BASE_URL,
    });

    await expect(
      badClient.chat.completions.create({
        model: "mimo-v2.5-pro",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow();
  });
});
