import { ColorInput, Collapse, Group, Stack, Text, ActionIcon } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconRotateClockwise } from '@tabler/icons-react';

interface ColorSettings {
    gradientStart: string;
    gradientEnd: string;
    textColor: string;
}

type EntityType = 'person' | 'organization' | 'location' | 'keyConcept';

interface EntityColorSectionProps {
    entityType: EntityType;
    displayName: string;
    colors: ColorSettings;
    isOpen: boolean;
    onToggleSection: (entityType: EntityType) => void;
    onUpdateColorSetting: (entityType: EntityType, colorType: keyof ColorSettings, value: string) => void;
    onResetEntityColors: (entityType: EntityType) => void;
}

const EntityColorSection: React.FC<EntityColorSectionProps> = ({
    entityType,
    displayName,
    colors,
    isOpen,
    onToggleSection,
    onUpdateColorSetting,
    onResetEntityColors
}) => {
    return (
        <Stack key={entityType} gap="sm">
            <Group
                justify="space-between"
                style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                }}
                onClick={() => onToggleSection(entityType)}
            >
                <Text fw={500}>{displayName}</Text>
                <Group gap="xs">
                    <ActionIcon
                        variant="light"
                        color="gray"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onResetEntityColors(entityType);
                        }}
                        title={`Reset ${displayName} Colors`}
                    >
                        <IconRotateClockwise size={14} />
                    </ActionIcon>
                    {isOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                </Group>
            </Group>

            <Collapse in={isOpen}>
                <Stack gap="sm" pl="md">
                    <Group grow>
                        <ColorInput
                            label="Gradient Start"
                            value={colors.gradientStart}
                            onChange={(value) => onUpdateColorSetting(entityType, 'gradientStart', value)}
                            format="hex"
                        />
                        <ColorInput
                            label="Gradient End"
                            value={colors.gradientEnd}
                            onChange={(value) => onUpdateColorSetting(entityType, 'gradientEnd', value)}
                            format="hex"
                        />
                    </Group>
                    <ColorInput
                        label="Text Color"
                        value={colors.textColor}
                        onChange={(value) => onUpdateColorSetting(entityType, 'textColor', value)}
                        format="hex"
                        style={{ maxWidth: '50%' }}
                    />
                    <div
                        style={{
                            height: '40px',
                            background: `linear-gradient(135deg, ${colors.gradientStart}, ${colors.gradientEnd})`,
                            borderRadius: 'var(--mantine-radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: colors.textColor,
                            fontWeight: 500,
                            border: '1px solid var(--mantine-color-gray-3)'
                        }}
                    >
                        {displayName} Preview
                    </div>
                </Stack>
            </Collapse>
        </Stack>
    );
};

export default EntityColorSection;