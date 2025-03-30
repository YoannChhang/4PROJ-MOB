import React from "react";
import { Text, TouchableOpacity, ViewStyle, TextStyle, StyleSheet, View } from "react-native";

interface IconButtonProps {
  icon: React.ReactNode;
  text: string;
  onPress: () => void;
  buttonStyle?: ViewStyle;
  textStyle?: TextStyle;
  iconContainerStyle?: ViewStyle;
}

const IconButton: React.FC<IconButtonProps> = ({
  icon,
  text,
  onPress,
  buttonStyle,
  textStyle,
  iconContainerStyle,
}) => {
  return (
    <TouchableOpacity style={[styles.button, buttonStyle]} onPress={onPress}>
      <View style={[styles.iconContainer, iconContainerStyle]}>{icon}</View>
      <Text style={[styles.buttonText, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
  },
  iconContainer: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default IconButton;
