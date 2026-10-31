import { LLMProvider, LLMMessage, LLMOptions, LLMResponse, OllamaConfig } from './llm.provider';

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  getDefaultModel(): string {
    return this.config.model;
  }

  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const model = options.model || this.config.model;
    const temperature = options.temperature ?? 0.1;
    const maxTokens = options.maxTokens ?? 4096;

    const payload = {
      model,
      messages,
      stream: options.stream ?? false,
      options: {
        temperature,
        num_predict: maxTokens,
        num_ctx: Math.max(4096, maxTokens + 4096),
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      if (options.stream && options.onToken) {
        return this.handleStreamResponse(response, options.onToken);
      }

      const data = await response.json() as {
        message: { content: string };
        model: string;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        content: data.message.content,
        model: data.model,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  private async handleStreamResponse(response: Response, onToken: (token: string) => void): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let content = '';
    let model = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let lineBuffer = '';

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (data.message?.content) {
              content += data.message.content;
              onToken(data.message.content);
            }
            if (data.model) model = data.model;
            if (data.prompt_eval_count) promptTokens = data.prompt_eval_count;
            if (data.eval_count) completionTokens = data.eval_count;
          } catch {
            // Ignore parse errors on malformed lines
          }
        }
      }

      if (lineBuffer.trim()) {
        try {
          const data = JSON.parse(lineBuffer.trim());
          if (data.message?.content) {
            content += data.message.content;
            onToken(data.message.content);
          }
          if (data.model) model = data.model;
          if (data.prompt_eval_count) promptTokens = data.prompt_eval_count;
          if (data.eval_count) completionTokens = data.eval_count;
        } catch {
          // Ignore
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content,
      model: model || this.config.model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async checkModel(model: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json() as { models: Array<{ name: string }> };
      const modelNames = data.models.map(m => m.name);
      return modelNames.some(
        m => m === model || m === `${model}:latest` || m.split(':')[0] === model
      );
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return [];

      const data = await response.json() as { models: Array<{ name: string }> };
      return data.models.map(m => m.name);
    } catch {
      return [];
    }
  }
}

export function createOllamaProvider(config: OllamaConfig): OllamaProvider {
  return new OllamaProvider(config);
}