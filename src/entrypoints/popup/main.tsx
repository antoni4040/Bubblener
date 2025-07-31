import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';

import { MantineProvider, createTheme, MantineColorsTuple, Center, Container } from '@mantine/core';
import '@mantine/core/styles.css';

const myColor: MantineColorsTuple = [
  '#ecf4ff',
  '#dce4f5',
  '#b9c7e2',
  '#94a8d0',
  '#748dc0',
  '#5f7cb7',
  '#5474b4',
  '#44639f',
  '#3a5890',
  '#2c4b80'
];

const theme = createTheme({
  colors: {
    myColor,
  }
});

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Center>
        <Container p="xl">
          <App />
        </Container>
      </Center>
    </MantineProvider>
  </React.StrictMode>
);