import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GoogleSignin,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";
import { googleAndroid } from "@/services/useService";


export const SignIn = () => {
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  const [email, setEmail] = useState<string>("huguesstock+test@gmail.com");
  const [password, setPassword] = useState<string>("Soleil123");

  const [errorForm, setErrorForm] = useState<string>("");

  useEffect(() => {
    if (Platform.OS === "ios") {
      GoogleSignin.configure({
        iosClientId:
          process.env.EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID,
        // iosClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID_IOS
      });
    } else {
      GoogleSignin.configure({
        webClientId:
        process.env.EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID,
        // webClientId: process.env.REACT_APP_GOOGLE_CLIENT_ID_WEB
      });
    }
  }, []);

//   const handleSubmit = () => {
//     const validateForm = validateLoginForm({ email, password });
//     if (typeof validateForm === "object" && validateForm.error) {
//       setErrorForm(validateForm.error);
//     } else {
//       login(email, password).then((res: any) => {
//         if (res.data) {
//           //   dispatch(authActions.login({ token: res.data.access_token }));
//           console.log(res.data);
//         }
//         if (res.error) {
//           setErrorForm(res.error.toString());
//         }
//       });
//     }
//   };

  const signIn = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      if (userInfo.data && userInfo.data?.idToken) {
        googleAndroid(userInfo.data?.idToken)
          .then((res: any) => {
            console.log(res);
          })
          .finally(() => {
            setGoogleLoading(false);
          });
      }
    } catch (error) {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* <View style={styles.containerForm}>
        <TextInput
          style={styles.textInput}
          onChangeText={setEmail}
          defaultValue={email}
          placeholder="Email"
        />
        <TextInput
          style={styles.textInput}
          onChangeText={setPassword}
          defaultValue={password}
          placeholder="Password"
          secureTextEntry
        />
      </View> */}
      <View>
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Icon}
          color={GoogleSigninButton.Color.Dark}
          onPress={signIn}
          disabled={googleLoading}
        />
      </View>
      {/* {errorForm ? <Text style={styles.errorText}>{errorForm}</Text> : null} */}

      {googleLoading && (
        <ActivityIndicator />
        //   ) : (
        //     <View style={styles.buttonContainer}>
        //       <View style={styles.buttonConnexion}>
        //         <TouchableOpacity onPress={handleSubmit}>
        //           <Text style={styles.buttonText}>Connexion</Text>
        //         </TouchableOpacity>
        //       </View>
        //       <View style={styles.footer}>
        //         <TouchableOpacity onPress={() => console.log("debug")}>
        //           <Text style={styles.footerText}>Mot de passe oublié ? (WIP)</Text>
        //         </TouchableOpacity>
        //         <TouchableOpacity onPress={toRegister}>
        //           <Text style={styles.footerText}>S'inscrire</Text>
        //         </TouchableOpacity>
        //       </View>
        //     </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 20,
    gap: 40,
    alignItems: "center",
  },
  containerForm: {
    width: "80%",
    gap: 15,
  },
  textInput: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  errorText: {
    color: "#FF7F50",
  },
  buttonContainer: {
    width: "95%",
    marginLeft: "2.5%",
  },
  buttonConnexion: {
    backgroundColor: "#292A22",
    width: "60%",
    marginLeft: "20%",
  },
  buttonText: {
    fontSize: 18,
    paddingVertical: 12,
    color: "#fafafa",
    textAlign: "center",
  },
  footer: {
    marginTop: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "95%",
  },
  footerText: {
    color: "#757575",
    fontSize: 16,
  },
});
