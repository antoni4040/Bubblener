import { useEffect, useRef, useState } from 'react';
import {
    ActionIcon, Anchor, Badge, Button, Group, Image, Paper, Stack, Tabs, Text, Title,
} from '@mantine/core';
import {
    IconStarFilled, IconEyeOff, IconTrash, IconRestore, IconDownload, IconUpload,
} from '@tabler/icons-react';
import { buildExport, exportFilename, parseImport, type ImportedData } from '@/utils/settingsTransfer';
import {
    applyImport, hasEntities, readExportableSettings, type ImportMode,
} from '@/utils/storage/exportableSettings';
import starredEntities from '@/utils/storage/starredEntities';
import hiddenEntities from '@/utils/storage/hiddenEntities';
import bubbleColors from '@/utils/storage/bubbleColors';
import defaults from '@/utils/constants/defaults';
import { type SavedEntities, type SavedEntity } from '@/utils/types/SavedEntity';
import { getEntityGradient, getEntityTextColor } from '@/utils/entityColors';
import type EntityColors from '@/utils/types/EntityColors';
import bubblenerLogo from '/icon-128.png';

const newestFirst = (entities: SavedEntities): SavedEntity[] =>
    Object.values(entities).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

const EntityCard = ({ entity, colors, actionLabel, actionIcon, onAction }: {
    entity: SavedEntity;
    colors: EntityColors;
    actionLabel: string;
    actionIcon: React.ReactNode;
    onAction: () => void;
}) => (
    <Paper withBorder p="md" radius="var(--mantine-radius-md)">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="sm">
                    <Title order={4} style={{ margin: 0 }}>{entity.entity_name}</Title>
                    <Badge
                        size="sm"
                        style={{
                            background: getEntityGradient(entity.entity_type, colors),
                            color: getEntityTextColor(entity.entity_type, colors),
                        }}
                    >
                        {entity.entity_type}
                    </Badge>
                </Group>

                <Text size="sm">{entity.description}</Text>

                {entity.contextual_enrichment && (
                    <Text size="sm" c="dimmed">{entity.contextual_enrichment}</Text>
                )}

                {entity.sourceUrl && (
                    <Text size="xs" c="dimmed">
                        from{' '}
                        <Anchor href={entity.sourceUrl} target="_blank" rel="noreferrer" size="xs">
                            {entity.sourceTitle || entity.sourceUrl}
                        </Anchor>
                    </Text>
                )}
            </Stack>

            <ActionIcon variant="light" color="gray" onClick={onAction} title={actionLabel} aria-label={actionLabel}>
                {actionIcon}
            </ActionIcon>
        </Group>
    </Paper>
);

const Library = () => {
    const [starred, setStarred] = useState<SavedEntities>({});
    const [hidden, setHidden] = useState<SavedEntities>({});
    const [colors, setColors] = useState<EntityColors>(defaults.colorSettings);

    useEffect(() => {
        starredEntities.getValue().then((v) => setStarred(v ?? {}));
        hiddenEntities.getValue().then((v) => setHidden(v ?? {}));
        bubbleColors.getValue().then((v) => setColors(v ?? defaults.colorSettings));

        // Reflect changes made from a page while this tab stays open.
        const stopStar = starredEntities.watch((v) => setStarred(v ?? {}));
        const stopHide = hiddenEntities.watch((v) => setHidden(v ?? {}));
        return () => { stopStar(); stopHide(); };
    }, []);

    const unstar = async (key: string) => {
        const next = { ...starred };
        delete next[key];
        await starredEntities.setValue(next);
    };

    const unhide = async (key: string) => {
        const next = { ...hidden };
        delete next[key];
        await hiddenEntities.setValue(next);
    };

    const fileInput = useRef<HTMLInputElement>(null);
    const [transferNote, setTransferNote] = useState<
        { tone: 'ok' | 'bad'; text: string } | null
    >(null);
    /** A validated file waiting on the merge-or-replace decision. */
    const [pending, setPending] = useState<ImportedData | null>(null);

    const handleExport = async () => {
        const payload = buildExport(await readExportableSettings(), starred, hidden);
        const url = URL.createObjectURL(
            new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        );

        const link = document.createElement('a');
        link.href = url;
        link.download = exportFilename();
        link.click();
        URL.revokeObjectURL(url);

        setTransferNote({
            tone: 'ok',
            text: 'Exported. Your API key is not in the file — you will need to enter it again on the other machine.',
        });
    };

    const runImport = async (data: ImportedData, mode: ImportMode) => {
        setPending(null);
        const result = await applyImport(data, mode);
        const parts = [
            `${result.settings} settings`,
            `${result.starred} starred`,
            `${result.hidden} hidden`,
        ];
        setTransferNote({ tone: 'ok', text: `Imported ${parts.join(', ')}.` });
    };

    const handleImportFile = async (file: File) => {
        try {
            const data = parseImport(await file.text());
            setTransferNote(null);
            // Replacing can destroy curated lists, so the choice is the user's.
            // When the file has no entities there is nothing to choose between,
            // and asking would be a question with one real answer.
            if (hasEntities(data)) setPending(data);
            else await runImport(data, 'merge');
        } catch (error: any) {
            setPending(null);
            setTransferNote({ tone: 'bad', text: error?.message ?? 'Could not read that file.' });
        }
    };

    const starredList = newestFirst(starred);
    const hiddenList = newestFirst(hidden);

    const empty = (message: string) => (
        <Text c="dimmed" size="sm" ta="center" py="xl">{message}</Text>
    );

    return (
        <Stack gap="lg">
            <Group justify="center" gap="sm">
                <Image src={bubblenerLogo} h={48} w={48} alt="" />
                <Title order={2}>Bubblener Library</Title>
            </Group>

            <Paper withBorder p="md" radius="var(--mantine-radius-md)">
                <Stack gap="sm">
                    <div>
                        <Title order={5} style={{ margin: 0 }}>Settings and lists</Title>
                        <Text size="sm" c="dimmed">
                            Carry your setup to another machine. Settings are replaced;
                            starred and hidden entities are added to what is already here.
                            Your API key is never included.
                        </Text>
                    </div>

                    <Group gap="sm">
                        <Button
                            variant="light"
                            leftSection={<IconDownload size={16} />}
                            onClick={handleExport}
                        >
                            Export
                        </Button>
                        <Button
                            variant="light"
                            leftSection={<IconUpload size={16} />}
                            onClick={() => fileInput.current?.click()}
                        >
                            Import
                        </Button>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="application/json,.json"
                            aria-label="Settings file to import"
                            style={{ display: 'none' }}
                            onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                // Cleared so re-picking the same file fires onChange again.
                                event.currentTarget.value = '';
                                if (file) handleImportFile(file);
                            }}
                        />
                    </Group>

                    {pending && (
                        <Paper withBorder p="sm" radius="var(--mantine-radius-sm)">
                            <Stack gap="xs">
                                <Text size="sm">
                                    That file holds{' '}
                                    <strong>{Object.keys(pending.starred).length} starred</strong>
                                    {' '}and{' '}
                                    <strong>{Object.keys(pending.hidden).length} hidden</strong>
                                    {' '}entities. You currently have {starredList.length} and{' '}
                                    {hiddenList.length}.
                                </Text>
                                <Text size="sm" c="dimmed">
                                    Settings are replaced either way. Replacing makes your lists
                                    exactly what the file holds — anything not in it is lost.
                                </Text>
                                <Group gap="sm">
                                    <Button
                                        size="xs"
                                        onClick={() => runImport(pending, 'merge')}
                                    >
                                        Add to my lists
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="light"
                                        color="red"
                                        onClick={() => runImport(pending, 'replace')}
                                    >
                                        Replace my lists
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="subtle"
                                        color="gray"
                                        onClick={() => setPending(null)}
                                    >
                                        Cancel
                                    </Button>
                                </Group>
                            </Stack>
                        </Paper>
                    )}

                    {transferNote && (
                        <Text size="sm" c={transferNote.tone === 'ok' ? 'green' : 'red'}>
                            {transferNote.text}
                        </Text>
                    )}
                </Stack>
            </Paper>

            <Tabs defaultValue="starred">
                <Tabs.List>
                    <Tabs.Tab value="starred" leftSection={<IconStarFilled size={14} />}>
                        Starred ({starredList.length})
                    </Tabs.Tab>
                    <Tabs.Tab value="hidden" leftSection={<IconEyeOff size={14} />}>
                        Never shown ({hiddenList.length})
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="starred" pt="md">
                    <Stack gap="sm">
                        {starredList.length === 0
                            ? empty('Nothing starred yet. Open an entity’s details and star it to keep it pinned.')
                            : starredList.map((entity) => (
                                <EntityCard
                                    key={entity.entity_name}
                                    entity={entity}
                                    colors={colors}
                                    actionLabel={`Unstar ${entity.entity_name}`}
                                    actionIcon={<IconTrash size={16} />}
                                    onAction={() => unstar(
                                        Object.keys(starred).find((k) => starred[k] === entity)!
                                    )}
                                />
                            ))}
                    </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="hidden" pt="md">
                    <Stack gap="sm">
                        {hiddenList.length === 0
                            ? empty('Nothing hidden. Use “Never show” on an entity to keep it out of the bubbles.')
                            : hiddenList.map((entity) => (
                                <EntityCard
                                    key={entity.entity_name}
                                    entity={entity}
                                    colors={colors}
                                    actionLabel={`Show ${entity.entity_name} again`}
                                    actionIcon={<IconRestore size={16} />}
                                    onAction={() => unhide(
                                        Object.keys(hidden).find((k) => hidden[k] === entity)!
                                    )}
                                />
                            ))}
                    </Stack>
                </Tabs.Panel>
            </Tabs>
        </Stack>
    );
};

export default Library;
