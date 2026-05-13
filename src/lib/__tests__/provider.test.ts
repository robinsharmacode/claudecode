import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { MockLanguageModel, getLanguageModel } from "@/lib/provider";
import type { LanguageModelV1Message } from "@ai-sdk/provider";

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn((model: string) => ({ modelId: model })),
}));

function makeMessages(
  toolMessageCount: number,
  userText = "create a counter"
): LanguageModelV1Message[] {
  const messages: LanguageModelV1Message[] = [
    {
      role: "user",
      content: [{ type: "text", text: userText }],
    },
  ];
  for (let i = 0; i < toolMessageCount; i++) {
    messages.push(
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: `call_${i}`,
            toolName: "str_replace_editor",
            args: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: `call_${i}`,
            result: "success",
          },
        ],
      }
    );
  }
  return messages;
}

describe("MockLanguageModel", () => {
  let model: MockLanguageModel;

  beforeEach(() => {
    model = new MockLanguageModel("mock-model");
    vi.spyOn(model as any, "delay").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor properties", () => {
    test("sets specificationVersion to v1", () => {
      expect(model.specificationVersion).toBe("v1");
    });

    test("sets provider to mock", () => {
      expect(model.provider).toBe("mock");
    });

    test("sets modelId from constructor argument", () => {
      const m = new MockLanguageModel("custom-model-id");
      expect(m.modelId).toBe("custom-model-id");
    });

    test("sets defaultObjectGenerationMode to tool", () => {
      expect(model.defaultObjectGenerationMode).toBe("tool");
    });
  });

  describe("doGenerate", () => {
    test("step 0 (no tool messages): creates App.jsx", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0, "create a counter"),
      } as any);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].toolName).toBe("str_replace_editor");
      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.command).toBe("create");
      expect(args.path).toBe("/App.jsx");
      expect(result.finishReason).toBe("tool-calls");
    });

    test("step 1 (one tool message): creates component file", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(1, "create a counter"),
      } as any);

      expect(result.toolCalls).toHaveLength(1);
      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.command).toBe("create");
      expect(args.path).toBe("/components/Counter.jsx");
    });

    test("step 2 (two tool messages): enhances component with str_replace", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(2, "create a counter"),
      } as any);

      expect(result.toolCalls).toHaveLength(1);
      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.command).toBe("str_replace");
      expect(result.finishReason).toBe("tool-calls");
    });

    test("step 3+ (three or more tool messages): final summary with no tool calls", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(3, "create a counter"),
      } as any);

      expect(result.toolCalls).toHaveLength(0);
      expect(result.finishReason).toBe("stop");
      expect(result.text).toContain("Counter.jsx");
      expect(result.text).toContain("App.jsx");
    });

    test("generates form component when prompt contains 'form'", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(1, "build a contact form"),
      } as any);

      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.path).toBe("/components/ContactForm.jsx");
    });

    test("generates card component when prompt contains 'card'", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(1, "create a product card"),
      } as any);

      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.path).toBe("/components/Card.jsx");
    });

    test("defaults to counter when prompt does not match form or card", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(1, "build something cool"),
      } as any);

      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.path).toBe("/components/Counter.jsx");
    });

    test("returns usage stats", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0),
      } as any);

      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 200,
      });
    });

    test("includes rawCall in response", async () => {
      const prompt = makeMessages(0);
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt,
      } as any);

      expect(result.rawCall.rawPrompt).toBe(prompt);
    });

    test("returns empty warnings array", async () => {
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0),
      } as any);

      expect(result.warnings).toEqual([]);
    });

    test("handles string content in user message", async () => {
      const prompt: LanguageModelV1Message[] = [
        { role: "user", content: "create a form" as any },
      ];
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt,
      } as any);

      const args = JSON.parse(result.toolCalls[0].args as string);
      expect(args.path).toBe("/App.jsx");
    });

    test("handles messages with no user message", async () => {
      const prompt: LanguageModelV1Message[] = [
        {
          role: "tool",
          content: [{ type: "tool-result", toolCallId: "c1", result: "ok" }],
        },
      ];
      const result = await model.doGenerate({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt,
      } as any);

      expect(result).toBeDefined();
    });
  });

  describe("doStream", () => {
    test("returns a ReadableStream", async () => {
      const { stream } = await model.doStream({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0),
      } as any);

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    test("stream emits text-delta and tool-call and finish parts", async () => {
      const { stream } = await model.doStream({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0),
      } as any);

      const parts: any[] = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }

      const types = parts.map((p) => p.type);
      expect(types).toContain("text-delta");
      expect(types).toContain("tool-call");
      expect(types).toContain("finish");
    });

    test("stream emits finish with stop reason for final step", async () => {
      const { stream } = await model.doStream({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(3),
      } as any);

      const parts: any[] = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }

      const finish = parts.find((p) => p.type === "finish");
      expect(finish?.finishReason).toBe("stop");
    });

    test("returns empty warnings and rawCall", async () => {
      const { warnings, rawCall } = await model.doStream({
        inputFormat: "messages",
        mode: { type: "regular" },
        prompt: makeMessages(0),
      } as any);

      expect(warnings).toEqual([]);
      expect(rawCall).toBeDefined();
    });
  });
});

describe("getLanguageModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns MockLanguageModel when ANTHROPIC_API_KEY is not set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const model = getLanguageModel();
    expect(model).toBeInstanceOf(MockLanguageModel);
  });

  test("returns MockLanguageModel when ANTHROPIC_API_KEY is whitespace", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "   ");
    const model = getLanguageModel();
    expect(model).toBeInstanceOf(MockLanguageModel);
  });

  test("returns Anthropic model when ANTHROPIC_API_KEY is set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    const { anthropic } = await import("@ai-sdk/anthropic");
    const model = getLanguageModel();
    expect(model).not.toBeInstanceOf(MockLanguageModel);
    expect(anthropic).toHaveBeenCalledWith("claude-haiku-4-5");
  });
});
