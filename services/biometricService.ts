import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY = 'biometricEnabled';

export const BiometricService = {
  isSupported: async () => {
    const hw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return hw && enrolled;
  },

  isEnabled: async () => (await SecureStore.getItemAsync(KEY)) === 'true',

  setEnabled: async (v: boolean) => SecureStore.setItemAsync(KEY, v ? 'true' : 'false'),

  authenticate: async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access MyVault',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  },
};
