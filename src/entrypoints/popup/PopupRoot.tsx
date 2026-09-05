import { useState } from 'react';
import { Center, Container, type MantineColorsTuple, MantineProvider, createTheme } from '@mantine/core';
import App from './App';
import defaults from '@/utils/constants/defaults';
import themes from '@/utils/constants/themes';
import ThemeEnum from '@/utils/types/themeEnum';

// The Mantine theme (primary color, font, light/dark) has to live above
// MantineProvider, so App reports its selected theme up here and this
// component rebuilds the provider around it.
const PopupRoot = () => {
    const [activeTheme, setActiveTheme] = useState<ThemeEnum>(defaults.theme);
    const preset = themes[activeTheme];

    const theme = createTheme({
        primaryColor: preset.primaryColor,
        fontFamily: preset.fontFamily,
        headings: { fontFamily: preset.fontFamily },
        ...(preset.primaryShades
            ? { colors: { [preset.primaryColor]: preset.primaryShades as unknown as MantineColorsTuple } }
            : {}),
    });

    return (
        <MantineProvider theme={theme} forceColorScheme={preset.colorScheme}>
            <Center>
                <Container p="xl">
                    <App onThemeChange={setActiveTheme} />
                </Container>
            </Center>
        </MantineProvider>
    );
};

export default PopupRoot;
