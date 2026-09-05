import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import bubbleColors from '@/utils/storage/bubbleColors';
import bubblePosition from '@/utils/storage/bubblePosition';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import { Accordion, ActionIcon, Button, Combobox, Group, Image, Input, InputBase, NumberInput, PasswordInput, Stack, Switch, Text, TextInput, Title, useCombobox } from '@mantine/core';
import { IconDeviceFloppy, IconRestore, IconRotateClockwise, IconBooks, IconSparkles, IconAlertCircle, IconBook, IconPalette, IconBan, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import EntityColorSection from '@/components/EntityColorSection/EntityColorSection';
import defaults from '@/utils/constants/defaults';
import themes from '@/utils/constants/themes';
import apiKey from '@/utils/storage/apiKey';
import maxNumberOfElements from '@/utils/storage/maxNumberOfElements';
import pixelDistance from '@/utils/storage/pixelDistance';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import modelAPI from '@/utils/storage/modelAPI';
import modelAPIsEnum from '@/utils/types/modelAPIsEnum';
import ModelTierEnum from '@/utils/types/modelTierEnum';
import modelTier from '@/utils/storage/modelTier';
import ollamaModel from '@/utils/storage/ollamaModel';
import models from '@/utils/constants/models';
import themeStorage from '@/utils/storage/theme';
import bubbleSize from '@/utils/storage/bubbleSize';
import bubbleTransparency from '@/utils/storage/bubbleTransparency';
import textHighlighting from '@/utils/storage/textHighlighting';
import tokenUsage from '@/utils/storage/tokenUsage';
import showLauncher from '@/utils/storage/showLauncher';
import blockedSites from '@/utils/storage/blockedSites';
import { addPattern, isSiteBlocked, siteLabel } from '@/utils/siteBlocking';
import formatTokens from '@/utils/formatTokens';
import ThemeEnum from '@/utils/types/themeEnum';
import './App.css';
import bubblenerLogo from '/icon-128.png';

interface AppProps {
  /** Lets PopupRoot rebuild the Mantine theme when the selection changes. */
  onThemeChange?: (theme: ThemeEnum) => void;
}

function App({ onThemeChange }: AppProps = {}) {
  // The real API key value is never loaded into state / rendered into the
  // DOM once saved, so it can't be read via devtools or copy/paste. Only a
  // freshly-typed replacement (apiKeyDraft) ever appears in the field.
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [pixels, setPixels] = useState(defaults.scrollThreshold);
  const [status, setStatus] = useState('');
  const [numberOfCharacters, setNumberOfCharacters] = useState(defaults.maxCharacters);
  const [statusType, setStatusType] = useState('success');
  const [maxElements, setMaxElements] = useState(defaults.maxElements);
  const [openSections, setOpenSections] = useState({
    person: false,
    organization: false,
    location: false,
    keyConcept: false
  });
  const [colorSettings, setColorSettings] = useState({
    person: {
      gradientStart: defaults.colorSettings.person.gradientStart,
      gradientEnd: defaults.colorSettings.person.gradientEnd,
      textColor: defaults.colorSettings.person.textColor
    },
    organization: {
      gradientStart: defaults.colorSettings.organization.gradientStart,
      gradientEnd: defaults.colorSettings.organization.gradientEnd,
      textColor: defaults.colorSettings.organization.textColor
    },
    location: {
      gradientStart: defaults.colorSettings.location.gradientStart,
      gradientEnd: defaults.colorSettings.location.gradientEnd,
      textColor: defaults.colorSettings.location.textColor
    },
    keyConcept: {
      gradientStart: defaults.colorSettings.keyConcept.gradientStart,
      gradientEnd: defaults.colorSettings.keyConcept.gradientEnd,
      textColor: defaults.colorSettings.keyConcept.textColor
    }
  });
  const [bubblePositionSetting, setBubblePositionSetting] = useState<BubblePositionEnum>(defaults.position);
  const [getBubbleDistance, setBubbleDistance] = useState(defaults.bubbleDistance);
  const [getModelAPI, setModelAPI] = useState(defaults.modelAPI);
  const [selectedTheme, setSelectedTheme] = useState<ThemeEnum>(defaults.theme);
  const [getBubbleSize, setBubbleSize] = useState(defaults.bubbleSize);
  const [isTransparent, setTransparent] = useState(defaults.bubbleTransparency);
  const [highlightsOn, setHighlightsOn] = useState(defaults.textHighlighting);
  const [usage, setUsage] = useState({ input: 0, output: 0, calls: 0 });
  const [tier, setTier] = useState<ModelTierEnum>(defaults.modelTier);
  const [localModel, setLocalModel] = useState(defaults.ollamaModel);
  const [launcherOn, setLauncherOn] = useState(defaults.showLauncher);
  const [analyseState, setAnalyseState] = useState<'idle' | 'done' | 'unsupported'>('idle');
  // The blocklist is deliberately *not* part of the staged settings below. It
  // is a privacy control: "never on this site" has to take effect the moment
  // it is clicked, not once the user remembers to press Save.
  const [blocked, setBlocked] = useState<string[]>(defaults.blockedSites);
  const [currentSite, setCurrentSite] = useState('');
  const [siteDraft, setSiteDraft] = useState('');
  // Everything except the API key stages until Save, so the popup has to say
  // when it is holding changes the page has not seen.
  const [dirty, setDirty] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const [
        savedApiKey,
        savedPixels,
        savedMaxElements,
        savedEntityColors,
        savedNumberOfCharacters,
        savedBubblePosition,
        savedBubbleDistance,
        savedModelAPI,
        savedTheme,
        savedBubbleSize,
        savedTransparency,
        savedHighlighting,
        savedUsage,
        savedTier,
        savedLocalModel,
        savedLauncher,
        savedBlocked
      ] = await Promise.all([
        apiKey.getValue(),
        pixelDistance.getValue(),
        maxNumberOfElements.getValue(),
        bubbleColors.getValue(),
        maxNumberOfCharacters.getValue(),
        bubblePosition.getValue(),
        bubbleDistance.getValue(),
        modelAPI.getValue(),
        themeStorage.getValue(),
        bubbleSize.getValue(),
        bubbleTransparency.getValue(),
        textHighlighting.getValue(),
        tokenUsage.getValue(),
        modelTier.getValue(),
        ollamaModel.getValue(),
        showLauncher.getValue(),
        blockedSites.getValue()
      ]);

      setHasApiKey(!!savedApiKey);
      setPixels(savedPixels || defaults.scrollThreshold);
      setMaxElements(savedMaxElements || defaults.maxElements);
      setColorSettings(savedEntityColors || defaults.colorSettings);
      setNumberOfCharacters(savedNumberOfCharacters || defaults.maxCharacters);
      setBubblePositionSetting(savedBubblePosition || defaults.position);
      setSelectedTheme(savedTheme || defaults.theme);
      setBubbleDistance(savedBubbleDistance || defaults.bubbleDistance);
      setModelAPI(savedModelAPI || defaults.modelAPI);
      setBubbleSize(savedBubbleSize || defaults.bubbleSize);
      setTransparent(savedTransparency ?? defaults.bubbleTransparency);
      setHighlightsOn(savedHighlighting ?? defaults.textHighlighting);
      setUsage(savedUsage ?? { input: 0, output: 0, calls: 0 });
      setTier(savedTier || defaults.modelTier);
      setLocalModel(savedLocalModel ?? defaults.ollamaModel);
      setLauncherOn(savedLauncher ?? defaults.showLauncher);
      setBlocked(savedBlocked ?? defaults.blockedSites);
      setHasLoaded(true);
    }
    loadSettings();

    // Which site the "Never on this site" button would act on.
    browser.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => setCurrentSite(siteLabel(tab?.url)))
      .catch(() => { /* no tab to offer; the manual field still works */ });
  }, []);

  // Everything the Save button is responsible for. Comparing a snapshot beats
  // marking dirty in fifteen separate handlers, where one omission silently
  // reintroduces "why did my change not apply?".
  const stagedSettings = JSON.stringify({
    pixels, maxElements, colorSettings, numberOfCharacters, bubblePositionSetting,
    getBubbleDistance, getModelAPI, selectedTheme, getBubbleSize, isTransparent,
    highlightsOn, tier, localModel, launcherOn,
  });
  const savedSettingsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasLoaded) return;
    if (savedSettingsRef.current === null) {
      // The freshly loaded values are the baseline, not pending changes.
      savedSettingsRef.current = stagedSettings;
      return;
    }
    setDirty(stagedSettings !== savedSettingsRef.current);
  }, [hasLoaded, stagedSettings]);

  // Paint the popup surface itself. Mantine's light/dark scheme alone can't
  // express the Library parchment or the Cyberpunk terminal look, and setting
  // this on <body> also reaches portalled dropdowns.
  useEffect(() => {
    const preset = themes[selectedTheme];
    document.body.style.backgroundColor = preset.surfaceBackground;
    document.body.style.color = preset.surfaceText;
    document.body.style.fontFamily = preset.fontFamily;

    // Clear every override any theme might set before applying this one,
    // so switching themes never leaves a stale variable behind.
    Object.values(themes)
      .flatMap(t => Object.keys(t.mantineVars ?? {}))
      .forEach(name => document.body.style.removeProperty(name));
    Object.entries(preset.mantineVars ?? {})
      .forEach(([name, value]) => document.body.style.setProperty(name, value));

    onThemeChange?.(selectedTheme);
  }, [selectedTheme, onThemeChange]);

  const handleSave = async () => {
    try {
      const updates = [
        pixelDistance.setValue(pixels),
        maxNumberOfElements.setValue(maxElements),
        bubbleColors.setValue(colorSettings),
        maxNumberOfCharacters.setValue(numberOfCharacters),
        bubblePosition.setValue(bubblePositionSetting),
        bubbleDistance.setValue(getBubbleDistance),
        modelAPI.setValue(getModelAPI),
        themeStorage.setValue(selectedTheme),
        bubbleSize.setValue(getBubbleSize),
        bubbleTransparency.setValue(isTransparent),
        textHighlighting.setValue(highlightsOn),
        modelTier.setValue(tier),
        ollamaModel.setValue(localModel),
        showLauncher.setValue(launcherOn)
      ];
      // Only touch the stored key if the user actually typed a replacement
      // or explicitly reset it — otherwise an unrelated settings save would
      // silently wipe the existing key.
      if (apiKeyDirty) {
        updates.push(apiKey.setValue(apiKeyDraft));
      }

      await Promise.all(updates);

      if (apiKeyDirty) {
        setHasApiKey(!!apiKeyDraft);
        setApiKeyDraft('');
        setApiKeyDirty(false);
        setApiKeyEditing(false);
      }

      savedSettingsRef.current = stagedSettings;
      setDirty(false);
      setStatus('Settings saved successfully!');
      setStatusType('success');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Failed to save settings.');
      setStatusType('error');
      console.error(error);
    }
  };

  // Resets appearance and behaviour only. The blocklist is deliberately left
  // alone, as the key and the saved entities are: quietly un-blocking someone's
  // bank because they wanted their bubble colours back would be a nasty
  // surprise, and it is the one setting where the safe default is to keep it.
  const handleResetAll = async () => {
    try {
      setPixels(defaults.scrollThreshold);
      setMaxElements(defaults.maxElements);
      setColorSettings(defaults.colorSettings);
      setNumberOfCharacters(defaults.maxCharacters);
      setBubblePositionSetting(defaults.position);
      setBubbleDistance(defaults.bubbleDistance);
      setSelectedTheme(defaults.theme);
      setTier(defaults.modelTier);
      setBubbleSize(defaults.bubbleSize);
      setTransparent(defaults.bubbleTransparency);
      setHighlightsOn(defaults.textHighlighting);

      // Save default values to storage
      await Promise.all([
        pixelDistance.setValue(defaults.scrollThreshold),
        maxNumberOfElements.setValue(defaults.maxElements),
        bubbleColors.setValue(defaults.colorSettings),
        maxNumberOfCharacters.setValue(defaults.maxCharacters),
        bubblePosition.setValue(defaults.position),
        bubbleDistance.setValue(defaults.bubbleDistance),
        themeStorage.setValue(defaults.theme),
        bubbleSize.setValue(defaults.bubbleSize),
        bubbleTransparency.setValue(defaults.bubbleTransparency),
        textHighlighting.setValue(defaults.textHighlighting),
        modelTier.setValue(defaults.modelTier)
      ]);

      setStatus('All settings reset to defaults!');
      setStatusType('success');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Failed to reset settings.');
      setStatusType('error');
      console.error(error);
    }
  };

  const handleThemeChange = (newTheme: ThemeEnum) => {
    setSelectedTheme(newTheme);
    setColorSettings(themes[newTheme].colorSettings);
  };

  const handleResetTheme = () => {
    handleThemeChange(defaults.theme);
  };

  const handleResetApiKey = () => {
    setApiKeyDraft(defaults.apiKey);
    setApiKeyDirty(true);
    setHasApiKey(false);
    setApiKeyEditing(true);
  };

  const handleResetMaxElements = () => {
    setMaxElements(defaults.maxElements);
  };

  const handleResetPixels = () => {
    setPixels(defaults.scrollThreshold);
  };

  const handleResetNumberOfCharacters = () => {
    setNumberOfCharacters(defaults.maxCharacters);
  };

  const handleResetBubblePosition = () => {
    setBubblePositionSetting(defaults.position);
  };

  const handleResetBubbleDistance = () => {
    setBubbleDistance(defaults.bubbleDistance);
  };

  /** Starts an analysis on the current tab, so the obvious gesture works. */
  const handleAnalyse = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      setAnalyseState('unsupported');
      return;
    }
    await browser.runtime.sendMessage({ activate: true, tabId: tab.id }).catch(() => { });
    setAnalyseState('done');
    setTimeout(() => window.close(), 400);
  };

  /** Applied straight away — see the note on the `blocked` state above. */
  const commitBlocked = async (next: string[]) => {
    setBlocked(next);
    await blockedSites.setValue(next);
  };

  const handleBlockSite = (site: string) => {
    const next = addPattern(blocked, site);
    if (next !== blocked) commitBlocked(next);
    setSiteDraft('');
  };

  const handleUnblockSite = (site: string) =>
    commitBlocked(blocked.filter((entry) => entry !== site));

  const currentSiteBlocked = isSiteBlocked(
    currentSite ? `https://${currentSite}` : undefined, blocked,
  );

  const handleResetUsage = async () => {
    // Applied immediately rather than staged: this is a counter, not a setting.
    await tokenUsage.setValue({ input: 0, output: 0, calls: 0 });
    setUsage({ input: 0, output: 0, calls: 0 });
  };

  const handleResetBubbleSize = () => {
    setBubbleSize(defaults.bubbleSize);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const positionCombobox = useCombobox({
    onDropdownClose: () => positionCombobox.resetSelectedOption(),
  });

  const modelCombobox = useCombobox({
    onDropdownClose: () => modelCombobox.resetSelectedOption(),
  });

  const tierCombobox = useCombobox({
    onDropdownClose: () => tierCombobox.resetSelectedOption(),
  });

  const themeCombobox = useCombobox({
    onDropdownClose: () => themeCombobox.resetSelectedOption(),
  });

  const positionOptions = Object.values(BubblePositionEnum).map(pos => (
    <Combobox.Option key={pos} value={pos}>
      {pos}
    </Combobox.Option>
  ));

  const modelOptions = Object.values(modelAPIsEnum).map(api => (
    <Combobox.Option key={api} value={api}>
      {api}
    </Combobox.Option>
  ));

  const tierOptions = Object.values(ModelTierEnum).map(t => (
    <Combobox.Option key={t} value={t}>
      {t} &mdash; {models[getModelAPI][t]}
    </Combobox.Option>
  ));

  const themeOptions = Object.values(ThemeEnum).map(t => (
    <Combobox.Option key={t} value={t}>
      {t}
    </Combobox.Option>
  ));

  const updateColorSetting = (
    entityType: keyof typeof colorSettings,
    colorType: keyof typeof colorSettings['person'],
    value: string
  ) => {
    setColorSettings(prev => ({
      ...prev,
      [entityType]: {
        ...prev[entityType],
        [colorType]: value
      }
    }));
  };

  const resetEntityColors = (entityType: keyof typeof colorSettings) => {
    setColorSettings(prev => ({
      ...prev,
      [entityType]: defaults.colorSettings[entityType]
    }));
  };

  return (
    <Stack gap="lg">
      <Group justify="center" gap="sm">
        <Image src={bubblenerLogo} h={64} w={64} alt="Bubblener Logo" />
        <Title order={2} ta="center">Bubblener Settings</Title>
      </Group>

      {/* What state am I in, and what do I do next? The popup used to open
          straight into a form, so a new user could not tell whether they were
          set up, and an existing one could not tell why nothing happened. */}
      {!hasApiKey && getModelAPI !== modelAPIsEnum.Ollama ? (
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <IconAlertCircle size={18} style={{ flex: 'none', marginTop: 2 }} />
          <Text size="sm">
            No API key yet — choose a provider below and paste a key to get started.
          </Text>
        </Group>
      ) : (
        <Stack gap={6}>
          <Button
            onClick={handleAnalyse}
            leftSection={<IconSparkles size={16} />}
            fullWidth
          >
            Analyse this page
          </Button>
          <Text size="xs" ta="center" style={{ color: 'var(--mantine-color-dimmed)' }}>
            {analyseState === 'unsupported'
              ? 'This kind of page cannot be analysed — try an ordinary web page.'
              : 'Also available by right-clicking a page, or from the button on the page itself.'}
          </Text>
        </Stack>
      )}

      <Input.Wrapper
        label="Model API"
        description="Select the model API you want to use."
      >
        <Combobox
          store={modelCombobox}
          onOptionSubmit={(val) => {
            setModelAPI(val as modelAPIsEnum);
            modelCombobox.closeDropdown();
          }}
        >
          <Combobox.Target>
            <InputBase
              component="button"
              type="button"
              pointer
              rightSection={<Combobox.Chevron />}
              rightSectionPointerEvents="none"
              onClick={() => modelCombobox.toggleDropdown()}
              style={{ flex: 1 }}
            >
              {getModelAPI || <Input.Placeholder>Pick a model</Input.Placeholder>}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown>
            <Combobox.Options>{modelOptions}</Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Input.Wrapper>
      <Input.Wrapper
        label="Model Quality"
        description={getModelAPI === modelAPIsEnum.Ollama
          ? 'Used only when no local model is named below.'
          : 'Low is cheapest and usually enough; High reads dense text more reliably.'}
      >
        <Combobox
          store={tierCombobox}
          onOptionSubmit={(val) => {
            setTier(val as ModelTierEnum);
            tierCombobox.closeDropdown();
          }}
        >
          <Combobox.Target>
            <InputBase
              component="button"
              type="button"
              pointer
              rightSection={<Combobox.Chevron />}
              rightSectionPointerEvents="none"
              onClick={() => tierCombobox.toggleDropdown()}
              style={{ flex: 1 }}
            >
              {tier} &mdash; {models[getModelAPI][tier]}
            </InputBase>
          </Combobox.Target>

          <Combobox.Dropdown>
            <Combobox.Options>{tierOptions}</Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
      </Input.Wrapper>

      {getModelAPI === modelAPIsEnum.Ollama && (
        <Input.Wrapper
          label="Ollama Model"
          description="Name of a model you have pulled, e.g. llama3.2. Leave blank to use the tier default."
        >
          <TextInput
            value={localModel}
            onChange={(event) => setLocalModel(event.currentTarget.value)}
            placeholder={models[modelAPIsEnum.Ollama][tier]}
          />
        </Input.Wrapper>
      )}

      <Input.Wrapper
        label="API Key"
        description={getModelAPI === modelAPIsEnum.Ollama
          ? 'Not needed — Ollama runs on your machine and nothing leaves it.'
          : 'Your key is stored locally.'}
      >
        {hasApiKey && !apiKeyEditing && (
          <Text c="green" size="sm" mb={4}>Key saved</Text>
        )}
        <Group gap="xs">
          {hasApiKey && !apiKeyEditing ? (
            <Button
              variant="light"
              onClick={() => setApiKeyEditing(true)}
              style={{ flex: 1 }}
            >
              Change Key
            </Button>
          ) : (
            <PasswordInput
              id="apiKey"
              value={apiKeyDraft}
              onChange={(e) => {
                setApiKeyDraft(e.target.value);
                setApiKeyDirty(true);
              }}
              onBlur={() => {
                if (!apiKeyDraft && hasApiKey) {
                  setApiKeyEditing(false);
                }
              }}
              placeholder="Enter your API Key for your chosen service."
              style={{ flex: 1 }}
              autoFocus={apiKeyEditing}
            />
          )}
          <ActionIcon
            variant="light"
            color="gray"
            onClick={handleResetApiKey}
            title="Reset API Key"
          >
            <IconRotateClockwise size={16} />
          </ActionIcon>
        </Group>
      </Input.Wrapper>

      {/* Everything below is tuning. Fifteen controls of equal weight put the
          API key below the fold, behind theme choices, on first run. */}
      <Accordion variant="separated" multiple defaultValue={[]}>
        <Accordion.Item value="reading">
          <Accordion.Control icon={<IconBook size={16} />}>Reading</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="lg" pt="xs">
        <Input.Wrapper
          label="Max Number of Elements"
          description="Maximum number of bubbles to display."
        >
          <Group gap="xs">
            <NumberInput
              value={maxElements}
              onChange={(value) => setMaxElements(Number(value))}
              placeholder={defaults.maxElements.toString()}
              min={1}
              max={100}
              suffix=' bubbles'
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetMaxElements}
              title="Reset Max Elements"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Input.Wrapper
          label="Max Number of Characters"
          description="Maximum number of characters to send to API."
        >
          <Group gap="xs">
            <NumberInput
              value={numberOfCharacters}
              onChange={(value) => setNumberOfCharacters(Number(value))}
              placeholder={defaults.maxCharacters.toString()}
              min={1000}
              max={100000}
              suffix=' characters'
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetNumberOfCharacters}
              title="Reset Max Characters"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Input.Wrapper
          label="Scroll Trigger Distance (pixels)"
          description="How far to scroll before the bubbles reload."
        >
          <Group gap="xs">
            <NumberInput
              value={pixels}
              onChange={(value) => setPixels(Number(value))}
              placeholder={defaults.scrollThreshold.toString()}
              suffix="px"
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetPixels}
              title="Reset Scroll Distance"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="privacy">
          <Accordion.Control icon={<IconBan size={16} />}>Privacy</Accordion.Control>
          <Accordion.Panel>
            <Input.Wrapper
              label="Blocked sites"
              description="Bubblener never reads or sends anything on these, and shows no launch button. Blocking a site covers its subdomains. Saved immediately, not on Save."
            >
              <Stack gap="xs" mt="xs">
                {currentSite && (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconBan size={16} />}
                    disabled={currentSiteBlocked}
                    onClick={() => handleBlockSite(currentSite)}
                  >
                    {currentSiteBlocked
                      ? `${currentSite} is blocked`
                      : `Never on ${currentSite}`}
                  </Button>
                )}

                {blocked.map((site) => (
                  <Group key={site} gap="xs" wrap="nowrap">
                    <Text size="sm" style={{ flex: 1, wordBreak: 'break-all' }}>{site}</Text>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      onClick={() => handleUnblockSite(site)}
                      title={`Stop blocking ${site}`}
                      aria-label={`Stop blocking ${site}`}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ))}

                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    placeholder="example.com"
                    value={siteDraft}
                    onChange={(event) => setSiteDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleBlockSite(siteDraft);
                    }}
                    style={{ flex: 1 }}
                    aria-label="Site to block"
                  />
                  <Button
                    variant="light"
                    disabled={!siteDraft.trim()}
                    onClick={() => handleBlockSite(siteDraft)}
                  >
                    Block
                  </Button>
                </Group>
              </Stack>
            </Input.Wrapper>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="appearance">
          <Accordion.Control icon={<IconPalette size={16} />}>Appearance</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="lg" pt="xs">
        <Input.Wrapper
          label="Theme"
          description="Sets the color palette for both the settings and the on-page bubbles."
        >
          <Group gap="xs">
            <Combobox
              store={themeCombobox}
              onOptionSubmit={(val) => {
                handleThemeChange(val as ThemeEnum);
                themeCombobox.closeDropdown();
              }}
            >
              <Combobox.Target>
                <InputBase
                  component="button"
                  type="button"
                  pointer
                  rightSection={<Combobox.Chevron />}
                  rightSectionPointerEvents="none"
                  onClick={() => themeCombobox.toggleDropdown()}
                  style={{ flex: 1 }}
                >
                  {selectedTheme || <Input.Placeholder>Pick a theme</Input.Placeholder>}
                </InputBase>
              </Combobox.Target>

              <Combobox.Dropdown>
                <Combobox.Options>{themeOptions}</Combobox.Options>
              </Combobox.Dropdown>
            </Combobox>
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetTheme}
              title="Reset Theme"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Input.Wrapper
          label="Bubble Position"
          description="Choose where the bubbles will appear on the screen."
        >
          <Group gap="xs">
            <Combobox
              store={positionCombobox}
              onOptionSubmit={(val) => {
                setBubblePositionSetting(val as BubblePositionEnum);
                positionCombobox.closeDropdown();
              }}
            >
              <Combobox.Target>
                <InputBase
                  component="button"
                  type="button"
                  pointer
                  rightSection={<Combobox.Chevron />}
                  rightSectionPointerEvents="none"
                  onClick={() => positionCombobox.toggleDropdown()}
                  style={{ flex: 1 }}
                >
                  {bubblePositionSetting || <Input.Placeholder>Pick value</Input.Placeholder>}
                </InputBase>
              </Combobox.Target>

              <Combobox.Dropdown>
                <Combobox.Options>{positionOptions}</Combobox.Options>
              </Combobox.Dropdown>
            </Combobox>
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetBubblePosition}
              title="Reset Bubble Position"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Input.Wrapper
          label="Bubble Distance"
          description="Distance of bubbles from the edge of the screen."
        >
          <Group gap="xs">
            <NumberInput
              value={getBubbleDistance}
              onChange={(value) => setBubbleDistance(Number(value))}
              placeholder={defaults.bubbleDistance.toString()}
              min={10}
              max={1000}
              suffix='px'
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetBubbleDistance}
              title="Reset Bubble Distance"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Input.Wrapper
          label="Bubble Size"
          description="Text size of the bubbles; padding scales with it."
        >
          <Group gap="xs">
            <NumberInput
              value={getBubbleSize}
              onChange={(value) => setBubbleSize(Number(value))}
              placeholder={defaults.bubbleSize.toString()}
              min={9}
              max={24}
              suffix='px'
              style={{ flex: 1 }}
            />
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleResetBubbleSize}
              title="Reset Bubble Size"
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Group>
        </Input.Wrapper>

        <Switch
          checked={isTransparent}
          onChange={(event) => setTransparent(event.currentTarget.checked)}
          label="Fade bubbles when idle"
          description="Rests the bubbles at partial opacity so page text stays readable; hovering restores them."
        />

        <Switch
          checked={launcherOn}
          onChange={(event) => setLauncherOn(event.currentTarget.checked)}
          label="Show the launch button on pages"
          description="A small, faint button in the corner of every page that starts an analysis."
        />

        <Switch
          checked={highlightsOn}
          onChange={(event) => setHighlightsOn(event.currentTarget.checked)}
          label="Highlight entities in the page"
          description="Underlines each mention, and draws a connecting line to its bubble on hover."
        />

              <Stack gap="md">
                <Title order={5}>Entity Colors</Title>
            <EntityColorSection
              entityType="person"
              displayName="Person"
              colors={colorSettings.person}
              isOpen={openSections.person}
              onToggleSection={toggleSection}
              onUpdateColorSetting={updateColorSetting}
              onResetEntityColors={resetEntityColors}
            />

            <EntityColorSection
              entityType="organization"
              displayName="Organization"
              colors={colorSettings.organization}
              isOpen={openSections.organization}
              onToggleSection={toggleSection}
              onUpdateColorSetting={updateColorSetting}
              onResetEntityColors={resetEntityColors}
            />

            <EntityColorSection
              entityType="location"
              displayName="Location"
              colors={colorSettings.location}
              isOpen={openSections.location}
              onToggleSection={toggleSection}
              onUpdateColorSetting={updateColorSetting}
              onResetEntityColors={resetEntityColors}
            />

            <EntityColorSection
              entityType="keyConcept"
              displayName="Key Concept/Theme"
              colors={colorSettings.keyConcept}
              isOpen={openSections.keyConcept}
              onToggleSection={toggleSection}
              onUpdateColorSetting={updateColorSetting}
              onResetEntityColors={resetEntityColors}
            />
              </Stack>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>



      <Input.Wrapper
        label="Token Usage"
        description="Totals for your own API key, across every page since the last reset."
      >
        <Group gap="xs" align="center">
          <Text size="sm" style={{ flex: 1 }}>
            ↑ {formatTokens(usage.input)} in &nbsp;·&nbsp; ↓ {formatTokens(usage.output)} out
            &nbsp;·&nbsp; {usage.calls} {usage.calls === 1 ? 'request' : 'requests'}
          </Text>
          <ActionIcon
            variant="light"
            color="gray"
            onClick={handleResetUsage}
            title="Reset Token Usage"
          >
            <IconRotateClockwise size={16} />
          </ActionIcon>
        </Group>
      </Input.Wrapper>

      {(dirty || apiKeyDirty) && !status && (
        <Text size="sm" ta="center" style={{ color: 'var(--mantine-color-dimmed)' }}>
          Unsaved changes — pages keep the old settings until you save.
        </Text>
      )}

      {status && (
        <Text c={statusType === 'success' ? 'green' : 'red'} size="sm" ta="center">{status}</Text>
      )}

      <Button
        variant="light"
        leftSection={<IconBooks size={16} />}
        onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/library.html') })}
        fullWidth
      >
        Starred &amp; hidden entities
      </Button>

      <Group justify="space-between" mt="md" align="center">
        <Button
          onClick={handleSave}
          leftSection={<IconDeviceFloppy size={16} />}
          variant={dirty || apiKeyDirty ? 'filled' : 'light'}
        >
          {dirty || apiKeyDirty ? 'Save Settings *' : 'Save Settings'}
        </Button>

        <Button
          onClick={handleResetAll}
          variant="light"
          color="red"
          leftSection={<IconRestore size={16} />}
        >
          Reset All
        </Button>
      </Group>
    </Stack>
  );
}

export default App;