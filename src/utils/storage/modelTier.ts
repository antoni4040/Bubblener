import defaults from "@/utils/constants/defaults";
import ModelTierEnum from "@/utils/types/modelTierEnum";

const modelTier = storage.defineItem<ModelTierEnum>('local:modelTier', {
    defaultValue: defaults.modelTier,
});

export default modelTier;
