import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Config from "react-native-config";

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: Config.ANDROID_GOOGLE_CLIENT_ID,
    iosClientId: Config.IOS_GOOGLE_CLIENT_ID,
    scopes: ["profile", "email"],
  });
};
