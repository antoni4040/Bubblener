import EntityColors from './EntityColors';

/** Shape/elevation of an entity bubble. Themes change these, not just colors:
 *  a printed catalogue card and a CRT terminal both have square corners and
 *  neither of them floats. */
interface BubbleStyle {
    radius: string;
    shadow: string;
    hoverShadow: string;
    border: string;
    fontWeight: number;
    letterSpacing: string;
    textTransform: 'none' | 'uppercase';
    fontVariant: string;
    /** Extra lift on hover, or `none` for themes that shouldn't move. */
    hoverTransform: string;
}

interface ThemePreset {
    colorScheme: 'light' | 'dark';
    /** Mantine palette name used for buttons, focus rings and light variants. */
    primaryColor: string;
    /** Optional custom 10-shade tuple registered under `primaryColor`. */
    primaryShades?: string[];
    fontFamily: string;
    accentGradient: string;
    /** Radius for the floating toggle button — round, square, or in between. */
    controlRadius: string;
    surfaceBackground: string;
    surfaceText: string;
    /** Secondary copy. Held near 5.5:1 against the surface in every theme. */
    surfaceMuted: string;
    surfaceBorder: string;
    surfaceRadius: string;
    surfaceShadow: string;
    /** Destructive-action tint, kept legible against this theme's surface. */
    dangerColor: string;
    bubble: BubbleStyle;
    /** Mantine CSS variable overrides applied to the popup surface. */
    mantineVars?: Record<string, string>;
    colorSettings: EntityColors;
}

export type { BubbleStyle };
export default ThemePreset;
