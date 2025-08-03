import styles from './ErrorToast.module.css';

type ErrorToastProps = {
    error: { title: string; message: string } | null;
    onClose: () => void;
};

const ErrorToast = ({ error, onClose }: ErrorToastProps) => {
    if (!error) return null;

    return (
        <div className={styles.errorToast}>
            <div className={styles.errorContent}>
                <strong>{error.title}</strong>
                <p>{error.message}</p>
                <button onClick={onClose}>×</button>
            </div>
        </div>
    );
};

export default ErrorToast;