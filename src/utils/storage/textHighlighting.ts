import defaults from "@/utils/constants/defaults";

const textHighlighting = storage.defineItem<boolean>('local:textHighlighting', {
    defaultValue: defaults.textHighlighting,
});

export default textHighlighting;
