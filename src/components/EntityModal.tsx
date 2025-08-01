import { Entity } from "@/utils/Entity";

type EntityModalProps = {
    entity: Entity | null;
    isOpen: boolean;
    onClose: () => void;
};

export const EntityModal = ({ entity, isOpen, onClose }: EntityModalProps) => {
    if (!isOpen || !entity) return null;

    return (
        <div
            className="entity-modal"
            style={{ display: 'block' }}
            onClick={(e) => (e.target instanceof HTMLElement && e.target.classList.contains('entity-modal')) && onClose()}
        >
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2 id="modal-title">{entity.entity_name}</h2>
                <p id="modal-summary">{entity.summary_from_text}</p>
            </div>
        </div>
    );
};