const geminiApiKey = storage.defineItem<string>('local:geminiApiKey', {
    defaultValue: '',
});

export default geminiApiKey;