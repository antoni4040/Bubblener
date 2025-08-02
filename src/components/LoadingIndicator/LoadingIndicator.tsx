
import { Loader } from '@mantine/core';
import styles from './LoadingIndicator.module.css';

const LoadingIndicator = () => {
    return (
        <div className={styles.loadingIndicator}>
            <Loader size="sm" />
            <span>Processing entities...</span>
        </div>
    );
}

export default LoadingIndicator;