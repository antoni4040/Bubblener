export const EntityModal = ({ entity, isOpen, onClose }) => {
    if (!isOpen || !entity) return null;

    return (
        <div
            className="entity-modal"
            style={{ display: 'block' }}
            onClick={(e) => e.target.classList.contains('entity-modal') && onClose()}
        >
            <div className="modal-content">
                <span className="close-button" onClick={onClose}>&times;</span>
                <h2 id="modal-title">{entity.name}</h2>
                <p id="modal-summary">{entity.summary}</p>
            </div>
        </div>
    );
};