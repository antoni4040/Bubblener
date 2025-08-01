type ErrorToastProps = {
    error: { title: string; message: string } | null;
    onClose: () => void;
};

export const ErrorToast = ({ error, onClose }: ErrorToastProps) => {
    if (!error) return null;

    return (
        <div className="error-toast">
            <div className="error-content">
                <strong>{error.title}</strong>
                <p>{error.message}</p>
                <button onClick={onClose}>×</button>
            </div>
        </div>
    );
};