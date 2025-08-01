import React from 'react';
import styles from './CustomCircularButton.module.css'; // Import the CSS module

interface CustomCircularButtonProps {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  'aria-label': string;
  children: React.ReactNode;
}

const CustomCircularButton: React.FC<CustomCircularButtonProps> = ({ onClick, 'aria-label': ariaLabel, children }) => {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={styles.circularButton} // Use the CSS module class
    >
      {children}
    </button>
  );
};

export default CustomCircularButton;