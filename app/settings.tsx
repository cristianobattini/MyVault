import React, { useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
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
    const realm = useRealm();

    // ── Biometric ──────────────────────────────────────────────────────────────
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

    // ── Export ─────────────────────────────────────────────────────────────────
    const [exportFileName, setExportFileName] = useState('');
    const [exportPassword, setExportPassword] = useState('');
    const [exportConfirm, setExportConfirm] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!exportPassword) {
            Alert.alert('Error', 'Please enter an encryption password.');
            return;
        }
        if (exportPassword !== exportConfirm) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        if (exportPassword.length < 8) {
            Alert.alert('Weak Password', 'Please use at least 8 characters for better protection.');
            return;
        }

        setIsExporting(true);
        try {
            const fileUri = await RealmDataService.exportData(realm, exportPassword, exportFileName || undefined);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    dialogTitle: 'Share Encrypted Backup',
                    mimeType:   'application/octet-stream',
                    UTI:        'public.data',
                });
            } else {
                Alert.alert('Export Complete', `File saved to:\n${fileUri}`);
            }
        } catch (error) {
            Alert.alert('Export Failed', 'An error occurred during export.');
            console.error(error);
        } finally {
            setIsExporting(false);
        }
    };

    // ── Import ─────────────────────────────────────────────────────────────────
    const [importPassword, setImportPassword] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!importPassword) {
            Alert.alert('Error', 'Please enter the backup password.');
            return;
        }

        try {
            const result = await getDocumentAsync({
                type:               '*/*',
                copyToCacheDirectory: true,
                multiple:           false,
            });

            if (result.canceled) return;

            if (result.assets?.length > 0) {
                setIsImporting(true);
                try {
                    await RealmDataService.importData(realm, result.assets[0].uri, importPassword);
                    Alert.alert('Import Complete', 'Credentials imported successfully.');
                    setImportPassword('');
                } catch (error: any) {
                    Alert.alert('Import Failed', error?.message ?? 'Wrong password or corrupted file.');
                } finally {
                    setIsImporting(false);
                }
            }
        } catch (error) {
            console.error('Document picker error:', error);
            Alert.alert('Error', 'Failed to open file picker.');
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

                {/* ── Security ──────────────────────────────────────────── */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Security</ThemedText>

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

                {/* ── Export Backup ─────────────────────────────────────── */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Export Backup</ThemedText>
                    <ThemedText style={styles.sectionHint}>
                        Creates an AES-256 encrypted .mvault file you can share or store safely.
                    </ThemedText>

                    <ThemedText style={styles.label}>File name (optional)</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. my-vault-backup"
                        value={exportFileName}
                        onChangeText={setExportFileName}
                        autoCapitalize="none"
                    />

                    <ThemedText style={styles.label}>Encryption password</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Min. 8 characters"
                        secureTextEntry
                        value={exportPassword}
                        onChangeText={setExportPassword}
                    />

                    <ThemedText style={styles.label}>Confirm password</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Repeat password"
                        secureTextEntry
                        value={exportConfirm}
                        onChangeText={setExportConfirm}
                    />

                    {isExporting ? (
                        <View style={styles.progressRow}>
                            <ActivityIndicator size="small" />
                            <ThemedText style={styles.progressText}>
                                Deriving key — this may take a moment…
                            </ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleExport}>
                            <ThemedText style={styles.buttonText}>Export</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Import Backup ─────────────────────────────────────── */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Import Backup</ThemedText>
                    <ThemedText style={styles.sectionHint}>
                        Restores credentials from a .mvault file. Existing data is kept.
                    </ThemedText>

                    <ThemedText style={styles.label}>Backup password</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Password used when exporting"
                        secureTextEntry
                        value={importPassword}
                        onChangeText={setImportPassword}
                    />

                    {isImporting ? (
                        <View style={styles.progressRow}>
                            <ActivityIndicator size="small" />
                            <ThemedText style={styles.progressText}>
                                Verifying and decrypting…
                            </ThemedText>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleImport}>
                            <ThemedText style={styles.buttonText}>Choose File & Import</ThemedText>
                        </TouchableOpacity>
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
        justifyContent: 'space-between',
    },
    contentContainer: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
        borderRadius: 10,
        padding: 15,
        borderWidth: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    sectionHint: {
        fontSize: 12,
        opacity: 0.55,
        marginBottom: 14,
    },
    label: {
        marginBottom: 5,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderRadius: 5,
        padding: 10,
        marginBottom: 15,
    },
    button: {
        marginTop: 4,
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
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
        paddingVertical: 14,
    },
    progressText: {
        fontSize: 13,
        opacity: 0.7,
    },
});

export default Settings;
