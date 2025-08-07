import BubblePositionEnum from '@/utils/types/bubblePositionEnum';
import bubbleColors from '@/utils/storage/bubbleColors';
import bubblePosition from '@/utils/storage/bubblePosition';
import maxNumberOfCharacters from '@/utils/storage/maxNumberOfCharacters';
import { ActionIcon, Button, Combobox, Group, Image, Input, InputBase, NumberInput, PasswordInput, Stack, Text, Title, useCombobox } from '@mantine/core';
import { IconDeviceFloppy, IconRestore, IconRotateClockwise } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import EntityColorSection from '@/components/EntityColorSection/EntityColorSection';
import defaults from '@/utils/constants/defaults';
import apiKey from '@/utils/storage/apiKey';
import maxNumberOfElements from '@/utils/storage/maxNumberOfElements';
import pixelDistance from '@/utils/storage/pixelDistance';
import bubbleDistance from '@/utils/storage/bubbleDistance';
import modelAPI from '@/utils/storage/modelAPI';
import modelAPIsEnum from '@/utils/types/modelAPIsEnum';
import './App.css';
import bubblenerLogo from '/icon-128.png';

function App() {
  const [getApiKey, setApiKey] = useState('');
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
        savedModelAPI
      ] = await Promise.all([
        apiKey.getValue(),
        pixelDistance.getValue(),
        maxNumberOfElements.getValue(),
        bubbleColors.getValue(),
        maxNumberOfCharacters.getValue(),
        bubblePosition.getValue(),
        bubbleDistance.getValue(),
        modelAPI.getValue()
      ]);

      setApiKey(savedApiKey || '');
      setPixels(savedPixels || defaults.scrollThreshold);
      setMaxElements(savedMaxElements || defaults.maxElements);
      setColorSettings(savedEntityColors || defaults.colorSettings);
      setNumberOfCharacters(savedNumberOfCharacters || defaults.maxCharacters);
      setBubblePositionSetting(savedBubblePosition || defaults.position);
      setBubbleDistance(savedBubbleDistance || defaults.bubbleDistance);
      setModelAPI(savedModelAPI || defaults.modelAPI);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await Promise.all([
        apiKey.setValue(getApiKey),
        pixelDistance.setValue(pixels),
        maxNumberOfElements.setValue(maxElements),
        bubbleColors.setValue(colorSettings),
        maxNumberOfCharacters.setValue(numberOfCharacters),
        bubblePosition.setValue(bubblePositionSetting),
        bubbleDistance.setValue(getBubbleDistance),
        modelAPI.setValue(getModelAPI)
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
      setBubblePositionSetting(defaults.position);
      setBubbleDistance(defaults.bubbleDistance);

      // Save default values to storage
      await Promise.all([
        pixelDistance.setValue(defaults.scrollThreshold),
        maxNumberOfElements.setValue(defaults.maxElements),
        bubbleColors.setValue(defaults.colorSettings),
        maxNumberOfCharacters.setValue(defaults.maxCharacters),
        bubblePosition.setValue(defaults.position),
        bubbleDistance.setValue(defaults.bubbleDistance)
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

  const handleResetBubblePosition = () => {
    setBubblePositionSetting(defaults.position);
  };

  const handleResetBubbleDistance = () => {
    setBubbleDistance(defaults.bubbleDistance);
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
        label="API Key"
        description="Your key is stored locally."
      >
        <Group gap="xs">
          <PasswordInput
            id="apiKey"
            value={getApiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API Key for your chosen service."
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