import React from "react";
import {
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleSheet,
  View,
} from "react-native";

interface IconButtonProps {
  icon?: React.ReactNode;
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
      {icon ? (
        <View style={[styles.iconContainer, iconContainerStyle]}>{icon}</View>
      ) : null}
      <Text style={[styles.buttonText, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
