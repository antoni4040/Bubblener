import BubblesIcon from '@/assets/icon.svg';
import defaults from '@/utils/constants/defaults';
import themes from '@/utils/constants/themes';
import getVisibleTextOnScreen from '@/utils/domUtils';
import bubbleColors from '@/utils/storage/bubbleColors';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import pixelDistance from '@/utils/storage/pixelDistance';
import themeStorage from '@/utils/storage/theme';
import Entity from '@/utils/types/Entity';
import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { CSSProperties, useEffect, useState } from 'react';
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
    const [activeTheme, setActiveTheme] = useState(defaults.theme);
    const { setColorScheme } = useMantineColorScheme();

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
                const [threshold, colors, characters, position, distance, selectedTheme] = await Promise.all([
                    pixelDistance.getValue(),
                    bubbleColors.getValue(),
                    maxNumberOfCharacters.getValue(),
                    bubblePosition.getValue(),
                    bubbleDistance.getValue(),
                    themeStorage.getValue()
                ]);
                setScrollThreshold(threshold ?? defaults.scrollThreshold);
                setEntityColors(colors ?? defaults.colorSettings);
                setNumberOfCharacters(characters ?? defaults.maxCharacters);
                setBubblePosition(position ?? defaults.position);
                setBubbleDistance(distance ?? defaults.bubbleDistance);
                setActiveTheme(selectedTheme ?? defaults.theme);
                setColorScheme(themes[selectedTheme ?? defaults.theme].colorScheme);
            } catch {
                setScrollThreshold(defaults.scrollThreshold);
                setEntityColors(defaults.colorSettings);
                setNumberOfCharacters(defaults.maxCharacters);
                setBubblePosition(defaults.position);
                setBubbleDistance(defaults.bubbleDistance);
                setActiveTheme(defaults.theme);
                setColorScheme(themes[defaults.theme].colorScheme);
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
                || changes.bubbleDistance || changes.theme) {
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

    const preset = themes[activeTheme];
    const themeVars = {
        '--bn-accent-gradient': preset.accentGradient,
        '--bn-surface-bg': preset.surfaceBackground,
        '--bn-surface-text': preset.surfaceText,
        '--bn-surface-muted': preset.surfaceMuted,
        '--bn-surface-border': preset.surfaceBorder,
        '--bn-surface-radius': preset.surfaceRadius,
        '--bn-surface-shadow': preset.surfaceShadow,
        '--bn-control-radius': preset.controlRadius,
        '--bn-font-family': preset.fontFamily,
        '--bn-bubble-radius': preset.bubble.radius,
        '--bn-bubble-shadow': preset.bubble.shadow,
        '--bn-bubble-hover-shadow': preset.bubble.hoverShadow,
        '--bn-bubble-border': preset.bubble.border,
        '--bn-bubble-weight': String(preset.bubble.fontWeight),
        '--bn-bubble-tracking': preset.bubble.letterSpacing,
        '--bn-bubble-transform': preset.bubble.textTransform,
        '--bn-bubble-variant': preset.bubble.fontVariant,
        '--bn-bubble-hover-lift': preset.bubble.hoverTransform,
        // Mantine's own components (modal, popover, badge) live inside this
        // subtree, so the theme has to reach them through Mantine's variables
        // too — otherwise they stay generic while the bubbles are themed.
        ...preset.mantineVars,
        '--mantine-font-family': preset.fontFamily,
        '--mantine-font-family-headings': preset.fontFamily,
        '--mantine-color-text': preset.surfaceText,
        '--mantine-color-dimmed': preset.surfaceMuted,
        fontFamily: preset.fontFamily,
    } as CSSProperties;

    // The reload/hide controls share the loading indicator's surface so they
    // read as part of the theme rather than stock Mantine circles.
    const controlStyle: CSSProperties = {
        borderRadius: preset.controlRadius === '50%' ? '50%' : preset.surfaceRadius,
        backgroundColor: preset.surfaceBackground,
        borderColor: preset.surfaceBorder,
        color: preset.surfaceText,
        boxShadow: preset.surfaceShadow,
    };

    return (
        <div style={themeVars}>
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
                        variant="default"
                        size="lg"
                        aria-label="Reload bubbles"
                        style={{ ...controlStyle, marginRight: '8px', marginLeft: '2rem' }}
                        onClick={() => onReload()}
                    >
                        <IconRefresh size={18} />
                    </ActionIcon>

                    <ActionIcon
                        variant="default"
                        size="lg"
                        aria-label="Hide bubbles"
                        onClick={() => setShowBubbles(false)}
                        style={{ ...controlStyle, color: preset.dangerColor }}
                    >
                        <IconX size={18} />
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
        </div>
    );
};

export default BubblesContainer;