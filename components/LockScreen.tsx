import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BiometricService } from '@/services/biometricService';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [failed, setFailed] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const tryAuthenticate = async () => {
    setFailed(false);
    const success = await BiometricService.authenticate();
    if (success) {
      onUnlock();
    } else {
      setFailed(true);
    }
  };

  useEffect(() => {
    tryAuthenticate();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Octicons name="lock" size={64} color={textColor} style={styles.icon} />
      <ThemedText type="title" style={styles.appName}>MyVault</ThemedText>
      <ThemedText style={styles.subtitle}>Authenticate to continue</ThemedText>

      {failed && (
        <TouchableOpacity style={styles.button} onPress={tryAuthenticate}>
          <ThemedText style={styles.buttonText}>Try Again</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    marginBottom: 24,
  },
  appName: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: 40,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
