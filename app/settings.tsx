import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Octicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useRealm } from '@realm/react';
import { getDocumentAsync } from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import RealmDataService from '@/services/realmDataService';
import { BiometricService } from '@/services/biometricService';

const Settings = () => {
    const navigation = useNavigation();
    const realm = useRealm(); // Get Realm instance from context

    const [isProcessing, setIsProcessing] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [exportFileName, setExportFileName] = useState('');

    const [biometricSupported, setBiometricSupported] = useState(false);
    const [biometricEnabled, setBiometricEnabled] = useState(false);

    useEffect(() => {
        const loadBiometricState = async () => {
            const supported = await BiometricService.isSupported();
            const enabled = await BiometricService.isEnabled();
            setBiometricSupported(supported);
            setBiometricEnabled(enabled);
        };
        loadBiometricState();
    }, []);

    const handleBiometricToggle = async (value: boolean) => {
        if (value) {
            const success = await BiometricService.authenticate();
            if (!success) {
                Alert.alert('Authentication Failed', 'Could not enable biometric lock.');
                return;
            }
        }
        await BiometricService.setEnabled(value);
        setBiometricEnabled(value);
    };

    const handleExport = async () => {
        if (!password) {
            Alert.alert('Error', 'Please enter an encryption password');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setIsProcessing(true);
        try {
            const fileName = exportFileName || `credentials_export_${new Date().toISOString().split('T')[0]}`;
            const fileUri = await RealmDataService.exportData(realm, password);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    dialogTitle: 'Share Encrypted Backup',
                    mimeType: 'application/json',
                    UTI: 'public.json',
                });
            } else {
                Alert.alert(
                    'Export Complete',
                    'File saved to: ' + fileUri,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert('Export Failed', 'An error occurred during export');
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImport = async () => {
        if (!password) {
            Alert.alert('Error', 'Please enter the encryption password');
            return;
        }

        try {
            const result = await getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
                multiple: false
            });

            if (result.canceled) {
                console.log('User canceled document picker');
                return;
            }

            if (result.assets && result.assets.length > 0) {
                setIsProcessing(true);
                try {
                    const file = result.assets[0];
                    await RealmDataService.importData(realm, file.uri, password);
                    Alert.alert('Success', 'Credentials imported successfully');
                } catch (error) {
                    Alert.alert('Import Failed', 'Wrong password or corrupted file');
                    console.error(error);
                } finally {
                    setIsProcessing(false);
                }
            }
        } catch (error) {
            console.error('Document picker error:', error);
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Octicons size={28} name='chevron-left' />
                    </TouchableOpacity>
                    <ThemedText type='title'>Settings</ThemedText>
                </View>
            </View>

            <View style={styles.contentContainer}>
                <View style={styles.section}>
                    <ThemedText style={styles.title}>Security</ThemedText>

                    <View style={styles.row}>
                        <View style={styles.rowLabel}>
                            <ThemedText>Biometric Lock</ThemedText>
                            {!biometricSupported && (
                                <ThemedText style={styles.rowHint}>
                                    Not available on this device
                                </ThemedText>
                            )}
                        </View>
                        <Switch
                            value={biometricEnabled}
                            onValueChange={handleBiometricToggle}
                            disabled={!biometricSupported}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <ThemedText style={styles.title}>Data Management</ThemedText>

                    <ThemedText style={styles.label}>Export File Name (optional):</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter file name"
                        value={exportFileName}
                        onChangeText={setExportFileName}
                    />

                    <ThemedText style={styles.label}>Encryption Password:</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter password"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <ThemedText style={styles.label}>Confirm Password:</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm password"
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />

                    {isProcessing ? (
                        <ActivityIndicator size="small" style={{ marginTop: 20 }} />
                    ) : (
                        <>
                            <TouchableOpacity 
                                style={styles.button} 
                                onPress={handleExport}
                            >
                                <ThemedText style={styles.buttonText}>Export Data</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.button} 
                                onPress={handleImport}
                            >
                                <ThemedText style={styles.buttonText}>Import Data</ThemedText>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 30,
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
    },
    label: {
        marginBottom: 5,
    },
    button: {
        marginTop: 10,
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        backgroundColor: '#007AFF',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    rowLabel: {
        flex: 1,
        marginRight: 12,
    },
    rowHint: {
        fontSize: 12,
        opacity: 0.5,
        marginTop: 2,
    },
});

export default Settings;