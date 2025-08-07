import modelAPIsEnum from "@/utils/types/modelAPIsEnum";
import defaults from "@/utils/constants/defaults";

const modelAPI = storage.defineItem<modelAPIsEnum>('local:modelAPI', {
    defaultValue: defaults.modelAPI,
});

export default modelAPI;