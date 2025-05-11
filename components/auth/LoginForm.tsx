import React, { useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import StyledTextInput from "@/components/ui/StyledTextInput";
import IconButton from "@/components/ui/IconButton";
import { FontAwesome5 } from "@expo/vector-icons";
import GoogleLoginButton from "@/components/googleAuth/GoogleLoginButton";
import { useUser } from "@/providers/UserProvider";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginFormProps {
  toRegister: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ toRegister }) => {
  const [loginError, setError] = useState("");

  const { signIn } = useUser();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormData) => {
    const { email, password } = data;

    const onFail = (msg: string) => {
      setError(msg);
    };

    signIn(false, onFail, email, password);
  };

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="email"
        rules={{
          required: "L'email est requis",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "Doit être un email valide",
          },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Adresse e-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputStyle={styles.inputText}
          />
        )}
      />
      {errors.email && <ErrorText message={errors.email.message} />}

      <Controller
        control={control}
        name="password"
        rules={{ required: "Le mot de passe est requis" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Mot de passe"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputStyle={styles.inputText}
          />
        )}
      />
      {errors.password && <ErrorText message={errors.password.message} />}
      {loginError && <ErrorText message={loginError} />}

      <IconButton
        icon={<FontAwesome5 name="sign-in-alt" size={16} color="#fff" />}
        text="Se connecter"
        onPress={handleSubmit(onSubmit)}
        buttonStyle={styles.loginButton}
        textStyle={{ color: "#fff" }}
      />
      <IconButton
        text="Pas de compte ? S'inscrire"
        onPress={toRegister}
        buttonStyle={styles.registerButton}
        textStyle={{ color: "#000" }}
      />

      <GoogleLoginButton
        text="Se connecter avec Google"
        buttonStyle={{ marginTop: 8 }}
      />
    </View>
  );
};

const ErrorText = ({ message }: { message?: string }) => (
  <View style={{ marginTop: 4, marginBottom: 8 }}>
    <Text style={{ color: "#E53935", fontSize: 14 }}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  inputText: {
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: "#4285F4",
    marginTop: 8,
  },
  registerButton: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#ddd",
  },
});

export default LoginForm;
