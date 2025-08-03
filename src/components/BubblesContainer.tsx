import { useState, useEffect } from 'react';
import Entity from '@/utils/types/Entity';
import { ActionIcon } from '@mantine/core';
import { IconX, IconRefresh } from '@tabler/icons-react';
import BubblesIcon from '@/assets/icon.svg';
import CustomCircularButton from '@/components/CustomCircularButton/CustomCircularButton';
import getVisibleTextOnScreen from '@/utils/domUtils';
import EntityBubble from './EntityBubble/EntityBubble';
import EntityModal from './EntityModal/EntityModal';
import LoadingIndicator from './LoadingIndicator/LoadingIndicator';
import ErrorToast from './ErrorToast/ErrorToast';
import pixelDistance from '@/utils/storage/pixelDistance';
import defaults from '@/utils/constants/defaults';
import bubbleColors from '@/utils/storage/bubbleColors';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';

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
        // Load scroll threshold on component mount
        const loadScrollThreshold = async () => {
            try {
                const threshold = await pixelDistance.getValue();
                setScrollThreshold(threshold);

                const colors = await bubbleColors.getValue();
                setEntityColors(colors);

                const characters = await maxNumberOfCharacters.getValue();
                setNumberOfCharacters(characters);
            } catch (error) {
                setScrollThreshold(defaults.scrollThreshold);
                setEntityColors(defaults.colorSettings);
                setNumberOfCharacters(defaults.maxCharacters);
            }
        };

        loadScrollThreshold();

        // Initial text extraction
        const initialText = getVisibleTextOnScreen();
        processText(initialText);

        // Listen for entities from background script
        const messageListener = (
            request: any,
            sender: any,
            sendResponse: (response?: any) => void
        ) => {
            if (request.entities) {
                setEntities(request.entities.nodes || []);
                setError(null); // Clear any previous errors
                setLoading(false);
            }
            if (request.error) {
                setError(request.error);
                // Auto-hide error after 10 seconds
                setTimeout(() => setError(null), 10000);
            }
        };

        browser.runtime.onMessage.addListener(messageListener);

        // Scroll listener with debouncing
        let lastScrollY = window.scrollY;
        let scrollTimeout: any = null;

        const handleScroll = () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const currentScrollY = window.scrollY;
                if (Math.abs(currentScrollY - lastScrollY) >= scrollThreshold) {
                    lastScrollY = currentScrollY;
                    console.log("Significant scroll detected. Re-extracting text.");
                    if (!showBubbles) {
                        return;
                    }
                    const newText = getVisibleTextOnScreen();
                    processText(newText);
                }
            }, 500);
        };

        window.addEventListener('scroll', handleScroll);

        // Cleanup
        return () => {
            browser.runtime.onMessage.removeListener(messageListener);
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeout) clearTimeout(scrollTimeout);
        };
    }, []);

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
            {showBubbles && !isLoading && <div id="entity-bubbles-container">
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
            )}

            {isLoading && (
                <LoadingIndicator />
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