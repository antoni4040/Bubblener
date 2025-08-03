import Entity from "@/utils/types/Entity";
import styles from "./EntityModal.module.css";
import { Badge, MantineGradient } from "@mantine/core";
import EntityColors from "@/utils/types/EntityColors";

type EntityModalProps = {
    entity: Entity | null;
    isOpen: boolean;
    colors: EntityColors
    onClose: () => void;
};

const EntityModal = ({ entity, colors, isOpen, onClose }: EntityModalProps) => {
    if (!isOpen || !entity) return null;

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
        <div
            className={styles.entityModal}
            style={{ display: 'block' }}
            onClick={() => onClose()}
        >
            <div className={styles.modalContent}>
                <span className={styles.closeButton} onClick={onClose}>&times;</span>
                <h2 className={styles.modalTitle}>{entity.entity_name}</h2>
                <Badge size='lg' variant="gradient" gradient={getEntityGradient(entity.entity_type)} style={{
                    marginBottom: '8px', color: getEntityColor(entity.entity_type)
                }}>
                    {entity.entity_type}
                </Badge>
                <p className={styles.modalSummary}>{entity.summary_from_text}</p>
                {entity.contextual_enrichment && <p className={styles.modalContextualEnrichment}>
                    {entity.contextual_enrichment}
                </p>}
                <p style={{ marginTop: '1rem', color: '#818181' }}>Please note: The information provided by AI may not always be accurate or complete.</p>
            </div>
        </div>
    );
};

export default EntityModal;