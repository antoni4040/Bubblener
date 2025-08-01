import { Popover, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Entity } from '../utils/Entity';

interface EntityBubbleProps {
    entity: Entity;
    onEntityClick: (entity: Entity) => void;
}

export const EntityBubble = ({ entity, onEntityClick }: EntityBubbleProps) => {
    // 1. Manage the popover's opened/closed state
    const [opened, { close, open }] = useDisclosure(false);

    return (
        // 2. Pass the `opened` state to the Popover component
        <Popover width={200} position="bottom" withArrow shadow="md" opened={opened} withinPortal={false}>
            <Popover.Target>
                <div
                    className="entity-bubble"
                    style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                    // 3. Open on mouse enter and close on mouse leave
                    onMouseEnter={open}
                    onMouseLeave={close}
                    onClick={() => onEntityClick(entity)}
                >
                    {entity.entity_name}
                </div>
            </Popover.Target>
            {/* 4. Prevent the dropdown from stealing mouse events */}
            <Popover.Dropdown style={{ pointerEvents: 'none' }}>
                <Text size="sm">{entity.description}</Text>
            </Popover.Dropdown>
        </Popover>
    );
};