import Entity from "@/utils/types/Entity";
import styles from "./EntityModal.module.css";

type EntityModalProps = {
    entity: Entity | null;
    isOpen: boolean;
    onClose: () => void;
};

const EntityModal = ({ entity, isOpen, onClose }: EntityModalProps) => {
    if (!isOpen || !entity) return null;

    return (
        <div
            className={styles.entityModal}
            style={{ display: 'block' }}
            onClick={() => onClose()}
        >
            <div className={styles.modalContent}>
                <span className={styles.closeButton} onClick={onClose}>&times;</span>
                <h2 className={styles.modalTitle}>{entity.entity_name}</h2>
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