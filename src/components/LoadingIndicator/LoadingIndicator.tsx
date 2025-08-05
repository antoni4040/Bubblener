import { Loader } from '@mantine/core';
import styles from './LoadingIndicator.module.css';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

interface LoadingIndicatorProps {
    bubblePosition: BubblePositionEnum;
    bubbleDistance: string | number;
}

const LoadingIndicator = ({ bubblePosition, bubbleDistance }: LoadingIndicatorProps) => {
    return (
        <div className={styles.loadingIndicator} style={{
            top: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.TopLeft ? bubbleDistance : 'auto',
            bottom: bubblePosition === BubblePositionEnum.BottomRight || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            left: bubblePosition === BubblePositionEnum.TopLeft || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            right: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.BottomRight ? bubbleDistance : 'auto',
        }}>
            <Loader size="sm" />
            <span>Processing entities...</span>
        </div>
    );
}

export default LoadingIndicator;