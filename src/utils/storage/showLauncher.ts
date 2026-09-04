import defaults from "@/utils/constants/defaults";

/** The discreet on-page button that starts an analysis. */
const showLauncher = storage.defineItem<boolean>('local:showLauncher', {
    defaultValue: defaults.showLauncher,
});

export default showLauncher;
