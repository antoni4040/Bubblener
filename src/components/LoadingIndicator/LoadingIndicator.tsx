import { Loader } from '@mantine/core';
import styles from './LoadingIndicator.module.css';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import { formatDuration } from '@/utils/timing';

interface LoadingIndicatorProps {
    bubblePosition: BubblePositionEnum;
    bubbleDistance: string | number;
    elapsedMs?: number;
    /** Running mean for this model, or null before any history exists. */
    estimateMs?: number | null;
}

const LoadingIndicator = ({
    bubblePosition, bubbleDistance, elapsedMs = 0, estimateMs = null,
}: LoadingIndicatorProps) => {
    // Past the estimate, stop pretending we know — count up instead.
    const overrun = estimateMs !== null && elapsedMs > estimateMs;
    const timing = elapsedMs < 300
        ? null
        : estimateMs === null || overrun
            ? formatDuration(elapsedMs)
            : `${formatDuration(elapsedMs)} / ~${formatDuration(estimateMs)}`;

    return (
        <div className={styles.loadingIndicator} style={{
            top: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.TopLeft ? bubbleDistance : 'auto',
            bottom: bubblePosition === BubblePositionEnum.BottomRight || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            left: bubblePosition === BubblePositionEnum.TopLeft || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            right: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.BottomRight ? bubbleDistance : 'auto',
        }}>
            <Loader size="sm" />
            <span>Processing entities...</span>
            {timing && (
                <span style={{ opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{timing}</span>
            )}
        </div>
    );
}

export default LoadingIndicator;
