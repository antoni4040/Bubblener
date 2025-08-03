import defaults from "../constants/defaults";

const pixelDistance = storage.defineItem<number>('local:pixelDistance', {
    defaultValue: defaults.scrollThreshold,
});

export default pixelDistance;