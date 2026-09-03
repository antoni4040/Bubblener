import ThemeEnum from '@/utils/types/themeEnum';
import defaults from '@/utils/constants/defaults';

const theme = storage.defineItem<ThemeEnum>('local:theme', {
    defaultValue: defaults.theme,
});

export default theme;
