import defaults from "../constants/defaults";

const bubbleDistance = storage.defineItem<number>('local:bubbleDistance', {
    defaultValue: defaults.bubbleDistance,
});

export default bubbleDistance;