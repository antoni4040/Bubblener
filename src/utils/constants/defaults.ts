import BubblePositionEnum from "@/utils/types/bubblePositionEnum";
import modelAPIsEnum from "@/utils/types/modelAPIsEnum";
import ModelTierEnum from "@/utils/types/modelTierEnum";
import ThemeEnum from "@/utils/types/themeEnum";
import themes from "@/utils/constants/themes";

// Light reproduces the original Bubblener palette, so it stays the default:
// a fresh install (and "Reset All") looks exactly like it always has.
const defaultTheme = ThemeEnum.Light;

const defaults = {
    theme: defaultTheme,
    modelAPI: modelAPIsEnum.Gemini,
    modelTier: ModelTierEnum.Low,
    ollamaModel: '',
    apiKey: '',
    scrollThreshold: 1000,
    maxCharacters: 16000,
    maxElements: 8,
    bubbleDistance: 20,
    bubbleSize: 13,
    /** Rest the bubbles below full opacity so page text stays readable. */
    bubbleTransparency: false,
    /** Mention marks and bubble connector lines drawn over the page. */
    textHighlighting: true,
    position: BubblePositionEnum.TopRight,
    colorSettings: themes[defaultTheme].colorSettings,
};

export default defaults;
