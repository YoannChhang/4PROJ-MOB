import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme";

interface IncidentReportButtonProps {
  onPress: () => void;
  isSignedIn: boolean;
  onLoginRequired: () => void;
}

const IncidentReportButton: React.FC<IncidentReportButtonProps> = ({
  onPress,
  isSignedIn,
  onLoginRequired,
}) => {
  const colorScheme = useColorScheme() ?? "light";

  // Handle button press based on login status
  const handlePress = () => {
    if (isSignedIn) {
      onPress(); // Open report modal for logged in users
    } else {
      onLoginRequired(); // Show login prompt for not logged in users
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <FontAwesome5 name="plus" size={24} color="#fff" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    right: 70, // Position it to the left of the QR code button
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default IncidentReportButton;
