import defaults from "@/utils/constants/defaults";

const bubbleTransparency = storage.defineItem<boolean>('local:bubbleTransparency', {
    defaultValue: defaults.bubbleTransparency,
});

export default bubbleTransparency;
