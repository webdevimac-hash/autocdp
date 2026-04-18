import Anthropic from "@anthropic-ai/sdk";

// Singleton Anthropic client — reused across agent calls
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

// Model constants — swap to claude-opus-4-7 for production quality
export const MODELS = {
  fast: "claude-haiku-4-5-20251001",     // fast, cheap — routing/classification
  standard: "claude-sonnet-4-6",          // main workhorse for agents
  powerful: "claude-opus-4-7",            // orchestrator, complex reasoning
} as const;

export type ModelKey = keyof typeof MODELS;
