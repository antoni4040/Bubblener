import { useEffect, useState } from 'react';
import { Center, Container, MantineColorsTuple, MantineProvider, createTheme } from '@mantine/core';
import Library from './Library';
import defaults from '@/utils/constants/defaults';
import themes from '@/utils/constants/themes';
import themeStorage from '@/utils/storage/theme';
import ThemeEnum from '@/utils/types/themeEnum';

/** Same arrangement as PopupRoot: the Mantine theme has to be built above the
 *  provider, so the page owns it and passes nothing down. */
const LibraryRoot = () => {
    const [activeTheme, setActiveTheme] = useState<ThemeEnum>(defaults.theme);
    const preset = themes[activeTheme];

    useEffect(() => {
        themeStorage.getValue().then((saved) => setActiveTheme(saved || defaults.theme));
        return themeStorage.watch((next) => setActiveTheme(next || defaults.theme));
    }, []);

    useEffect(() => {
        document.body.style.backgroundColor = preset.surfaceBackground;
        document.body.style.color = preset.surfaceText;
        document.body.style.fontFamily = preset.fontFamily;
        Object.values(themes)
            .flatMap((t) => Object.keys(t.mantineVars ?? {}))
            .forEach((name) => document.body.style.removeProperty(name));
        Object.entries(preset.mantineVars ?? {})
            .forEach(([name, value]) => document.body.style.setProperty(name, value));
    }, [preset]);

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
                <Container size="md" p="xl" style={{ width: '100%' }}>
                    <Library />
                </Container>
            </Center>
        </MantineProvider>
    );
};

export default LibraryRoot;
