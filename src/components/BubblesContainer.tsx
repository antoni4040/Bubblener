import BubblesIcon from '@/assets/icon.svg';
import defaults from '@/utils/constants/defaults';
import getVisibleTextOnScreen from '@/utils/domUtils';
import bubbleColors from '@/utils/storage/bubbleColors';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import pixelDistance from '@/utils/storage/pixelDistance';
import Entity from '@/utils/types/Entity';
import { ActionIcon } from '@mantine/core';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import EntityBubble from './EntityBubble/EntityBubble';
import EntityModal from './EntityModal/EntityModal';
import ErrorToast from './ErrorToast/ErrorToast';
import LoadingIndicator from './LoadingIndicator/LoadingIndicator';
import ParentBubble from './ParentBubble/ParentBubble';
import bubblePosition from '@/utils/storage/bubblePosition';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

const BubblesContainer = () => {
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState(null);
    const [scrollThreshold, setScrollThreshold] = useState(defaults.scrollThreshold);
    const [isLoading, setLoading] = useState(false);
    const [showBubbles, setShowBubbles] = useState(true);
    const [entityColors, setEntityColors] = useState(defaults.colorSettings);
    const [numberOfCharacters, setNumberOfCharacters] = useState(defaults.maxCharacters);
    const [getBubblePosition, setBubblePosition] = useState(defaults.position);
    const [bubbleDistanceValue, setBubbleDistance] = useState(defaults.bubbleDistance);

    // Send text to background script for processing
    const processText = (text: string) => {
        if (!showBubbles) {
            return;
        }

        const maxTextLength = numberOfCharacters || defaults.maxCharacters;
        if (text.length > maxTextLength) {
            text = text.substring(0, maxTextLength);
            console.log(`Text truncated to ${maxTextLength} characters.`);
        }

        setLoading(true);
        browser.runtime.sendMessage({ text })
            .then(response => {
                if (response && response.status === "processing") {
                    console.log("Message sent to background script for processing.");
                }
            })
            .catch(error => console.error("Error sending message to background script:", error));
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [threshold, colors, characters, position, distance] = await Promise.all([
                    pixelDistance.getValue(),
                    bubbleColors.getValue(),
                    maxNumberOfCharacters.getValue(),
                    bubblePosition.getValue(),
                    bubbleDistance.getValue()
                ]);
                setScrollThreshold(threshold ?? defaults.scrollThreshold);
                setEntityColors(colors ?? defaults.colorSettings);
                setNumberOfCharacters(characters ?? defaults.maxCharacters);
                setBubblePosition(position ?? defaults.position);
                setBubbleDistance(distance ?? defaults.bubbleDistance);
            } catch {
                setScrollThreshold(defaults.scrollThreshold);
                setEntityColors(defaults.colorSettings);
                setNumberOfCharacters(defaults.maxCharacters);
                setBubblePosition(defaults.position);
                setBubbleDistance(defaults.bubbleDistance);
            }
        };
        loadSettings();

        const initialText = getVisibleTextOnScreen();
        processText(initialText);

        const messageListener = (
            request: any,
            sender: any,
            sendResponse: (response?: any) => void
        ) => {
            if (request.entities) {
                setEntities(request.entities.nodes || []);
                setError(null);
                setLoading(false);
            }
            if (request.error) {
                setError(request.error);
                setTimeout(() => setError(null), 10000);
            }
        };

        browser.runtime.onMessage.addListener(messageListener);

        // Storage change listener to reload settings when they change
        const handleStorageChange = (changes: any) => {
            if (changes.pixelDistance || changes.bubbleColors || 
                changes.maxNumberOfCharacters || changes.bubblePosition 
                || changes.bubbleDistance) {
                console.log('Settings changed, reloading...');
                loadSettings();

                // If max characters changed, re-process current text
                if (changes.maxNumberOfCharacters) {
                    const newText = getVisibleTextOnScreen();
                    processText(newText);
                }
            }
        };

        browser.storage.onChanged.addListener(handleStorageChange);

        // Cleanup
        return () => {
            browser.runtime.onMessage.removeListener(messageListener);
            browser.storage.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    useEffect(() => {
        if (!showBubbles) {
            return;
        }

        let lastScrollY = window.scrollY;
        let scrollTimeout: any = null;

        const handleScroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const currentScrollY = window.scrollY;
                if (Math.abs(currentScrollY - lastScrollY) >= scrollThreshold) {
                    lastScrollY = currentScrollY;
                    console.log("Significant scroll detected. Re-extracting text.");
                    const newText = getVisibleTextOnScreen();
                    processText(newText);
                }
            }, 500);
        };

        window.addEventListener('scroll', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, [scrollThreshold, showBubbles]);

    const onReload = () => {
        console.log("Reloading entity bubbles...");
        const newText = getVisibleTextOnScreen();
        processText(newText);
    }

    const handleEntityClick = (entity: Entity) => {
        setSelectedEntity(entity);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedEntity(null);
    };

    const handleCloseError = () => {
        setError(null);
    };

    return (
        <>
            {showBubbles && !isLoading && <div id="entity-bubbles-container"
                style={{
                    top: getBubblePosition === BubblePositionEnum.TopRight || getBubblePosition === BubblePositionEnum.TopLeft ? bubbleDistanceValue : 'auto',
                    bottom: getBubblePosition === BubblePositionEnum.BottomRight || getBubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistanceValue : 'auto',
                    left: getBubblePosition === BubblePositionEnum.TopLeft || getBubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistanceValue : 'auto',
                    right: getBubblePosition === BubblePositionEnum.TopRight || getBubblePosition === BubblePositionEnum.BottomRight ? bubbleDistanceValue : 'auto',
                }}
            >
                {entities.map((entity, index) => (
                    <EntityBubble
                        key={index}
                        entity={entity}
                        colors={entityColors}
                        onEntityClick={handleEntityClick}
                    />
                ))}
                <div>
                    <ActionIcon
                        color='grey'
                        size="lg"
                        aria-label="Reload bubbles"
                        style={{ borderRadius: '50%', marginRight: '8px', marginLeft: '2rem' }}
                        onClick={() => onReload()}
                    >
                        <IconRefresh />
                    </ActionIcon>

                    <ActionIcon
                        color='red'
                        size="lg"
                        aria-label="Hide bubbles"
                        onClick={() => setShowBubbles(false)}
                        style={{ borderRadius: '50%' }}
                    >
                        <IconX />
                    </ActionIcon>
                </div>
            </div>}

            {!showBubbles && (
                <ParentBubble
                    setShowBubbles={setShowBubbles}
                    BubblesIcon={BubblesIcon}
                    bubblePosition={getBubblePosition}
                    bubbleDistance={bubbleDistanceValue}
                />
            )}

            {isLoading && (
                <LoadingIndicator bubblePosition={getBubblePosition} bubbleDistance={bubbleDistanceValue} />
            )}

            <EntityModal
                entity={selectedEntity}
                isOpen={isModalOpen}
                colors={entityColors}
                onClose={handleCloseModal}
            />

            <ErrorToast
                error={error}
                onClose={handleCloseError}
            />
        </>
    );
};

export default BubblesContainer;