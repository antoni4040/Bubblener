import Entity from "@/utils/types/Entity";
import { Badge, Modal, Text, Stack, Title } from "@mantine/core";
import EntityColors from "@/utils/types/EntityColors";

type EntityModalProps = {
    entity: Entity | null;
    isOpen: boolean;
    colors: EntityColors
    onClose: () => void;
};

const EntityModal = ({ entity, colors, isOpen, onClose }: EntityModalProps) => {
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
            withCloseButton={false}
            overlayProps={{
                backgroundOpacity: 0.55,
                blur: 3,
            }}
        >
            <Stack gap="md">
                <Title order={2} size="xl" fw={600}>
                    {entity.entity_name}
                </Title>
                <Badge
                    size="lg"
                    variant="gradient"
                    gradient={getEntityGradient(entity.entity_type)}
                    style={{ color: getEntityColor(entity.entity_type) }}
                >
                    {entity.entity_type}
                </Badge>

                <Text size="lg" c="black">
                    {entity.summary_from_text}
                </Text>

                {entity.contextual_enrichment && (
                    <Text size="md" c="#404040">
                        {entity.contextual_enrichment}
                    </Text>
                )}

                <Text size="sm" c="gray.6" mt="md">
                    Please note: The information provided by AI may not always be accurate or complete.
                </Text>
            </Stack>
        </Modal>
    );
};

export default EntityModal;