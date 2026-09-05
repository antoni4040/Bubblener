import type ColorSettings from '@/utils/types/ColorSettings';
import type EntityColors from '@/utils/types/EntityColors';

const FALLBACK: ColorSettings = {
    gradientStart: '#8360c3',
    gradientEnd: '#2ebf91',
    textColor: '#ffffff',
};

const KEY_BY_TYPE: Record<string, keyof EntityColors> = {
    Person: 'person',
    Organization: 'organization',
    Location: 'location',
    'Key Concept/Theme': 'keyConcept',
};

export const getEntitySettings = (entityType: string, colors: EntityColors): ColorSettings => {
    const key = KEY_BY_TYPE[entityType];
    return key ? colors[key] : FALLBACK;
};

export const getEntityGradient = (entityType: string, colors: EntityColors): string => {
    const { gradientStart, gradientEnd } = getEntitySettings(entityType, colors);
    return `linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;
};

export const getEntityTextColor = (entityType: string, colors: EntityColors): string =>
    getEntitySettings(entityType, colors).textColor;

/** Single representative color, for marks that can't carry a gradient. */
export const getEntityInk = (entityType: string, colors: EntityColors): string =>
    getEntitySettings(entityType, colors).gradientStart;
