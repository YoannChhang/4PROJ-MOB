import React from "react";
import IconButton from "../ui/IconButton";
import { useUser } from "@/providers/UserProvider";
// @ts-ignore
import GoogleIcon from "@/assets/images/google-logo.svg";
import { StyleSheet, ViewStyle } from "react-native";

interface GoogleLoginButtonProps {
  text: string;
  buttonStyle?: ViewStyle;
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  text,
  buttonStyle,
}) => {
  const { signIn } = useUser();

  return (
    <IconButton
      text={text}
      icon={<GoogleIcon width={20} height={20} />}
      onPress={() => signIn(true, (msg: string) => {})}
      buttonStyle={{ ...styles.signInButtonGoogle, ...buttonStyle }}
      textStyle={styles.buttonTextGoogle}
    />
  );
};

export default GoogleLoginButton;

const styles = StyleSheet.create({
  signInButtonGoogle: {
    marginTop: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonTextGoogle: {
    color: "#000",
  },
});
