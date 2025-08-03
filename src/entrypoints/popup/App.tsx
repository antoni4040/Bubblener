import { useState, useEffect } from 'react';
import { PasswordInput, Title, Input, Stack, NumberInput, Button, Group, Text, Image, ActionIcon, Collapse, ColorInput } from '@mantine/core';
import { IconDeviceFloppy, IconRestore, IconRotateClockwise, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import bubblenerLogo from '/icon-128.png';
import './App.css';
import geminiApiKey from '../../utils/storage/geminiApiKey';
import pixelDistance from '../../utils/storage/pixelDistance'
import maxNumberOfElements from '../../utils/storage/maxNumberOfElements';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import EntityColorSection from '../../components/EntityColorSection/EntityColorSection';
import defaults from '../../utils/constants/defaults';
import bubbleColors from '@/utils/storage/bubbleColors';

function App() {
  const [apiKey, setApiKey] = useState('');
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

  useEffect(() => {
    async function loadSettings() {
      const [
        savedApiKey,
        savedPixels,
        savedMaxElements,
        savedEntityColors,
        savedNumberOfCharacters
      ] = await Promise.all([
        geminiApiKey.getValue(),
        pixelDistance.getValue(),
        maxNumberOfElements.getValue(),
        bubbleColors.getValue(),
        maxNumberOfCharacters.getValue()
      ]);

      setApiKey(savedApiKey || '');
      setPixels(savedPixels || defaults.scrollThreshold);
      setMaxElements(savedMaxElements || defaults.maxElements);
      setColorSettings(savedEntityColors || defaults.colorSettings);
      setNumberOfCharacters(savedNumberOfCharacters || defaults.maxCharacters);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await Promise.all([
        geminiApiKey.setValue(apiKey),
        pixelDistance.setValue(pixels),
        maxNumberOfElements.setValue(maxElements),
        bubbleColors.setValue(colorSettings),
        maxNumberOfCharacters.setValue(numberOfCharacters)
      ]);
      setStatus('Settings saved successfully!');
      setStatusType('success');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Failed to save settings.');
      setStatusType('error');
      console.error(error);
    }
  };

  const handleResetAll = async () => {
    try {
      setPixels(defaults.scrollThreshold);
      setMaxElements(defaults.maxElements);
      setColorSettings(defaults.colorSettings);
      setNumberOfCharacters(defaults.maxCharacters);

      // Save default values to storage
      await Promise.all([
        pixelDistance.setValue(defaults.scrollThreshold),
        maxNumberOfElements.setValue(defaults.maxElements),
        bubbleColors.setValue(defaults.colorSettings),
        maxNumberOfCharacters.setValue(defaults.maxCharacters),
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

  const handleResetApiKey = () => {
    setApiKey(defaults.apiKey);
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

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

      <Input.Wrapper
        label="Gemini API Key"
        description="Your key is stored locally."
      >
        <Group gap="xs">
          <PasswordInput
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API Key"
            style={{ flex: 1 }}
          />
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

      <Stack gap="md">
        <Title order={4}>Entity Colors</Title>
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

      <Group justify="space-between" mt="md" align="center">
        <Button
          onClick={handleSave}
          leftSection={<IconDeviceFloppy size={16} />}
        >
          Save Settings
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

      {status && (
        <Text c={statusType === 'success' ? 'green' : 'red'} size="sm" ta="center">{status}</Text>
      )}
    </Stack>
  );
}

export default App;