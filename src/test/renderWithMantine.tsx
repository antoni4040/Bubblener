import { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

export const renderWithMantine = (ui: ReactElement) => render(<MantineProvider>{ui}</MantineProvider>);
