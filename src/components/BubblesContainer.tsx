import defaults from '@/utils/constants/defaults';
import themes from '@/utils/constants/themes';
import getVisibleTextOnScreen, { getContentRoot } from '@/utils/domUtils';
import findMentions, { usableTerms } from '@/utils/findMentions';
import mergeEntities, { type RankedEntity } from '@/utils/mergeEntities';
import { isWithinReach } from '@/utils/entityDistance';
import entityKey from '@/utils/entityKey';
import starredEntities from '@/utils/storage/starredEntities';
import hiddenEntities from '@/utils/storage/hiddenEntities';
import { type SavedEntities, type SavedEntity } from '@/utils/types/SavedEntity';
import maxNumberOfElements from '@/utils/storage/maxNumberOfElements';
import HighlightOverlay from './HighlightOverlay/HighlightOverlay';
import bubbleColors from '@/utils/storage/bubbleColors';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import pixelDistance from '@/utils/storage/pixelDistance';
import themeStorage from '@/utils/storage/theme';
import bubbleSize from '@/utils/storage/bubbleSize';
import bubbleTransparency from '@/utils/storage/bubbleTransparency';
import textHighlighting from '@/utils/storage/textHighlighting';
import type Entity from '@/utils/types/Entity';
import type TokenUsage from '@/utils/types/TokenUsage';
import formatTokens from '@/utils/formatTokens';
import { ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconRefresh, IconX } from '@tabler/icons-react';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import EntityBubble from './EntityBubble/EntityBubble';
import EntityModal from './EntityModal/EntityModal';
import ErrorToast from './ErrorToast/ErrorToast';
import LoadingIndicator from './LoadingIndicator/LoadingIndicator';
import ParentBubble from './ParentBubble/ParentBubble';
import bubblePosition from '@/utils/storage/bubblePosition';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import BubblePositionEnum from '@/utils/types/bubblePositionEnum';

const BubblesContainer = () => {
    const [entities, setEntities] = useState<RankedEntity[]>([]);
    // Increments per request, so entities from the section being read can
    // displace those from sections already passed.
    const batchRef = useRef(0);
    // The message listener is installed once and closes over its initial
    // state, so the live limit reaches it through a ref rather than state.
    const maxElementsRef = useRef(defaults.maxElements);
    // Read through a ref for the same reason as the limit above: the first
    // analysis is fired before React has applied the loaded state.
    const maxCharactersRef = useRef(defaults.maxCharacters);
    const [starred, setStarred] = useState<SavedEntities>({});
    const [hidden, setHidden] = useState<SavedEntities>({});
    // The message listener is installed once, so these reach it via refs.
    const starredRef = useRef<SavedEntities>({});
    const hiddenRef = useRef<SavedEntities>({});
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
    const [bubbleSizeValue, setBubbleSize] = useState(defaults.bubbleSize);
    const [isTransparent, setTransparent] = useState(defaults.bubbleTransparency);
    const [showHighlights, setShowHighlights] = useState(defaults.textHighlighting);
    const [mentions, setMentions] = useState<Range[][]>([]);
    // What this page has cost so far, accumulated across scroll re-analyses.
    const [sessionUsage, setSessionUsage] = useState<TokenUsage>({ input: 0, output: 0 });
    const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
    const [estimateMs, setEstimateMs] = useState<number | null>(null);
    const [elapsedMs, setElapsedMs] = useState(0);
    // Two independent hover sources — the bubble and the word in the page.
    // Kept apart so leaving one doesn't clear a focus the other still holds.
    const [bubbleFocus, setBubbleFocus] = useState<number | null>(null);
    const [mentionFocus, setMentionFocus] = useState<number | null>(null);
    const bubblesRef = useRef<HTMLDivElement | null>(null);
    const lastSentTextRef = useRef<string | null>(null);
    // The id of the analysis whose answers we still want. Anything older has
    // been superseded by scrolling and must be ignored even if it arrives.
    const currentRequestRef = useRef<number | null>(null);
    const { setColorScheme } = useMantineColorScheme();

    // Send text to background script for processing
    const processText = (text: string, force = false) => {
        if (!showBubbles) {
            return;
        }

        const maxTextLength = maxCharactersRef.current || defaults.maxCharacters;
        if (text.length > maxTextLength) {
            text = text.substring(0, maxTextLength);
            console.log(`Text truncated to ${maxTextLength} characters.`);
        }

        // Identical input yields an identical answer, so sending it again just
        // spends the user's own tokens. Scrolling a page whose content sits in
        // an <article> re-extracts the very same text every time.
        if (!force && text === lastSentTextRef.current) {
            console.log('Text unchanged since the last request — skipping.');
            return;
        }
        lastSentTextRef.current = text;

        batchRef.current += 1;
        setLoading(true);
        setRequestStartedAt(Date.now());
        setEstimateMs(null);
        setElapsedMs(0);
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
                const [threshold, colors, characters, position, distance, selectedTheme, maxEls, star, hide, size, transparent, highlights] = await Promise.all([
                    pixelDistance.getValue(),
                    bubbleColors.getValue(),
                    maxNumberOfCharacters.getValue(),
                    bubblePosition.getValue(),
                    bubbleDistance.getValue(),
                    themeStorage.getValue(),
                    maxNumberOfElements.getValue(),
                    starredEntities.getValue(),
                    hiddenEntities.getValue(),
                    bubbleSize.getValue(),
                    bubbleTransparency.getValue(),
                    textHighlighting.getValue()
                ]);
                setScrollThreshold(threshold ?? defaults.scrollThreshold);
                setEntityColors(colors ?? defaults.colorSettings);
                setNumberOfCharacters(characters ?? defaults.maxCharacters);
                maxCharactersRef.current = characters ?? defaults.maxCharacters;
                setBubblePosition(position ?? defaults.position);
                setBubbleDistance(distance ?? defaults.bubbleDistance);
                setActiveTheme(selectedTheme ?? defaults.theme);
                setColorScheme(themes[selectedTheme ?? defaults.theme].colorScheme);
                maxElementsRef.current = maxEls ?? defaults.maxElements;
                setStarred(star ?? {});
                setHidden(hide ?? {});
                starredRef.current = star ?? {};
                hiddenRef.current = hide ?? {};
                setBubbleSize(size ?? defaults.bubbleSize);
                setTransparent(transparent ?? defaults.bubbleTransparency);
                setShowHighlights(highlights ?? defaults.textHighlighting);
            } catch {
                setScrollThreshold(defaults.scrollThreshold);
                setEntityColors(defaults.colorSettings);
                setNumberOfCharacters(defaults.maxCharacters);
                maxCharactersRef.current = defaults.maxCharacters;
                setBubblePosition(defaults.position);
                setBubbleDistance(defaults.bubbleDistance);
                setActiveTheme(defaults.theme);
                setColorScheme(themes[defaults.theme].colorScheme);
                maxElementsRef.current = defaults.maxElements;
                setBubbleSize(defaults.bubbleSize);
                setTransparent(defaults.bubbleTransparency);
                setShowHighlights(defaults.textHighlighting);
            }
        };
        // Awaited: firing the first analysis before the saved settings have
        // loaded meant every page's opening request used the defaults, so a
        // lowered character limit was ignored exactly when it mattered most.
        loadSettings().then(() => processText(getVisibleTextOnScreen()));

        const messageListener = (
            request: any,
            sender: any,
            sendResponse: (response?: any) => void
        ) => {
            // Late answers from a section already scrolled past.
            if (request.requestId !== undefined
                && currentRequestRef.current !== null
                && request.requestId < currentRequestRef.current) {
                return;
            }
            if (request.requestId !== undefined) {
                currentRequestRef.current = request.requestId;
            }

            if (request.started) {
                setEstimateMs(request.started.estimateMs ?? null);
            }
            if (request.entities) {
                setEntities(previous => mergeEntities(
                    previous, request.entities.nodes || [],
                    maxElementsRef.current, batchRef.current,
                    {
                        pinned: new Set(Object.keys(starredRef.current)),
                        hidden: new Set(Object.keys(hiddenRef.current)),
                    },
                ));
                setError(null);
                // Partial batches keep the request open; only the final
                // message ends it.
                if (!request.streaming) {
                    setLoading(false);
                    setRequestStartedAt(null);
                }
            }
            if (request.usage) {
                setSessionUsage(previous => ({
                    input: previous.input + (request.usage.input || 0),
                    output: previous.output + (request.usage.output || 0),
                }));
            }
            if (request.error) {
                setError(request.error);
                // Without this the spinner outlives every failed request.
                setLoading(false);
                setRequestStartedAt(null);
                setTimeout(() => setError(null), 10000);
            }
        };

        browser.runtime.onMessage.addListener(messageListener);

        // Storage change listener to reload settings when they change
        const handleStorageChange = (changes: any) => {
            if (changes.pixelDistance || changes.bubbleColors ||
                changes.maxNumberOfCharacters || changes.bubblePosition
                || changes.bubbleDistance || changes.theme || changes.bubbleSize
                || changes.maxNumberOfElements || changes.starredEntities
                || changes.hiddenEntities
                || changes.bubbleTransparency || changes.textHighlighting) {
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

    // Drive the elapsed counter while a request is in flight.
    useEffect(() => {
        if (!isLoading || requestStartedAt === null) return;
        const tick = () => setElapsedMs(Date.now() - requestStartedAt);
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [isLoading, requestStartedAt]);

    // Locate each entity in the page. Only re-runs when the entity set
    // changes — scrolling moves the rects, not the ranges.
    useEffect(() => {
        if (!entities.length) {
            setMentions([]);
            return;
        }
        // The model's own surface forms find far more than the canonical name
        // alone ("Alyona Ivanovna" vs "the pawnbroker"); hallucinated ones
        // simply fail to match, so no extra verification is needed.
        const terms = entities.map((entity: Entity) =>
            usableTerms([entity.entity_name, ...(entity.mentions ?? [])]));
        const found = findMentions(getContentRoot(), terms);

        // Retire entities whose nearest mention is screens away: by chapter
        // four the people named in the introduction are no longer about
        // anything on the page, however important they were there.
        const inReach = found.map((ranges, index) =>
            // A starred entity was pinned deliberately; distance must not
            // retire it the way it retires the rest.
            // `found` is a map over `entities`, so the index always lands.
            starred[entityKey(entities[index]!.entity_name)] !== undefined
            || isWithinReach(
                ranges.map((range) => range.getBoundingClientRect()),
                window.innerHeight,
            ));

        if (inReach.includes(false)) {
            // Re-running with the smaller set recomputes the mentions below.
            setEntities((previous) => previous.filter((_, index) => inReach[index] ?? true));
            return;
        }

        setMentions(found);
    }, [entities, starred]);

    const focused = bubbleFocus ?? mentionFocus;

    const handleBubbleHover = (index: number) => (hovered: boolean) => {
        setBubbleFocus(hovered ? index : null);
    };

    // Read live rather than caching: the bubbles move with the position and
    // distance settings, and the overlay re-measures on every scroll frame.
    const getBubbleRect = useCallback((index: number) => {
        const element = bubblesRef.current?.querySelector(`[data-entity-index="${index}"]`);
        return element ? element.getBoundingClientRect() : null;
    }, []);

    const onReload = () => {
        console.log("Reloading entity bubbles...");
        // Explicit reload always re-asks, even for unchanged text.
        processText(getVisibleTextOnScreen(), true);
    }

    const handleEntityClick = (entity: Entity) => {
        setSelectedEntity(entity);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedEntity(null);
    };

    const saveEntity = (entity: Entity): SavedEntity => ({
        ...entity,
        savedAt: Date.now(),
        sourceUrl: location.href,
        sourceTitle: document.title,
    });

    const handleToggleStar = async (entity: Entity) => {
        const key = entityKey(entity.entity_name);
        const next = { ...starredRef.current };
        if (next[key]) delete next[key];
        else next[key] = saveEntity(entity);
        await starredEntities.setValue(next);
    };

    const handleHide = async (entity: Entity) => {
        const key = entityKey(entity.entity_name);
        await hiddenEntities.setValue({ ...hiddenRef.current, [key]: saveEntity(entity) });
        // Also drop it from view immediately, rather than at the next batch.
        setEntities((previous) => previous.filter((e) => entityKey(e.entity_name) !== key));
        handleCloseModal();
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
        '--bn-bubble-size': `${bubbleSizeValue}px`,
        '--bn-bubble-rest-opacity': isTransparent ? '0.55' : '1',
        fontFamily: preset.fontFamily,
    } as CSSProperties;

    const isLeftAligned = getBubblePosition === BubblePositionEnum.TopLeft
        || getBubblePosition === BubblePositionEnum.BottomLeft;

    // The reload/hide controls share the loading indicator's surface so they
    // read as part of the theme rather than stock Mantine circles.
    const controlStyle: CSSProperties = {
        pointerEvents: 'auto',
        borderRadius: preset.controlRadius === '50%' ? '50%' : preset.surfaceRadius,
        backgroundColor: preset.surfaceBackground,
        borderColor: preset.surfaceBorder,
        color: preset.surfaceText,
        boxShadow: preset.surfaceShadow,
    };

    return (
        <div style={themeVars}>
            {/* Unmounted while the modal is open: the overlay sits at the top
                of the stacking context, so its marks would paint over the
                modal's own text. */}
            {showBubbles && showHighlights && !isModalOpen && (
                <HighlightOverlay
                    entities={entities}
                    mentions={mentions}
                    colors={entityColors}
                    focused={focused}
                    getBubbleRect={getBubbleRect}
                    onMentionFocus={setMentionFocus}
                    bubblesOnLeft={isLeftAligned}
                />
            )}

            {showBubbles && (entities.length > 0 || !isLoading) && <div id="entity-bubbles-container"
                ref={bubblesRef}
                style={{
                    top: getBubblePosition === BubblePositionEnum.TopRight || getBubblePosition === BubblePositionEnum.TopLeft ? bubbleDistanceValue : 'auto',
                    bottom: getBubblePosition === BubblePositionEnum.BottomRight || getBubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistanceValue : 'auto',
                    left: getBubblePosition === BubblePositionEnum.TopLeft || getBubblePosition === BubblePositionEnum.BottomLeft ? bubbleDistanceValue : 'auto',
                    right: getBubblePosition === BubblePositionEnum.TopRight || getBubblePosition === BubblePositionEnum.BottomRight ? bubbleDistanceValue : 'auto',
                    // Hug the screen edge so each bubble is only as wide as its
                    // own name, rather than stretching to the longest one.
                    alignItems: isLeftAligned ? 'flex-start' : 'flex-end',
                }}
            >
                {entities.map((entity, index) => (
                    <EntityBubble
                        key={index}
                        index={index}
                        entity={entity}
                        colors={entityColors}
                        highlighted={mentionFocus === index}
                        quiet={isModalOpen}
                        starred={starred[entityKey(entity.entity_name)] !== undefined}
                        onEntityClick={handleEntityClick}
                        onHoverChange={handleBubbleHover(index)}
                    />
                ))}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: isLeftAligned ? 'flex-start' : 'flex-end' }}>
                    {sessionUsage.input > 0 && (
                        <span
                            title={`This page so far: ${sessionUsage.input} input + ${sessionUsage.output} output tokens`}
                            style={{
                                pointerEvents: 'auto',
                                marginRight: '8px',
                                fontFamily: preset.fontFamily,
                                fontSize: 'calc(var(--bn-bubble-size, 13px) * 0.8)',
                                color: preset.surfaceMuted,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            ↑{formatTokens(sessionUsage.input)} ↓{formatTokens(sessionUsage.output)}
                        </span>
                    )}

                    {/* The full indicator below only appears before the first
                        entities arrive. Every later analysis — every scroll —
                        happened in complete silence, so the extension looked
                        idle exactly when it was spending tokens. */}
                    <ActionIcon
                        variant="default"
                        size="sm"
                        loading={isLoading}
                        aria-label={isLoading ? 'Analysing' : 'Reload bubbles'}
                        title={isLoading ? 'Analysing this section…' : 'Reload bubbles'}
                        style={{ ...controlStyle, marginRight: '6px' }}
                        onClick={() => onReload()}
                    >
                        <IconRefresh size={15} />
                    </ActionIcon>

                    <ActionIcon
                        variant="default"
                        size="sm"
                        aria-label="Hide bubbles"
                        onClick={() => setShowBubbles(false)}
                        style={{ ...controlStyle, color: preset.dangerColor }}
                    >
                        <IconX size={15} />
                    </ActionIcon>
                </div>
            </div>}

            {!showBubbles && (
                <ParentBubble
                    setShowBubbles={setShowBubbles}
                    bubblePosition={getBubblePosition}
                    bubbleDistance={bubbleDistanceValue}
                    colors={entityColors}
                />
            )}

            {isLoading && entities.length === 0 && (
                <LoadingIndicator
                    bubblePosition={getBubblePosition}
                    bubbleDistance={bubbleDistanceValue}
                    elapsedMs={elapsedMs}
                    estimateMs={estimateMs}
                />
            )}

            <EntityModal
                entity={selectedEntity}
                isOpen={isModalOpen}
                colors={entityColors}
                starred={selectedEntity ? starred[entityKey(selectedEntity.entity_name)] !== undefined : false}
                onClose={handleCloseModal}
                onToggleStar={handleToggleStar}
                onHide={handleHide}
            />

            <ErrorToast
                error={error}
                onClose={handleCloseError}
            />
        </div>
    );
};

export default BubblesContainer;