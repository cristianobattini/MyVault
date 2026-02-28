import useKeyboardAvoiding from '@/hooks/useKeyboardAvoiding';
import { useThemeColor } from '@/hooks/useThemeColor';
import { FontAwesome } from '@expo/vector-icons';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Platform,
  Dimensions,
  Keyboard
} from 'react-native';

interface BottomSheetProps {
  visible: boolean;
  children: React.ReactElement;
  heightPrecentile: number; // from 0 to 1
  onRequestClose: () => void;
}

const BottomSheet = ({ visible, children, heightPrecentile, onRequestClose }: BottomSheetProps) => {
  const [animatedValue] = useState(new Animated.Value(0));
  const { animatedTranslateY } = useKeyboardAvoiding();
  const backgroundColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const iconColor = useThemeColor({ light: '#000', dark: '#ECEDEE' }, 'text');
  const sheetHeight = useRef(Dimensions.get('window').height * heightPrecentile);
  const isKeyboardVisible = useRef(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => { isKeyboardVisible.current = true; }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => { isKeyboardVisible.current = false; }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight.current, 0],
  });

  const combinedTranslateY = Animated.add(
    translateY,
    Animated.multiply(
      animatedTranslateY,
      animatedValue.interpolate({
        inputRange: [0.9, 1],
        outputRange: [0, isKeyboardVisible.current ? 1 : 0],
        extrapolate: 'clamp',
      })
    )
  );

  return (
    <Modal 
      visible={visible} 
      transparent={true} 
      animationType="none" 
    >
      <TouchableOpacity 
        activeOpacity={1}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <Animated.View
            style={[
              styles.modalForm,
              {
                transform: [{ translateY: combinedTranslateY }],
                height: sheetHeight.current,
                backgroundColor,
              }
            ]}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              sheetHeight.current = height;
            }}
          >
            <TouchableOpacity onPress={onRequestClose}>
              <FontAwesome
                size={24}
                name="close"
                style={{ color: iconColor, alignSelf: 'flex-end' }}
              />
            </TouchableOpacity>
            {children}
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalForm: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
});

export default BottomSheet;