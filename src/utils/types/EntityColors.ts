import type ColorSettings from "./ColorSettings";

interface EntityColors {
    person: ColorSettings;
    organization: ColorSettings;
    location: ColorSettings;
    keyConcept: ColorSettings;
}

export type { EntityColors as default };