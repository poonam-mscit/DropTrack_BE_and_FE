/**
 * Persisted session on the device. AsyncStorage is fine for dev — swap to
 * SecureStore before TestFlight if you want OS-keychain protection.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Session {
  userId: string;
  email: string;
  /** Cognito access token. Optional while we're in dev impersonation. */
  accessToken?: string;
  refreshToken?: string;
  /** Dev-mode fallback when Cognito isn't wired. */
  devUserId?: string;
}

const KEY = 'droptrack.session';

export async function getSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export async function setSession(s: Session): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
