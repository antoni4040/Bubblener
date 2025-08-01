import { useState, useEffect } from 'react';
import { PasswordInput, Container, Title, Input, Stack, NumberInput, Button, Group, Text, Image, ColorInput } from '@mantine/core';
import bubblenerLogo from '/icon-128.png';
import './App.css';
import { geminiApiKey } from '../../utils/geminiApiKey';
import { pixelDistance } from '../../utils/pixelDistance';
import { maxNumberOfElements } from '../../utils/maxNumberOfElements';

function App() {
  // 2. Use standard useState for component state management.
  const [apiKey, setApiKey] = useState('');
  const [pixels, setPixels] = useState(100);
  const [status, setStatus] = useState('');
  const [maxElements, setMaxElements] = useState(12);

  // 3. Use useEffect to load data from storage when the component mounts.
  useEffect(() => {
    async function loadSettings() {
      // Fetch all values from storage.
      const savedApiKey = await geminiApiKey.getValue();
      const savedPixels = await pixelDistance.getValue();
      const savedMaxElements = await maxNumberOfElements.getValue();

      // Update the state with the loaded values.
      // The defaultValue from defineItem will be used as a fallback.
      setApiKey(savedApiKey || '');
      setPixels(savedPixels || 100);
      setMaxElements(savedMaxElements || 12);
    }
    loadSettings();
  }, []); // Empty array ensures this runs only once.

  // 4. Create a manual save handler.
  const handleSave = async () => {
    try {
      await Promise.all([
        geminiApiKey.setValue(apiKey),
        pixelDistance.setValue(pixels),
        maxNumberOfElements.setValue(maxElements),
      ]);
      setStatus('Settings saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Failed to save settings.');
      console.error(error);
    }
  };

  return (
    // Using Mantine's Stack component for easy vertical spacing
    <Stack gap="lg">
      <Group justify="center" gap="sm">
        <Image src={bubblenerLogo} h={64} w={64} alt="Bubblener Logo" />
        <Title order={2} ta="center">Bubblener Settings</Title>
      </Group>

      {/* Gemini API Key */}
      <Input.Wrapper
        label="Gemini API Key"
        description="Your key is stored locally and securely."
      >
        <PasswordInput
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Gemini API Key"
        />
      </Input.Wrapper>

      {/* Max Number of Elements */}
      <Input.Wrapper
        label="Max Number of Elements"
        description="Maximum number of elements to display in the popup."
      >
        <NumberInput
          value={maxElements}
          onChange={(value) => setMaxElements(Number(value))}
          placeholder="12"
          min={1}
          max={100}
        />
      </Input.Wrapper>

      {/* Scroll Trigger Distance */}
      <Input.Wrapper
        label="Scroll Trigger Distance (pixels)"
        description="How far to scroll before the extension fires again."
      >
        <NumberInput
          value={pixels}
          onChange={(value) => setPixels(Number(value))}
          placeholder="100"
        />
      </Input.Wrapper>
      
      {/* Save Button and Status */}
      <Group justify="space-between" mt="md">
        <Button onClick={handleSave}>Save Settings</Button>
        <Text c="green" size="sm">{status}</Text>
      </Group>

    </Stack>
  );
}

export default App;
