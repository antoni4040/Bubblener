import defaults from "../constants/defaults";

const maxNumberOfElements = storage.defineItem<number>('local:maxNumberOfElements', {
    defaultValue: defaults.maxElements,
});

export default maxNumberOfElements;