import Entity from "@/utils/types/Entity";
import { Badge, Button, Group, Modal, Text, Stack, Title } from "@mantine/core";
import { IconStar, IconStarFilled, IconEyeOff } from "@tabler/icons-react";
import EntityColors from "@/utils/types/EntityColors";

type EntityModalProps = {
    entity: Entity | null;
    isOpen: boolean;
    colors: EntityColors
    starred?: boolean;
    onClose: () => void;
    onToggleStar?: (entity: Entity) => void;
    onHide?: (entity: Entity) => void;
};

const EntityModal = ({
    entity, colors, isOpen, starred = false, onClose, onToggleStar, onHide,
}: EntityModalProps) => {
    if (!entity) return null;

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

    const getEntityGradient = (entityType: string) => {
        switch (entityType) {
            case 'Person':
                return { from: colors.person.gradientStart, to: colors.person.gradientEnd, deg: 135 };
            case 'Organization':
                return { from: colors.organization.gradientStart, to: colors.organization.gradientEnd, deg: 135 };
            case 'Location':
                return { from: colors.location.gradientStart, to: colors.location.gradientEnd, deg: 135 };
            case 'Key Concept/Theme':
                return { from: colors.keyConcept.gradientStart, to: colors.keyConcept.gradientEnd, deg: 135 };
            default:
                return { from: "#8360c3", to: "#2ebf91", deg: 135 };
        }
    };

    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            size="lg"
            centered
            radius={'lg'}
            withinPortal={false}
            style={{ zIndex: 1000 }}
            // Themes that removed the shadow still need an edge to sit on.
            styles={{ content: { border: '1px solid var(--bn-surface-border, transparent)' } }}
            withCloseButton={false}
            overlayProps={{
                backgroundOpacity: 0.55,
                blur: 3,
            }}
        >
            <Stack gap="md">
                {/* Colors come from the theme tokens rather than Mantine's
                    scheme-derived defaults: the color-scheme attribute sits on
                    <html>, outside this shadow root, so those don't resolve. */}
                <Title order={2} size="xl" fw={600} style={{ color: 'var(--bn-surface-text)' }}>
                    {entity.entity_name}
                </Title>
                <Badge
                    size="lg"
                    variant="gradient"
                    gradient={getEntityGradient(entity.entity_type)}
                    style={{
                        color: getEntityColor(entity.entity_type),
                        borderRadius: 'var(--bn-bubble-radius)',
                    }}
                >
                    {entity.entity_type}
                </Badge>

                <Text size="lg" style={{ color: 'var(--bn-surface-text)' }}>
                    {entity.summary_from_text}
                </Text>

                {entity.contextual_enrichment && (
                    <Text size="md" style={{ color: 'var(--bn-surface-muted)' }}>
                        {entity.contextual_enrichment}
                    </Text>
                )}

                {(onToggleStar || onHide) && (
                    <Group gap="xs" mt="xs">
                        {onToggleStar && (
                            <Button
                                size="xs"
                                variant={starred ? 'filled' : 'light'}
                                leftSection={starred ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                                onClick={() => onToggleStar(entity)}
                            >
                                {starred ? 'Starred' : 'Star'}
                            </Button>
                        )}
                        {onHide && (
                            <Button
                                size="xs"
                                variant="subtle"
                                leftSection={<IconEyeOff size={14} />}
                                style={{ color: 'var(--bn-surface-muted)' }}
                                onClick={() => onHide(entity)}
                            >
                                Never show
                            </Button>
                        )}
                    </Group>
                )}

                <Text size="sm" mt="md" style={{ color: 'var(--bn-surface-muted)' }}>
                    Please note: The information provided by AI may not always be accurate or complete.
                </Text>
            </Stack>
        </Modal>
    );
};

export default EntityModal;