import { useEffect, useState } from 'react';
import {
    ActionIcon, Anchor, Badge, Group, Image, Paper, Stack, Tabs, Text, Title,
} from '@mantine/core';
import { IconStarFilled, IconEyeOff, IconTrash, IconRestore } from '@tabler/icons-react';
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
