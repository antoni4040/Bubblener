import defaults from "../constants/defaults";

const maxNumberOfCharacters = storage.defineItem<number>('local:maxNumberOfCharacters', {
    defaultValue: defaults.maxCharacters,
});

export default maxNumberOfCharacters;