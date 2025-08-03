const maxNumberOfElements = storage.defineItem<number>('local:maxNumberOfElements', {
    defaultValue: 12,
});

export default maxNumberOfElements;