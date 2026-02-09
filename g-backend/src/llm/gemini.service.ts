import { Injectable, Logger } from '@nestjs/common';
import { getGeminiConfig } from '../config/gemini.config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private disabledLogged = false;

  private normalizeModel(model: string): string {
    // The models list API returns names like "models/gemini-3-flash-preview".
    // Our request URL already contains "/models/", so we must not double-prefix.
    return model.startsWith('models/') ? model.slice('models/'.length) : model;
  }

  getModelName() {
    return this.normalizeModel(getGeminiConfig().model);
  }

  isRequired() {
    return getGeminiConfig().required;
  }

  isDebugSourceEnabled() {
    return getGeminiConfig().debugSource;
  }

  assertConfigured() {
    const cfg = getGeminiConfig();
    if (cfg.required && !cfg.apiKey) {
      throw new Error('Gemini is required (GEMINI_REQUIRED=true) but GEMINI_API_KEY is missing');
    }
  }

  isEnabled() {
    const enabled = Boolean(getGeminiConfig().apiKey);
    if (!enabled && !this.disabledLogged) {
      this.logger.log('Gemini disabled (GEMINI_API_KEY is not set)');
      this.disabledLogged = true;
    }
    return enabled;
  }

  async generateText(systemPrompt: string, userPrompt: string, timeoutMs = 30_000): Promise<string> {
    const cfg = getGeminiConfig();
    if (!this.isEnabled() || !cfg.apiKey) {
      throw new Error('Gemini is not configured');
    }

    const model = this.normalizeModel(cfg.model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\nRespond with JSON only. Do not include markdown code fences.\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        let details = '';
        try {
          details = (await response.text())?.slice(0, 200) || '';
        } catch { /* ignore */ }
        this.logger.warn(`Gemini API request failed status=${response.status} body=${details}`);
        throw new Error(`Gemini API error (${response.status}): ${details}`);
      }

      const json = await response.json();
      const text = String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      if (!text) {
        throw new Error('Gemini returned empty content');
      }
      return text;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${timeoutMs}ms`);
      }
      this.logger.warn(`Gemini text generation failed: ${error?.message ?? error}`);
      throw error;
    }
  }

  async generateJson<T>(systemPrompt: string, userPrompt: string, timeoutMs = 30_000): Promise<T> {
    const text = await this.generateText(systemPrompt, userPrompt, timeoutMs);
    try {
      const normalized = text.startsWith('```')
        ? text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        : text;
      return JSON.parse(normalized) as T;
    } catch (error: any) {
      this.logger.warn(`Gemini JSON parse failed: ${error?.message ?? error}`);
      throw new Error(`Failed to parse Gemini JSON: ${error.message}`);
    }
  }
}
