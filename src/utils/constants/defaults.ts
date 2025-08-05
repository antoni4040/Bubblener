import BubblePositionEnum from "../types/bubblePositionEnum";

const defaults = {
    apiKey: '',
    scrollThreshold: 1000,
    maxCharacters: 16000,
    maxElements: 8,
    bubbleDistance: 20,
    position: BubblePositionEnum.TopRight,
    colorSettings: {
        person: {
            gradientStart: '#3b82f6',
            gradientEnd: '#1d4ed8',
            textColor: '#FFFFFF'
        },
        organization: {
            gradientStart: '#fb923c',
            gradientEnd: '#ea580c',
            textColor: '#FFFFFF'
        },
        location: {
            gradientStart: '#22c55e',
            gradientEnd: '#16a34a',
            textColor: '#FFFFFF'
        },
        keyConcept: {
            gradientStart: '#ef4444',
            gradientEnd: '#dc2626',
            textColor: '#FFFFFF'
        }
    }
};

export default defaults;