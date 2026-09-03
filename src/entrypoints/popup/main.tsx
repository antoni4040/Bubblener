import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupRoot from './PopupRoot.tsx';
import './style.css';

import '@mantine/core/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PopupRoot />
  </React.StrictMode>
);
