import ModelAPIsEnum from '@/utils/types/modelAPIsEnum';
import ModelTierEnum from '@/utils/types/modelTierEnum';

/**
 * Model IDs per provider and tier, checked against each provider's docs on
 * 2026-09-03.
 *
 * `Low` is the cheapest model that can still do the job — NER with short
 * summaries — and is the default. `High` trades cost for better recall and
 * more reliable canonicalisation on dense text.
 *
 * Replacing what was here before:
 *   gpt-5-nano          deprecated, shuts down 2026-12-11 -> gpt-5.6-luna
 *   deepseek-chat       absent from the model table since the v4 launch
 *   gemini-2.5-flash-lite  still served, but two generations behind
 */
const models: Record<ModelAPIsEnum, Record<ModelTierEnum, string>> = {
    [ModelAPIsEnum.Gemini]: {
        [ModelTierEnum.Low]: 'gemini-3.5-flash-lite',
        [ModelTierEnum.High]: 'gemini-3.8-flash',
    },
    [ModelAPIsEnum.ChatGPT]: {
        [ModelTierEnum.Low]: 'gpt-5.6-luna',
        [ModelTierEnum.High]: 'gpt-5.6-terra',
    },
    [ModelAPIsEnum.DeepSeek]: {
        [ModelTierEnum.Low]: 'deepseek-v4-flash',
        [ModelTierEnum.High]: 'deepseek-v4-pro',
    },
    // Local models are whatever the user has pulled, so the tiers are only
    // defaults — `ollamaModel` overrides them.
    [ModelAPIsEnum.Ollama]: {
        [ModelTierEnum.Low]: 'llama3.2',
        [ModelTierEnum.High]: 'qwen2.5:14b',
    },
};

export default models;
