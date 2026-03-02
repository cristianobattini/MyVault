import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';
import React, { useEffect, useState } from 'react';
import { Animated, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery, useRealm } from '@realm/react';
import { Credential } from '@/models/Credential';
import { Tag } from '@/models/Tag';
import CredentialCard from '@/components/CredentialCard';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import { useForm, Controller } from 'react-hook-form';
import { KeyboardAvoidingProvider } from '@/components/store/KeyboardAvoidingProvider';
import { BSON } from 'realm';
import ColorPicker from '@/components/ColorPickers';
import { Octicons } from '@expo/vector-icons';
import FloatingMenuButton from '@/components/FloatingButton';
import FavoritesToggle from '@/components/FavoritesToggle';
import { ObjectId } from 'bson';
import IconPicker, { IconName } from '@/components/IconPicker';
import { Link } from 'expo-router';

const Index = () => {
    const realm = useRealm();
    const credentials = useQuery(Credential);
    const tags = useQuery(Tag);
    const [selectedTag, setSelectedTag] = useState<BSON.ObjectId | null>(null);
    const [showArchived, setShowArchived] = useState<boolean>(false);
    const [showFavorites, setShowFavorites] = useState<boolean>(false);
    const [showCredentialSheet, setShowCredentialSheet] = useState(false);
    const [showTagSheet, setShowTagSheet] = useState(false);
    const [selectedColor, setSelectedColor] = useState('#808080');
    const [selectedIcon, setSelectedIcon] = useState<IconName | undefined>(undefined);
    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);

    const { control: credentialControl, handleSubmit: handleCredentialSubmit, reset: resetCredentialForm } = useForm();
    const { control: tagControl, handleSubmit: handleTagSubmit, reset: resetTagForm } = useForm();

    const modalAnim = useState(new Animated.Value(0))[0];
    const scaleAnim = useState(new Animated.Value(1))[0];
    const modalBackgroundColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');

    // Filtra le credenziali per tag selezionato
    const filteredCredentials = (selectedTag
        ? credentials.filtered('ANY tags._id == $0', selectedTag)
        : credentials).filter(x => showArchived ? x.isArchived == true : x.isArchived == false).filter(x => showFavorites ? x.isFavorite == true : true)

    const handleCreateNewCredential = (data: any) => {
        realm.write(() => {
            const newCredential = realm.create(Credential, {
                _id: new BSON.ObjectId(),
                title: data.title,
                username: data.username,
                password: data.password,
                url: data.url || '',
                notes: data.notes || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                isFavorite: false,
                isArchived: false,
            });

            if (selectedTag) {
                const tag = realm.objectForPrimaryKey<Tag>(Tag, selectedTag);
                if (tag) {
                    tag.credentials.push(newCredential);
                }
            }
        });
        setShowCredentialSheet(false)
        resetCredentialForm()
    };

    const handleLongPressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handleLongPressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    const handleCreateTag = (data: any) => {
        realm.write(() => {
            if (editingTag) {
                realm.create(Tag, {
                    ...editingTag,
                    name: data.name,
                    colorHex: selectedColor,
                    iconName: selectedIcon,
                }, Realm.UpdateMode.Modified);
                setEditingTag(null)
            } else {
                realm.create(Tag, {
                    _id: new BSON.ObjectId(),
                    name: data.name,
                    colorHex: selectedColor,
                    iconName: selectedIcon,
                    credentials: [],
                });
            }
        });
        setShowTagSheet(false);
        resetTagForm();
        setEditingTag(null);
    };

    const deleteTag = (id: ObjectId) => {
        realm.write(() => {
            const tagToDelete = realm.objectForPrimaryKey(Tag, id);
            if (tagToDelete) {
                realm.delete(tagToDelete);
            }
        });
    };

    useEffect(() => {
        if (tagModalVisible) {
            Animated.spring(modalAnim, {
                toValue: 1,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.spring(modalAnim, {
                toValue: 0,
                useNativeDriver: true,
            }).start();
        }
    }, [tagModalVisible]);

    return (
        <KeyboardAvoidingProvider>
            {/* Create new credential BottomSheet */}
            <BottomSheet
                heightPrecentile={0.55}
                visible={showCredentialSheet}
                onRequestClose={() => setShowCredentialSheet(false)}
            >
                <View style={styles.sheetContainer}>
                    <Controller
                        control={credentialControl}
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
                        control={credentialControl}
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
                        control={credentialControl}
                        name="password"
                        rules={{ required: "Inserisci una password" }}
                        render={({ field: { onChange, value } }) => (
                            <Input
                                label={'Password'}
                                placeholder="••••••••"
                                passwordVisibility={true}
                                iconName="key"
                                onChangeText={onChange}
                                value={value}
                            />
                        )}
                    />

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={handleCredentialSubmit(handleCreateNewCredential)}
                        >
                            <ThemedText style={styles.buttonText}>Crea</ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={() => setShowCredentialSheet(false)}
                        >
                            <ThemedText style={styles.buttonText}>Annulla</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </BottomSheet>

            {/* Create new tag BottomSheet */}
            <BottomSheet
                heightPrecentile={0.90}
                visible={showTagSheet}
                onRequestClose={() => { setShowTagSheet(false); setEditingTag(null) }}
            >
                <View style={styles.sheetContainer}>
                    <Controller
                        control={tagControl}
                        name="name"
                        rules={{ required: "Inserisci un nome per il tag" }}
                        render={({ field: { onChange, value } }) => (
                            <Input
                                label={'Nome Tag'}
                                placeholder="Lavoro, Personale, etc."
                                iconName={'tag'}
                                onChangeText={onChange}
                                value={value}
                            />
                        )}
                    />

                    <View style={{ marginVertical: 15 }}>
                        <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>
                            Seleziona un colore
                        </ThemedText>
                        <ColorPicker
                            selectedColor={selectedColor}
                            onColorSelect={setSelectedColor}
                        />
                    </View>

                    <View style={{ marginVertical: 15 }}>
                        <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>
                            Seleziona un'icona
                        </ThemedText>
                        <IconPicker onIconSelect={setSelectedIcon} selectedIcon={selectedIcon} />
                    </View>

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={handleTagSubmit(handleCreateTag)}
                        >
                            <ThemedText style={styles.buttonText}>
                                {editingTag ? 'Update Tag' : 'Create Tag'}
                            </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={() => setShowTagSheet(false)}
                        >
                            <ThemedText style={styles.buttonText}>Annulla</ThemedText>
                        </TouchableOpacity>
                    </View>
                </View>
            </BottomSheet>

            {/* Main */}
            <ThemedView style={styles.container}>
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
                        <Link href="/settings" asChild>
                            <Octicons name='gear' size={28} />
                        </Link>
                        <ThemedText type="title">MyVault</ThemedText>
                    </View>
                    <FavoritesToggle onToggleFavorite={() => {
                        setShowFavorites(true)
                    }} onToggleNotFavorite={() => {
                        setShowFavorites(false)
                    }} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                    {/* Tags list */}
                    <View style={styles.tagSection}>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={tags}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.tagItem,
                                        selectedTag?.equals(item._id) && styles.selectedTag,
                                        { backgroundColor: item.colorHex },
                                    ]}
                                    onPress={() => {
                                        if (selectedTag?.equals(item._id)) {
                                            setSelectedTag(null);
                                        } else {
                                            setSelectedTag(item._id);
                                        }
                                    }}
                                    onLongPress={() => {
                                        setEditingTag(item);
                                        setTagModalVisible(true);
                                    }}
                                    onPressIn={handleLongPressIn}
                                    onPressOut={handleLongPressOut}
                                    activeOpacity={0.7}
                                    delayLongPress={300}
                                >
                                    {selectedTag?.equals(item._id) ? (
                                        <Octicons name="x" size={20} color="#fff" />
                                    ) : (
                                        <Octicons name={item.iconName as IconName} size={16} color={'#fff'} />
                                    )}
                                    <Text style={styles.tagText}>{item.name}</Text>
                                </TouchableOpacity>
                            )}
                        >
                        </FlatList>
                    </View>

                    <TouchableOpacity onPress={() => setShowArchived(!showArchived)}>
                        <Octicons name={showArchived ? 'chevron-left' : 'archive'} size={24} />
                    </TouchableOpacity>
                </View>

                {showArchived ? <ThemedText type='subtitle' style={{ marginLeft: 15 }}>Archived</ThemedText> : null}

                {/* Credentials list */}
                {filteredCredentials.length === 0 ? (
                    <View style={styles.emptyState}>
                        <ThemedText type="subtitle">Nessuna credenziale trovata</ThemedText>
                    </View>
                ) : (
                    <FlatList
                        data={filteredCredentials}
                        keyExtractor={(item) => item._id.toHexString()}
                        contentContainerStyle={styles.credentialList}
                        renderItem={({ item }) => (
                            <CredentialCard item={item}/>
                        )}
                    />
                )}
            </ThemedView>

            <FloatingMenuButton
                mainButtonColor="#FF6B6B"
                actions={[
                    {
                        iconName: "key",
                        label: "Credential",
                        onPress: () => setShowCredentialSheet(true),
                        color: "#4ECDC4"
                    },
                    {
                        iconName: "tag",
                        label: "Tag",
                        onPress: () => {
                            setEditingTag(null)
                            setShowTagSheet(true)
                        },
                        color: "#45B7D1"
                    },
                ]}
            />

            {/* Tag modal */}
            <Modal
                animationType="none"
                transparent={true}
                visible={tagModalVisible}
                onRequestClose={() => {
                    setEditingTag(null);
                    setTagModalVisible(false);
                }}>
                <View style={styles.centeredView}>
                    <Animated.View
                        style={[
                            styles.modalView,
                            {
                                backgroundColor: modalBackgroundColor,
                                opacity: modalAnim,
                                transform: [
                                    {
                                        scale: modalAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.9, 1],
                                        })
                                    }
                                ]
                            }
                        ]}
                    >
                        <TouchableOpacity onPress={() => { setTagModalVisible(false); setEditingTag(null) }} style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                            <ThemedText style={styles.modalText}>
                                {editingTag ? `Edit ${editingTag.name}` : 'What action would you like to perform?'}
                            </ThemedText>
                            <Octicons name='x' size={22} />
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: 'orange' }]}
                                onPress={() => {
                                    if (editingTag) {
                                        setShowTagSheet(true);
                                        setTagModalVisible(false);
                                        resetTagForm({
                                            name: editingTag.name
                                        });
                                        setSelectedColor(editingTag.colorHex);
                                        setSelectedIcon(editingTag.iconName as IconName);
                                    }
                                }}>
                                <Octicons name='pencil' color={'white'} size={18} />
                                <ThemedText style={styles.textStyle}>Edit</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: 'red' }]}
                                onPress={() => {
                                    if (editingTag) {
                                        deleteTag(editingTag._id);
                                    }
                                    setTagModalVisible(false);
                                    setEditingTag(null);
                                }}>
                                <Octicons name='trash' color={'white'} size={18} />
                                <ThemedText style={styles.textStyle}>Delete</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </KeyboardAvoidingProvider >
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalView: {
        margin: 20,
        height: '20%',
        width: '80%',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    buttonOpen: {
        backgroundColor: '#F194FF',
    },
    buttonClose: {
        backgroundColor: '#2196F3',
    },
    textStyle: {
        color: 'white',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'center',
    },
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    sheetContainer: {
        flex: 1,
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    tagSection: {
        marginVertical: 16,
        marginRight: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 5
    },
    tagListContent: {
        paddingHorizontal: 16,
        alignItems: 'center',
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
    addTagButton: {
        backgroundColor: '#3a3a3a',
    },
    selectedTag: {
        borderWidth: 0
    },
    tagText: {
        color: 'white',
        marginLeft: 6,
        fontSize: 16
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    credentialList: {
        padding: 8,
    },
    credentialRow: {
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    credentialCard: {
        flex: 1,
        maxWidth: '48%',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24,
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        gap: 8,
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
});

export default Index;