export type GeminiConfig = {
  apiKey: string;
  model: string;
  required: boolean;
  debugSource: boolean;
};

const parseBool = (value: string | undefined, defaultValue: boolean) => {
  if (value == null || value.trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

let cached: GeminiConfig | null = null;

export const getGeminiConfig = (): GeminiConfig => {
  if (cached) return cached;
  cached = {
    apiKey: process.env.GEMINI_API_KEY?.trim() || '',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    required: parseBool(process.env.GEMINI_REQUIRED, true),
    debugSource: parseBool(process.env.GEMINI_DEBUG_SOURCE, false),
  };
  return cached;
};

export const assertGeminiBootConfig = () => {
  const cfg = getGeminiConfig();
  if (cfg.required && !cfg.apiKey) {
    throw new Error('Gemini is required (GEMINI_REQUIRED=true) but GEMINI_API_KEY is missing');
  }
};
