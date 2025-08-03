import defaults from "../constants/defaults";
import EntityColors from "../types/EntityColors";

const bubbleColors = storage.defineItem<EntityColors>('local:bubbleColors', {
    defaultValue: {
        person: {
            gradientStart: defaults.colorSettings.person.gradientStart,
            gradientEnd: defaults.colorSettings.person.gradientEnd,
            textColor: defaults.colorSettings.person.textColor
        },
        organization: {
            gradientStart: defaults.colorSettings.organization.gradientStart,
            gradientEnd: defaults.colorSettings.organization.gradientEnd,
            textColor: defaults.colorSettings.organization.textColor
        },
        location: {
            gradientStart: defaults.colorSettings.location.gradientStart,
            gradientEnd: defaults.colorSettings.location.gradientEnd,
            textColor: defaults.colorSettings.location.textColor
        },
        keyConcept: {
            gradientStart: defaults.colorSettings.keyConcept.gradientStart,
            gradientEnd: defaults.colorSettings.keyConcept.gradientEnd,
            textColor: defaults.colorSettings.keyConcept.textColor
        }
    },
});

export default bubbleColors;