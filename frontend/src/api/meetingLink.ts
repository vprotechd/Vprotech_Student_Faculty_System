import { Alert, Linking } from 'react-native';

// Opens a faculty-provided video class link (Google Meet / Zoom / Teams ...).
export const openMeetingLink = async (url?: string | null) => {
  const value = url?.trim();
  if (!value) {
    Alert.alert('Class link unavailable', 'Your faculty has not shared a video link for this class yet.');
    return;
  }
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Unsupported link protocol.');
    }
    await Linking.openURL(parsed.toString());
  } catch {
    Alert.alert('Unable to open class', 'The video link is invalid or could not be opened.');
  }
};
