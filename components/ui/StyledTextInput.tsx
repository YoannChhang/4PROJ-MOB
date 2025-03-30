import React from "react";
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";

interface StyledTextInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

const StyledTextInput: React.FC<StyledTextInputProps> = ({
  containerStyle,
  inputStyle,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={[styles.input, inputStyle]}
        placeholderTextColor="#999"
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  input: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
});

export default StyledTextInput;
