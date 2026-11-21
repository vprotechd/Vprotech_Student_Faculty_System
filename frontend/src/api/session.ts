import AsyncStorage from '@react-native-async-storage/async-storage';
import API from './apiClient';

export type SessionUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
};

const SESSION_KEYS = [
  'token',
  'user',
  'userData',
  'userToken',
  'userRole',
  'role',
  'isAdmin',
];

/**
 * The login screen saves the signed-in user under "userData".
 * Older screens used "user", so read both.
 */
export const getStoredUser = async (): Promise<SessionUser | null> => {
  for (const key of ['userData', 'user']) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) return JSON.parse(raw) as SessionUser;
    } catch {
      // ignore a corrupt value and try the next key
    }
  }
  return null;
};

export const clearSession = async () => {
  try {
    await AsyncStorage.multiRemove(SESSION_KEYS);
  } catch {
    // ignore
  }
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('token');
  } catch {
    // ignore (not available on native)
  }
};

/** Revokes the session on the server (best effort) and clears local data. */
export const logoutUser = async () => {
  try {
    await API.post('/auth/logout');
  } catch {
    // The token may already be expired - still sign out locally.
  }
  await clearSession();
};
