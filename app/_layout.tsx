import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';
import { RealmProvider } from "@realm/react";

import { useColorScheme } from '@/hooks/useColorScheme';
import { Credential } from '@/models/Credential';
import { Tag } from '@/models/Tag';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import { PaperProvider } from 'react-native-paper';
import { LockScreen } from '@/components/LockScreen';
import { BiometricService } from '@/services/biometricService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // null = still checking, false = locked, true = unlocked
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const appState = useRef(AppState.currentState);

  /* const migrationFunction = (oldRealm: Realm, newRealm: Realm) => {

  }; */

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Check biometric on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const enabled = await BiometricService.isEnabled();
      if (enabled) {
        setIsUnlocked(false); // show lock screen
      } else {
        setIsUnlocked(true); // no lock needed
      }
    };
    checkBiometric();
  }, []);

  // Re-lock when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (appState.current === 'active' && nextState === 'background') {
        const enabled = await BiometricService.isEnabled();
        if (enabled) {
          setIsUnlocked(false);
        }
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  if (!loaded || isUnlocked === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <PaperProvider>
          {!isUnlocked ? (
            <LockScreen onUnlock={() => setIsUnlocked(true)} />
          ) : (
            <RealmProvider schemaVersion={3} schema={[Credential, Tag]}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                  name="credential-detail"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="settings"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="+not-found" />
              </Stack>
              <StatusBar style="auto" />
            </RealmProvider>
          )}
        </PaperProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
