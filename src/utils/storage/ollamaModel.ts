import defaults from "@/utils/constants/defaults";

/** Overrides the tier default: local model names are user-specific. */
const ollamaModel = storage.defineItem<string>('local:ollamaModel', {
    defaultValue: defaults.ollamaModel,
});

export default ollamaModel;
