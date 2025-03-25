import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useUser } from '@/providers/UserProvider';
import { updateUserPreferences } from '@/services/useService';
import { User, UserPreferences } from '@/types/api';

interface ProfileSectionProps {
  // Add any props if needed
}

const ProfileSection: React.FC<ProfileSectionProps> = () => {
  const { userData, isLoading, isSignedIn, signIn, signOut } = useUser();
  const colorScheme = useColorScheme() ?? 'light';

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (isSignedIn && userData) {
    return (
      <View style={styles.container}>
        <View style={styles.profileHeader}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Profile</Text>
        </View>
        <View style={styles.userInfoContainer}>
          {userData.photo && (
            <Image
              source={{ uri: userData.photo }}
              style={styles.profileImage}
            />
          )}
          <View style={styles.userTextInfo}>
            <Text style={[styles.userName, { color: Colors[colorScheme].text }]}>
              {userData.name}
            </Text>
            <Text style={[styles.userEmail, { color: Colors[colorScheme].icon }]}>
              {userData.email}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.button, styles.signOutButton]}
          onPress={signOut}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
          <FontAwesome5 name="sign-out-alt" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>Profile</Text>
      <Text style={[styles.subtitle, { color: Colors[colorScheme].icon }]}>
        Sign in to save your preferences
      </Text>
      <TouchableOpacity
        style={[styles.button, styles.signInButton]}
        onPress={signIn}
      >
        <FontAwesome5 name="google" size={16} color="#fff" style={styles.buttonIcon} />
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </TouchableOpacity>
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
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  signInButton: {
    backgroundColor: '#4285F4',
  },
  signOutButton: {
    backgroundColor: '#EA4335',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default ProfileSection;
