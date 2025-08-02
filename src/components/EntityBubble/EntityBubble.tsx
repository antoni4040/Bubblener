import { Popover, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Entity } from '../../utils/Entity';
import styles from './EntityBubble.module.css';

interface EntityBubbleProps {
    entity: Entity;
    onEntityClick: (entity: Entity) => void;
}

const EntityBubble = ({ entity, onEntityClick }: EntityBubbleProps) => {
    const [opened, { close, open }] = useDisclosure(false);

    const getEntityGradient = (entityType: string) => {
        switch (entityType) {
            case 'Person':
                return "linear-gradient(135deg, #e73c7e 0%, #23a6d5 100%)";
            case 'Organization':
                return "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)";
            case 'Location':
                return "linear-gradient(135deg, #f12711 0%, #f5af19 100%)";
            case 'Key Concept/Theme':
                return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
            default:
                return "linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)";
        }
    };

    return (
        <Popover width={200} position="bottom" withArrow shadow="md" opened={opened} withinPortal={false}>
            <Popover.Target>
                <div
                    className={styles.entityBubble}
                    style={{
                        background: getEntityGradient(entity.entity_type),
                        color: 'white' // Ensure white text
                    }}
                    onMouseEnter={open}
                    onMouseLeave={close}
                    onClick={() => onEntityClick(entity)}
                >
                    {entity.entity_name}
                </div>
            </Popover.Target>
            <Popover.Dropdown style={{ pointerEvents: 'none' }}>
                <Text size="sm" style={{ color: 'black' }}>{entity.description}</Text>
            </Popover.Dropdown>
        </Popover>
    );
};

export default EntityBubble;