import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableWithoutFeedback, 
  TouchableOpacity,
  Dimensions,
  ScrollView,
  BackHandler,
  Platform,
  StatusBar,
  SafeAreaView 
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import ProfileSection from './ProfileSection';
import RoutingPreferences, { RoutingPreference } from './RoutingPreferences';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

const { width, height } = Dimensions.get('window');
const MENU_WIDTH = width * 0.85; // 85% of screen width

interface SideMenuProps {
  isVisible: boolean;
  onClose: () => void;
  toLogin: () => void;
  preferences: RoutingPreference[];
  onTogglePreference: (id: string, value: boolean) => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ 
  isVisible, 
  onClose, 
  toLogin,
  preferences,
  onTogglePreference
}) => {
  const colorScheme = useColorScheme() ?? 'light';
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Handle animations when visibility changes
  useEffect(() => {
    if (isVisible) {
      // Open the menu
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          speed: 15,
          bounciness: 0,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Close the menu
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -MENU_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, fadeAnim]);

  // Handle back button press on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isVisible) {
          onClose();
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  // Return null when not visible and animation is complete
  if (!isVisible && slideAnim._value === -MENU_WIDTH) {
    return null;
  }

  const statusBarHeight = Platform.OS === 'ios' ? 
    StatusBar.currentHeight || 44 : 
    StatusBar.currentHeight || 0;

  return (
    <View style={styles.container}>
      {/* Dark overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View 
          style={[
            styles.overlay, 
            { opacity: fadeAnim }
          ]} 
        />
      </TouchableWithoutFeedback>
      
      {/* Menu panel */}
      <Animated.View 
        style={[
          styles.menu, 
          { 
            transform: [{ translateX: slideAnim }],
            backgroundColor: Colors[colorScheme].background,
            paddingTop: statusBarHeight,
          }
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Settings
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <FontAwesome5 name="times" size={22} color={Colors[colorScheme].text} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <ProfileSection toLogin={toLogin} />
          <View style={styles.divider} />
          <RoutingPreferences 
            preferences={preferences}
            onToggle={onTogglePreference}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  menu: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
});

export default SideMenu;