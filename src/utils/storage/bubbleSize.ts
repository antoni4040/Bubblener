import defaults from "@/utils/constants/defaults";

const bubbleSize = storage.defineItem<number>('local:bubbleSize', {
    defaultValue: defaults.bubbleSize,
});

export default bubbleSize;
