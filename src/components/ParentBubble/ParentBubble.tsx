import CustomCircularButton from '../CustomCircularButton/CustomCircularButton';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

interface ParentBubbleProps {
    setShowBubbles: (show: boolean) => void;
    BubblesIcon: string;
    bubblePosition: BubblePositionEnum;
    bubbleDistance: number;
}

const ParentBubble: React.FC<ParentBubbleProps> = ({ setShowBubbles, BubblesIcon, bubblePosition, bubbleDistance }) => {
    return (
        <div style={{
            position: 'fixed',
            top: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.TopLeft ? bubbleDistance : 'auto',
            bottom: bubblePosition === BubblePositionEnum.BottomRight || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            left: bubblePosition === BubblePositionEnum.TopLeft || bubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistance : 'auto',
            right: bubblePosition === BubblePositionEnum.TopRight || bubblePosition === BubblePositionEnum.BottomRight ? bubbleDistance : 'auto',
            zIndex: 1000
        }}>
            <CustomCircularButton
                onClick={() => setShowBubbles(true)}
                aria-label="Show bubbles"
            >
                <img src={BubblesIcon} alt="" />
            </CustomCircularButton>
        </div>
    );
};

export default ParentBubble;