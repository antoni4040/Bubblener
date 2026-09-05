import { Popover, Text, Badge } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type Entity from '../../utils/types/Entity';
import styles from './EntityBubble.module.css';
import type EntityColors from '@/utils/types/EntityColors';
import { getEntityGradient, getEntityTextColor } from '@/utils/entityColors';

interface EntityBubbleProps {
    entity: Entity;
    index: number;
    colors: EntityColors;
    /** True while the pointer is over one of this entity's mentions in the page. */
    highlighted?: boolean;
    /** Suppresses the hover popover, e.g. while the detail modal is open. */
    quiet?: boolean;
    starred?: boolean;
    onEntityClick: (entity: Entity) => void;
    onHoverChange?: (hovered: boolean) => void;
}

const EntityBubble = ({
    entity, index, colors, highlighted = false, quiet = false, starred = false,
    onEntityClick, onHoverChange,
}: EntityBubbleProps) => {
    const [opened, { close, open }] = useDisclosure(false);

    const gradient = getEntityGradient(entity.entity_type, colors);
    const textColor = getEntityTextColor(entity.entity_type, colors);

    return (
        <Popover position="bottom" withArrow shadow="md" opened={(opened || highlighted) && !quiet} withinPortal={false}>
            <Popover.Target>
                <div
                    // The overlay finds this element to anchor connector lines.
                    data-entity-index={index}
                    className={styles.entityBubble}
                    style={{
                        background: gradient,
                        color: textColor,
                        // Hovering the word in the page lights up the bubble,
                        // so the connection reads in both directions.
                        ...(highlighted ? {
                            transform: 'var(--bn-bubble-hover-lift, translateY(-2px))',
                            boxShadow: 'var(--bn-bubble-hover-shadow, 0 4px 12px rgba(0,0,0,0.2))',
                            filter: 'brightness(1.08)',
                            opacity: 1,
                        } : {}),
                    }}
                    onMouseEnter={() => {
                        open();
                        onHoverChange?.(true);
                    }}
                    onMouseLeave={() => {
                        close();
                        onHoverChange?.(false);
                    }}
                    onClick={() => onEntityClick(entity)}
                >
                    {starred && <span aria-label="Starred" style={{ marginRight: '0.35em' }}>★</span>}
                    {entity.entity_name}
                </div>
            </Popover.Target>
            <Popover.Dropdown style={{
                pointerEvents: 'none',
                width: '300px',
                background: 'var(--bn-surface-bg)',
                borderColor: 'var(--bn-surface-border, transparent)',
                borderRadius: 'var(--bn-surface-radius)',
                boxShadow: 'var(--bn-surface-shadow)',
            }}>
                <Badge size='sm' style={{
                    marginBottom: '8px',
                    borderRadius: 'var(--bn-bubble-radius)',
                    background: gradient,
                    color: textColor,
                }}>
                    {entity.entity_type}
                </Badge>
                <Text className={styles.popoverText}>{entity.description}</Text>
            </Popover.Dropdown>
        </Popover>
    );
};

export default EntityBubble;
