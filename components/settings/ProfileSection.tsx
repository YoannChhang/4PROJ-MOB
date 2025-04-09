import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useUser } from "@/providers/UserProvider";
import IconButton from "../ui/IconButton";
import GoogleLoginButton from "@/components/googleAuth/GoogleLoginButton";

interface ProfileSectionProps {
  toLogin: () => void;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ toLogin }) => {
  const { userData, isLoading, isSignedIn, signOut } = useUser();
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
        onPress={toLogin}
        buttonStyle={styles.signInButton}
        textStyle={styles.buttonText}
      />

      <GoogleLoginButton text="Sign in with Google" />
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
    elevation: 2,
  },
  buttonText: {
    color: "#fff",
  },
  signOutButton: {
    backgroundColor: "#EA4335",
    elevation: 2,
  },
});

export default ProfileSection;
