import type { CSSProperties } from 'react';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import type EntityColors from '@/utils/types/EntityColors';
import {
    EDGE_COLLAPSED, EDGE_GAP, EDGE_GLYPH, EDGE_PADDING, EDGE_TALL, edgeExpanded,
} from '@/utils/constants/edgeButton';
import styles from './ParentBubble.module.css';

const LABEL = 'Show';

interface ParentBubbleProps {
    setShowBubbles: (show: boolean) => void;
    bubblePosition: BubblePositionEnum;
    bubbleDistance: number;
    colors: EntityColors;
}

/**
 * What is left on screen once the bubbles are hidden.
 *
 * Deliberately the same edge-tucked shape as the on-page launcher: this is the
 * button that brings them back, it sits in the same spot, and one used to be a
 * round gradient disc while the other was a tucked-in tab — which read as two
 * unrelated widgets fighting over the corner.
 */
const ParentBubble: React.FC<ParentBubbleProps> = ({
    setShowBubbles, bubblePosition, bubbleDistance, colors,
}) => {
    const isTop = bubblePosition === BubblePositionEnum.TopRight
        || bubblePosition === BubblePositionEnum.TopLeft;
    const isLeft = bubblePosition === BubblePositionEnum.TopLeft
        || bubblePosition === BubblePositionEnum.BottomLeft;

    const style = {
        [isTop ? 'top' : 'bottom']: bubbleDistance,
        // Flush to the edge; only the vertical offset is the user's setting.
        [isLeft ? 'left' : 'right']: 0,
        // Rounded on the inner side in every theme — see the launcher.
        borderRadius: isLeft ? '0 999px 999px 0' : '999px 0 0 999px',
        // The glyph travels away from the edge and the label fills in behind.
        flexDirection: isLeft ? 'row-reverse' : 'row',
        '--bn-edge-ink': colors.person.gradientStart,
        '--bn-edge-collapsed': `${EDGE_COLLAPSED}px`,
        '--bn-edge-expanded': `${edgeExpanded(LABEL)}px`,
        '--bn-edge-tall': `${EDGE_TALL}px`,
        '--bn-edge-padding': `${EDGE_PADDING}px`,
        '--bn-edge-gap': `${EDGE_GAP}px`,
        '--bn-edge-glyph': `${EDGE_GLYPH}px`,
    } as CSSProperties;

    return (
        <button
            type="button"
            className={styles.edgeButton}
            style={style}
            onClick={() => setShowBubbles(true)}
            aria-label="Show bubbles"
            title="Show bubbles"
        >
            {/* Filled discs, matching the launcher: an outline this fine
                disappears at 16px. */}
            <svg className={styles.glyph} viewBox="0 0 24 24" fill="var(--bn-surface-bg)">
                <circle cx="8.5" cy="14.5" r="5.5" />
                <circle cx="16.5" cy="7.5" r="3.5" />
                <circle cx="18.5" cy="16" r="2" />
            </svg>
            <span className={styles.label}>{LABEL}</span>
        </button>
    );
};

export default ParentBubble;
