import ThemeEnum from '@/utils/types/themeEnum';
import type ThemePreset from '@/utils/types/ThemePreset';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const BOOK = 'Baskerville, "Libre Baskerville", "Palatino Linotype", Palatino, "Book Antiqua", "Iowan Old Style", Georgia, serif';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Courier New", monospace';

// Terminal palette is mixed from two values. The background is deliberately not
// #000: pure black behind bright phosphor makes green-screen terminals harder
// to read, not more authentic.
const PHOSPHOR = '#34b94e';
const PHOSPHOR_BG = '#060a07';

const themes: Record<ThemeEnum, ThemePreset> = {
    // The original Bubblener look: bright gradient bubbles that float.
    [ThemeEnum.Light]: {
        colorScheme: 'light',
        primaryColor: 'blue',
        fontFamily: SANS,
        accentGradient: 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
        controlRadius: '50%',
        surfaceBackground: '#ffffff',
        surfaceText: '#16181d',
        surfaceMuted: '#5b6270',
        surfaceBorder: '#e0e1de',
        surfaceRadius: '10px',
        surfaceShadow: '0 1px 2px rgba(20,22,26,.05), 0 6px 20px -8px rgba(20,22,26,.14)',
        dangerColor: '#9b2c2c',
        bubble: {
            radius: '20px',
            shadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            hoverShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            border: 'none',
            fontWeight: 500,
            letterSpacing: 'normal',
            textTransform: 'none',
            fontVariant: 'normal',
            hoverTransform: 'translateY(-2px)',
        },
        mantineVars: {
            '--mantine-color-body': '#f6f6f4',
        },
        colorSettings: {
            person: { gradientStart: '#3b82f6', gradientEnd: '#1d4ed8', textColor: '#FFFFFF' },
            organization: { gradientStart: '#fb923c', gradientEnd: '#ea580c', textColor: '#FFFFFF' },
            location: { gradientStart: '#22c55e', gradientEnd: '#16a34a', textColor: '#FFFFFF' },
            keyConcept: { gradientStart: '#ef4444', gradientEnd: '#dc2626', textColor: '#FFFFFF' },
        },
    },
    // Cool near-black with a single teal accent. Same soft shapes as Light, but
    // the shadows go heavier because there is less contrast to carry an edge.
    [ThemeEnum.Dark]: {
        colorScheme: 'dark',
        primaryColor: 'teal',
        primaryShades: [
            '#e6f4f2', '#cfe7e4', '#a6d3cd', '#79bdb5', '#57aca2',
            '#42a298', '#349d92', '#25887e', '#16796f', '#00685f',
        ],
        fontFamily: SANS,
        accentGradient: 'linear-gradient(-45deg, #14302d, #63b5ab, #1c4a52, #3f8d84)',
        controlRadius: '50%',
        surfaceBackground: '#171b22',
        surfaceText: '#e7e9ed',
        surfaceMuted: '#939bab',
        surfaceBorder: '#262c37',
        surfaceRadius: '10px',
        surfaceShadow: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px -10px rgba(0,0,0,.6)',
        dangerColor: '#e08585',
        bubble: {
            radius: '20px',
            shadow: '0 2px 10px rgba(0, 0, 0, 0.45)',
            hoverShadow: '0 6px 18px rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            fontWeight: 500,
            letterSpacing: 'normal',
            textTransform: 'none',
            fontVariant: 'normal',
            hoverTransform: 'translateY(-2px)',
        },
        mantineVars: {
            '--mantine-color-body': '#101319',
            '--mantine-color-default': '#171b22',
            '--mantine-color-default-border': '#39414f',
            '--mantine-color-dimmed': '#939bab',
        },
        colorSettings: {
            person: { gradientStart: '#3f7fb8', gradientEnd: '#2b5c8a', textColor: '#eaf2f8' },
            organization: { gradientStart: '#c08a3e', gradientEnd: '#8c5f22', textColor: '#fdf6ea' },
            location: { gradientStart: '#4a9b7f', gradientEnd: '#2f6f5a', textColor: '#eefaf5' },
            keyConcept: { gradientStart: '#b5546a', gradientEnd: '#8a3247', textColor: '#fdeef1' },
        },
    },
    // A printed encyclopaedia built from typography, not texture: no leather
    // bitmaps or embossing, which is what makes a theme look like a theme park.
    // Flat ink (start === end), square corners, small caps, and nothing floats.
    [ThemeEnum.Library]: {
        colorScheme: 'light',
        primaryColor: 'oxblood',
        primaryShades: [
            '#f6eaec', '#e8d2d6', '#d3a7af', '#bd7986', '#aa5465',
            '#a03c50', '#9b2f45', '#872438', '#781c2f', '#6d2233',
        ],
        fontFamily: BOOK,
        accentGradient: 'linear-gradient(-45deg, #6d2233, #8a6a1f, #5a1c2a, #a3812c)',
        controlRadius: '3px',
        surfaceBackground: '#f5efdf',
        surfaceText: '#221d16',
        surfaceMuted: '#635a48',
        surfaceBorder: '#cfc4a8',
        surfaceRadius: '3px',   // books have square corners
        surfaceShadow: 'none',  // and they do not float
        dangerColor: '#8c2b20',
        bubble: {
            radius: '3px',
            shadow: 'none',
            hoverShadow: 'none',
            border: '1px solid rgba(34, 29, 22, 0.35)',
            fontWeight: 600,
            letterSpacing: '.08em',
            textTransform: 'none',
            fontVariant: 'small-caps',
            hoverTransform: 'none',
        },
        mantineVars: {
            '--mantine-color-body': '#ece4d0',
            '--mantine-color-white': '#f5efdf',
            '--mantine-color-default': '#f5efdf',
            '--mantine-color-default-border': '#ab9d7c',
            '--mantine-color-dimmed': '#635a48',
            '--mantine-radius-default': '3px',
            '--mantine-radius-sm': '3px',
            '--mantine-radius-md': '3px',
            '--mantine-radius-lg': '3px',
            '--mantine-radius-xl': '3px',
        },
        colorSettings: {
            person: { gradientStart: '#6d2233', gradientEnd: '#6d2233', textColor: '#f5efdf' },
            organization: { gradientStart: '#8a6a1f', gradientEnd: '#8a6a1f', textColor: '#f5efdf' },
            location: { gradientStart: '#37503c', gradientEnd: '#37503c', textColor: '#f5efdf' },
            keyConcept: { gradientStart: '#2b3a55', gradientEnd: '#2b3a55', textColor: '#f5efdf' },
        },
    },
    // A phosphor terminal. Square corners, nothing floats above the glass, and
    // the bubbles bloom instead of casting a shadow. Colors are the four ANSI
    // channels a color terminal actually had.
    [ThemeEnum.Cyberpunk]: {
        colorScheme: 'dark',
        primaryColor: 'phosphor',
        primaryShades: [
            '#e8f9ec', '#d0f2d8', '#a3e5b2', '#74d78a', '#4ecb6b',
            '#3bc55c', '#34b94e', '#28a340', '#1c9036', '#087c2a',
        ],
        fontFamily: MONO,
        accentGradient: `linear-gradient(-45deg, ${PHOSPHOR_BG}, ${PHOSPHOR}, #0d3a17, ${PHOSPHOR})`,
        controlRadius: '0',
        surfaceBackground: '#0b120d',
        // Body copy is the tube mixed toward white; the raw phosphor is an
        // accent, and long passages set in it are exhausting to read.
        surfaceText: '#75cf87',
        surfaceMuted: '#2d9d43',
        surfaceBorder: '#1c3f24',
        surfaceRadius: '0',
        surfaceShadow: 'none',
        dangerColor: '#ff7a6b',
        bubble: {
            radius: '0',            // terminals have square corners
            shadow: '0 0 .5rem rgba(52, 185, 78, .28)',   // bloom, not elevation
            hoverShadow: '0 0 .85rem rgba(52, 185, 78, .5)',
            border: '1px solid rgba(52, 185, 78, .55)',
            fontWeight: 600,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            fontVariant: 'normal',
            hoverTransform: 'none',
        },
        mantineVars: {
            '--mantine-color-body': PHOSPHOR_BG,
            '--mantine-color-default': '#0d150f',
            '--mantine-color-default-border': '#1c3f24',
            '--mantine-color-dimmed': '#2e9a45',
            '--mantine-radius-default': '0',
            '--mantine-radius-sm': '0',
            '--mantine-radius-md': '0',
            '--mantine-radius-lg': '0',
            '--mantine-radius-xl': '0',
        },
        colorSettings: {
            person: { gradientStart: PHOSPHOR, gradientEnd: PHOSPHOR, textColor: PHOSPHOR_BG },
            organization: { gradientStart: '#d68f22', gradientEnd: '#d68f22', textColor: PHOSPHOR_BG },
            location: { gradientStart: '#56b6c2', gradientEnd: '#56b6c2', textColor: PHOSPHOR_BG },
            keyConcept: { gradientStart: '#c678dd', gradientEnd: '#c678dd', textColor: PHOSPHOR_BG },
        },
    },
};

export default themes;
