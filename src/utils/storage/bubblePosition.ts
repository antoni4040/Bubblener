import BubblePositionEnum from "@/utils/types/bubblePositionEnum";
import defaults from "../constants/defaults";

const bubblePosition = storage.defineItem<BubblePositionEnum>('local:bubblePosition', {
    defaultValue: defaults.position,
});

export default bubblePosition;