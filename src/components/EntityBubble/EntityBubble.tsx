import { Popover, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Entity from '../../utils/types/Entity';
import styles from './EntityBubble.module.css';
import EntityColors from '@/utils/types/EntityColors';

interface EntityBubbleProps {
    entity: Entity;
    colors: EntityColors;
    onEntityClick: (entity: Entity) => void;
}

const EntityBubble = ({ entity, colors, onEntityClick }: EntityBubbleProps) => {
    const [opened, { close, open }] = useDisclosure(false);

    const getEntityGradient = (entityType: string) => {
        switch (entityType) {
            case 'Person':
                return `linear-gradient(135deg, ${colors.person.gradientStart} 0%, ${colors.person.gradientEnd} 100%)`;
            case 'Organization':
                return `linear-gradient(135deg, ${colors.organization.gradientStart} 0%, ${colors.organization.gradientEnd} 100%)`;
            case 'Location':
                return `linear-gradient(135deg, ${colors.location.gradientStart} 0%, ${colors.location.gradientEnd} 100%)`;
            case 'Key Concept/Theme':
                return `linear-gradient(135deg, ${colors.keyConcept.gradientStart} 0%, ${colors.keyConcept.gradientEnd} 100%)`;
            default:
                return "linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)";
        }
    };

    const getEntityColor = (entityType: string) => {
        switch (entityType) {
            case 'Person':
                return colors.person.textColor;
            case 'Organization':
                return colors.organization.textColor;
            case 'Location':
                return colors.location.textColor;
            case 'Key Concept/Theme':
                return colors.keyConcept.textColor;
            default:
                return '#ffffff';
        }
    }

    return (
        <Popover position="bottom" withArrow shadow="md" opened={opened} withinPortal={false}>
            <Popover.Target>
                <div
                    className={styles.entityBubble}
                    style={{
                        background: getEntityGradient(entity.entity_type),
                        color: getEntityColor(entity.entity_type),
                    }}
                    onMouseEnter={open}
                    onMouseLeave={close}
                    onClick={() => onEntityClick(entity)}
                >
                    {entity.entity_name}
                </div>
            </Popover.Target>
            <Popover.Dropdown style={{ pointerEvents: 'none', width: "300px" }}>
                <Text className={styles.popoverText}>{entity.description}</Text>
            </Popover.Dropdown>
        </Popover>
    );
};

export default EntityBubble;