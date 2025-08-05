import CustomCircularButton from '../CustomCircularButton/CustomCircularButton';

interface ParentBubbleProps {
    setShowBubbles: (show: boolean) => void;
    BubblesIcon: string;
}

const ParentBubble: React.FC<ParentBubbleProps> = ({setShowBubbles, BubblesIcon}) => {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
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