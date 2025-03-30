import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
// @ts-ignore
import GoogleIcon from "@/assets/images/google-logo.svg";
import { FontAwesome5 } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useUser } from "@/providers/UserProvider";
import { updateUserPreferences } from "@/services/useService";
import { User, UserPreferences } from "@/types/api";
import IconButton from "../ui/IconButton";

interface ProfileSectionProps {
  // Add any props if needed
}

const ProfileSection: React.FC<ProfileSectionProps> = () => {
  const { userData, isLoading, isSignedIn, signIn, signOut } = useUser();
  const colorScheme = useColorScheme() ?? "light";

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (isSignedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.profileHeader}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Profile
          </Text>
        </View>
        <View style={styles.userInfoContainer}>
          {userData.photo && (
            <Image
              source={{ uri: userData.photo }}
              style={styles.profileImage}
            />
          )}
          <View style={styles.userTextInfo}>
            <Text
              style={[styles.userName, { color: Colors[colorScheme].text }]}
            >
              {userData.name}
            </Text>
            <Text
              style={[styles.userEmail, { color: Colors[colorScheme].icon }]}
            >
              {userData.email}
            </Text>
          </View>
        </View>
        <IconButton
          text="Sign out"
          icon={<FontAwesome5 name="sign-out-alt" size={16} color="#fff" />}
          onPress={signOut}
          buttonStyle={styles.signOutButton}
          textStyle={styles.buttonText}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
        Profile
      </Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].icon }]}>
        Sign in to save your preferences
      </Text>
      <IconButton
        text="Sign in"
        icon={<FontAwesome5 name="sign-in-alt" size={16} color="#fff" />}
        onPress={() => {}}
        buttonStyle={styles.signInButton}
        textStyle={styles.buttonText}
      />
      <IconButton
        text="Sign in"
        icon={<GoogleIcon width={20} height={20} />}
        onPress={signIn}
        buttonStyle={styles.signInButtonGoogle}
        textStyle={styles.buttonTextGoogle}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 16,
  },
  profileHeader: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userTextInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  signInButton: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  signInButtonGoogle: {
    marginTop: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonText: {
    color: "#fff",
  },
  buttonTextGoogle: {
    color: "#000",
  },
  signOutButton: {
    backgroundColor: "#EA4335",
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
});

export default ProfileSection;
