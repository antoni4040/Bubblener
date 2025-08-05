import BubblePositionEnum from "../types/bubblePositionEnum";

const bubblePosition = storage.defineItem<BubblePositionEnum>('local:bubblePosition', {
    defaultValue: BubblePositionEnum.TopRight,
});

export default bubblePosition;