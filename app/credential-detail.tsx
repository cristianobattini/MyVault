import { useQuery, useRealm } from '@realm/react';
import { BSON, List } from 'realm';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, TextInput, Linking, Clipboard, Text, FlatList } from 'react-native';
import { Credential } from '@/models/Credential';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Octicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useThemeColor } from '@/hooks/useThemeColor';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import { useForm, Controller } from 'react-hook-form';
import { KeyboardAvoidingProvider } from '@/components/store/KeyboardAvoidingProvider';
import { Button, Dialog, Portal, Snackbar } from 'react-native-paper';
import TagsPicker from '@/components/TagsPicker';
import { IconName } from '@/components/IconPicker';
import { Tag } from '@/models/Tag';

export default function CredentialDetail() {
    const { id } = useLocalSearchParams();
    const realm = useRealm();
    const [isFavorite, setIsFavorite] = useState(false);
    const [isArchived, setIsArchived] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showEditSheet, setShowEditSheet] = useState(false);
    const [notes, setNotes] = useState('');
    const [clipboardSnackbarVisible, setClipboardSnackbarVisible] = useState(false);
    const [notesSnackbarVisible, setNotesSnackbarVisible] = useState(false);
    const [tagSelectionVisible, setTagSelectionVisible] = useState(false);
    const [tagDeleteVisible, setTagDeleteVisible] = useState(false);
    const [selectedTag, setSelectedTag] = useState<Tag>();

    const tags: List<Tag> = useQuery(Tag) as unknown as List<Tag>
    const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');

    const navigation = useNavigation()

    const credential = realm.objectForPrimaryKey<Credential>(
        'Credential',
        new BSON.ObjectId(id as string)
    );

    useEffect(() => {
        setIsFavorite(credential?.isFavorite!)
        setIsArchived(credential?.isArchived!)
        setNotes(credential?.notes ?? '')
    }, [])

    const { control, handleSubmit, reset } = useForm({
        defaultValues: {
            title: credential?.title || '',
            username: credential?.username || '',
            password: credential?.password || '',
            url: credential?.url || '',
            notes: credential?.notes || ''
        }
    });

    if (!credential) {
        return (
            <ThemedView style={styles.container}>
                <ThemedText>Credenziale non trovata</ThemedText>
            </ThemedView>
        );
    }

    const handleUpdateCredential = (data: any) => {
        realm.write(() => {
            credential.title = data.title;
            credential.username = data.username;
            credential.password = data.password;
            credential.url = data.url;
            credential.notes = data.notes;
            credential.updatedAt = new Date();
        });
        setShowEditSheet(false);
    };

    const handleSaveNotes = () => {
        realm.write(() => {
            credential.notes = notes
        })
        setNotesSnackbarVisible(true)
        setTimeout(() => setNotesSnackbarVisible(false), 2000)
    }

    const toggleFavorite = () => {
        realm.write(() => {
            credential.isFavorite = !credential.isFavorite;
        });
        setIsFavorite(!isFavorite)
    };

    const toggleArchive = () => {
        realm.write(() => {
            credential.isArchived = !credential.isArchived;
        });
        setIsArchived(!isArchived)
    };

    const handleNavigateToUrl = () => {
        if (credential.url !== '') {
            let urlToNavigateTo = credential.url;
            if (!credential.url.startsWith('http://') && !credential.url.startsWith('https://'))
                urlToNavigateTo = 'https://' + credential.url;
            Linking.openURL(urlToNavigateTo);
        }
    }

    const copyToClipboard = (data: string) => {
        Clipboard.setString(data);
        showClipboardSnackbar()
    };

    const showClipboardSnackbar = () => {
        setClipboardSnackbarVisible(true)
        setTimeout(() => setClipboardSnackbarVisible(false), 2000)
    }

    return (
        <KeyboardAvoidingProvider>
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => {
                            navigation.dispatch({ type: 'POP_TO_TOP' })
                        }}>
                            <Octicons size={28} name='chevron-left' />
                        </TouchableOpacity>
                        <ThemedText type="title">{credential.title}</ThemedText>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity onPress={toggleFavorite}>
                            <Octicons
                                name={credential.isFavorite ? 'star-fill' : 'star'}
                                size={24}
                                color={credential.isFavorite ? '#FFD700' : undefined}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowEditSheet(true)}>
                            <Octicons name="pencil" size={24} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={toggleArchive}>
                            <Octicons
                                name={!credential.isArchived ? 'archive' : 'chevron-left'}
                                size={24}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', marginBottom: 5, gap: 2 }}>
                    {credential.tags.length != tags.length && (<TouchableOpacity onPress={() => setTagSelectionVisible(true)} style={[styles.tagItem, { backgroundColor: 'grey', gap: 5 }]}>
                        <Octicons name='plus' color={'white'} size={18} />
                        {credential.tags.length == 0 && <Text style={styles.tagText}>Set tag</Text>}
                    </TouchableOpacity>)}
                    {credential.tags.length != 0 &&
                        (<View style={{ height: 50 }}>
                            <FlatList
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                data={credential.tags}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.tagItem,
                                            { backgroundColor: item.colorHex },
                                        ]}
                                        onPress={() => {
                                            setSelectedTag(item)
                                            setTagDeleteVisible(true)
                                        }}
                                    >

                                        <Octicons name={item.iconName as IconName} size={16} color={'#fff'} />
                                        <Text style={styles.tagText}>{item.name}</Text>
                                    </TouchableOpacity>
                                )}
                            >
                            </FlatList>
                        </View>
                        )}
                </View>

                <View style={styles.detailSection}>
                    <DetailRow
                        icon="person"
                        label="Username"
                        value={credential.username}
                        onPress={() => { copyToClipboard(credential.username) }}
                        actionIcon={'paste'}
                    />

                    <DetailRow
                        icon="lock"
                        label="Password"
                        value={showPassword ? credential.password : '•'.repeat(credential.password.length)}
                        onPress={() => {
                            copyToClipboard(credential.password)
                            setShowPassword(!showPassword)
                        }}
                        actionIcon={showPassword ? 'eye-closed' : 'eye'}
                    />

                    <DetailRow
                        icon="link"
                        label="URL"
                        value={credential.url}
                        onPress={handleNavigateToUrl}
                        actionIcon={'rocket'}
                    />

                    <View style={{ marginTop: 10 }}>
                        <View style={{ marginBottom: 10, flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
                            <View style={styles.title}>
                                <Octicons name={'note'} size={26} style={styles.rowIcon} />
                                <ThemedText style={{ fontSize: 22 }}>{'Notes'}</ThemedText>
                            </View>
                            {notes != '' && <TouchableOpacity onPress={handleSaveNotes}>
                                <Octicons name='check-circle' color={'green'} size={26} />
                            </TouchableOpacity>}
                        </View>
                        <TextInput
                            editable
                            multiline
                            numberOfLines={4}
                            style={{ fontSize: 18, height: 250, color: textColor }}
                            onChangeText={text => setNotes(text)}
                            placeholder='Insert some notes...'
                            placeholderTextColor="#999"
                            value={notes}
                            textAlignVertical="top"
                            returnKeyType="done"
                        />
                    </View>

                    <View style={styles.metaSection}>
                        <ThemedText type="defaultSemiBold">
                            Creata il: {credential.createdAt.toLocaleDateString()}
                        </ThemedText>
                        <ThemedText type="defaultSemiBold">
                            Ultima modifica: {credential.updatedAt.toLocaleDateString()}
                        </ThemedText>
                    </View>
                </View>

                {/* Edit Credential Bottom Sheet */}
                <BottomSheet
                    heightPrecentile={0.70}
                    visible={showEditSheet}
                    onRequestClose={() => setShowEditSheet(false)}
                >
                    <View style={styles.sheetContainer}>
                        <Controller
                            control={control}
                            name="title"
                            rules={{ required: "Inserisci un titolo" }}
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={'Titolo'}
                                    placeholder="Nome della credenziale"
                                    iconName={'tag'}
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="username"
                            rules={{ required: "Inserisci username/email" }}
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={'Username/Email'}
                                    placeholder="user@example.com"
                                    iconName="user"
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="password"
                            rules={{ required: "Inserisci una password" }}
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={'Password'}
                                    placeholder="••••••••"
                                    passwordVisibility={true}
                                    iconName="lock"
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />

                        <Controller
                            control={control}
                            name="url"
                            render={({ field: { onChange, value } }) => (
                                <Input
                                    label={'URL'}
                                    placeholder="https://example.com"
                                    iconName="link"
                                    onChangeText={onChange}
                                    value={value}
                                />
                            )}
                        />

                        <View style={styles.buttonsContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton]}
                                onPress={handleSubmit(handleUpdateCredential)}
                            >
                                <ThemedText style={styles.buttonText}>Salva</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.secondaryButton]}
                                onPress={() => setShowEditSheet(false)}
                            >
                                <ThemedText style={styles.buttonText}>Annulla</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </BottomSheet>

                {/* Tag Selector Dialog */}
                <Portal>
                    <Dialog
                        visible={tagSelectionVisible}
                        onDismiss={() => setTagSelectionVisible(false)}
                        style={styles.tagSelectionModal}
                    >
                        <TagsPicker tags={tags} onTagSelect={(newTag) => {
                            if (!credential.tags.includes(newTag)) {
                                newTag.addCredential(realm, credential)
                                setTagSelectionVisible(false)
                            }
                        }} selectedTags={credential.tags} />
                    </Dialog>
                </Portal>

                {/* Remove Tag Dialog */}
                <Portal>
                    <Dialog
                        visible={tagDeleteVisible}
                        onDismiss={() => setTagDeleteVisible(false)}
                    >
                        <Dialog.Content><ThemedText type='subtitle'>Remove tag from credential?</ThemedText></Dialog.Content>
                        <Dialog.Actions>
                            <Button buttonColor='red' style={{borderRadius: 10}} textColor='white' onPress={() => {
                                if(selectedTag) {
                                    selectedTag.removeCredential(realm, credential)
                                }
                                setTagDeleteVisible(false)
                            }}>Remove</Button>
                            <Button onPress={() => {
                                setTagDeleteVisible(false)
                            }}>Cancel</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>
            </ThemedView>

            <Snackbar
                visible={clipboardSnackbarVisible}
                onDismiss={() => { }}
            >
                Copied to clipboard.
            </Snackbar>

            <Snackbar
                visible={notesSnackbarVisible}
                onDismiss={() => { }}
                style={{ backgroundColor: 'green' }}
            >
                Notes saved.
            </Snackbar>
        </KeyboardAvoidingProvider>
    );
}

const DetailRow = ({
    icon,
    label,
    value,
    onPress,
    actionIcon
}: {
    icon: string;
    label: string;
    value: string;
    onPress?: () => void;
    actionIcon?: string;
}) => (
    <View style={styles.detailRow}>
        <View style={styles.title}>
            <Octicons name={icon as any} size={26} style={styles.rowIcon} />
            <ThemedText style={{ fontSize: 22 }}>{label}</ThemedText>
        </View>

        <TouchableOpacity
            style={styles.content}
            onPress={onPress}
            disabled={!onPress}
        >
            <ThemedText type={label == 'URL' ? 'link' : 'default'} style={styles.rowValue}>{value}</ThemedText>
            {actionIcon && <Octicons name={actionIcon as any} size={22} />}
        </TouchableOpacity>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        marginTop: 20
    },
    tagSelectionModal: {
        padding: 20
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    tagText: {
        color: 'white',
        marginLeft: 6,
        fontSize: 16
    },
    tagItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: 40,
        borderWidth: 4,
        borderColor: 'white'
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
    },
    detailSection: {
        gap: 16,
    },
    detailRow: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        gap: 10
    },
    title: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    content: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    rowIcon: {
        opacity: 0.6,
    },
    rowValue: {
        maxWidth: 200,
        fontSize: 20
    },
    metaSection: {
        marginTop: 24,
        gap: 8,
    },
    sheetContainer: {
        flex: 1,
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 12,
    },
    button: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButton: {
        backgroundColor: '#007AFF',
    },
    secondaryButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
    },
    tagButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16
    }
});