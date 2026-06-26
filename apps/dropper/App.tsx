import { NavigationContainer, DefaultTheme, type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/auth/AuthContext';
import { RootStack } from '@/nav/RootStack';
import { colors } from '@/theme';

const theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.borderSoft,
    primary: colors.accent,
    notification: colors.danger,
  },
};

/**
 * Deep-link config: `droptrackdropper://accept?token=…` routes into the auth
 * stack's AcceptInvite screen. Also handles the Expo Go runtime scheme so
 * universal links work in development.
 */
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: [
    Linking.createURL('/'),                   // droptrackdropper:// + Expo Go runtime URL
    'droptrackdropper://',                    // standalone build
    'https://droptrack.com.au/dropper',       // future universal link
  ],
  config: {
    screens: {
      Login: 'login',
      AcceptInvite: 'accept',
    },
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <NavigationContainer theme={theme} linking={linking}>
            <RootStack />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
