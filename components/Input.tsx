import { useThemeColor } from '@/hooks/useThemeColor';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
type FontAwesomeIconNames = keyof typeof FontAwesome.glyphMap;

interface InputProps {
    placeholder: string;
    label?: string;
    passwordVisibility?: boolean;
    iconName: FontAwesomeIconNames;
    onChangeText?: (text: string) => void;
    value?: string;
}

const Input: React.FC<InputProps> = ({ placeholder, iconName, label, passwordVisibility = false, onChangeText, value }) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(!passwordVisibility);
    const textColor = useThemeColor({ light: '#11181C', dark: '#ECEDEE' }, 'text');

    return (
        <View style={{ width: '100%', marginVertical: 10 }}>
            {label != null ? <ThemedText type="defaultSemiBold" style={{ alignSelf: 'flex-start', marginBottom: 5, marginLeft: 5, fontSize: 18 }}>
                {label}
            </ThemedText> : null}
            <View
                style={[styles.inputContainer, { borderColor: useThemeColor({ light: '#000', dark: '#fff' }, "text") }]}
            >
                <View style={styles.icon}>
                    <FontAwesome name={iconName} size={20} color={useThemeColor({ light: '#ccc', dark: '#ffffff' }, "text")} />
                </View>
                <TextInput
                    placeholder={placeholder}
                    style={[styles.input, { color: textColor }]}
                    secureTextEntry={!isPasswordVisible}
                    onChangeText={onChangeText}
                    value={value}
                />
                {passwordVisibility && (
                    <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                        <FontAwesome
                            name={isPasswordVisible ? "eye" : "eye-slash"}
                            size={20}
                            color={useThemeColor({ light: '#ccc', dark: '#ffffff' }, "text")}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 25,
        paddingVertical: 15,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        width: '82%',
        fontSize: 16,
        textAlign: 'left',
    },
});

export default Input;