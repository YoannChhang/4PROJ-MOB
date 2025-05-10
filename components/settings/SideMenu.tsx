import React, { useRef, useEffect } from "react";
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
  SafeAreaView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import ProfileSection from "./ProfileSection";
import RoutingPreferences, { RoutingPreference } from "./RoutingPreferences";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

const { width, height } = Dimensions.get("window");
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
  onTogglePreference,
}) => {
  const colorScheme = useColorScheme() ?? "light";
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
          toValue: 0.5, // Overlay opacity
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
      "hardwareBackPress",
      () => {
        if (isVisible) {
          onClose();
          return true; // Prevent default back behavior
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  // Determine status bar height for padding
  const statusBarHeight =
    Platform.OS === "ios"
      ? StatusBar.currentHeight || (height > 800 ? 44 : 20) // Approximation for notched iOS
      : StatusBar.currentHeight || 0;

  return (
    <View
      style={styles.container}
      // pointerEvents is crucial to prevent taps passing through or
      // re-triggering close during animation.
      pointerEvents={isVisible ? "auto" : "none"}
    >
      {/* Dark overlay - only touchable when menu is visible */}
      <TouchableWithoutFeedback
        onPress={isVisible ? onClose : undefined}
        disabled={!isVisible}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Menu panel */}
      <Animated.View
        style={[
          styles.menu,
          {
            transform: [{ translateX: slideAnim }],
            backgroundColor: Colors[colorScheme].background,
            paddingTop: statusBarHeight,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Settings
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <FontAwesome5
              name="times"
              size={22}
              color={Colors[colorScheme].text}
            />
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
    ...StyleSheet.absoluteFillObject, // Fill the entire screen
    zIndex: 1000, // Ensure it's on top
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black", // Dark overlay color
  },
  menu: {
    position: "absolute",
    top: 0,
    left: 0,
    width: MENU_WIDTH,
    height: "100%", // Full height
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10, // Android shadow
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0", // Light divider
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 8, // Make tap area larger
  },
  content: {
    flex: 1, // Ensure ScrollView takes available space
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 16, // Indent divider slightly
  },
});

export default SideMenu;
