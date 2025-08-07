const apiKey = storage.defineItem<string>('local:apiKey', {
    defaultValue: '',
});

export default apiKey;