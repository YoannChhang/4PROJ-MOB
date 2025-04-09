import React, { useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import StyledTextInput from "@/components/ui/StyledTextInput";
import IconButton from "@/components/ui/IconButton";
import { FontAwesome5 } from "@expo/vector-icons";
import GoogleLoginButton from "@/components/googleAuth/GoogleLoginButton";
import { useUser } from "@/providers/UserProvider";

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
interface RegisterFormProps {
  toLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ toLogin }) => {
  const [registrationError, setError] = useState("");

  const { register } = useUser();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    console.log("Registering with:", data);

    const { name, email, password } = data;

    const onSuccess = () => {
      console.log("Success");
      toLogin();
      setError("");
    };

    const onFail = (msg: string) => {
      setError(msg);
    };

    register(name, email, password, onSuccess, onFail);
  };

  const password = watch("password");

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="name"
        rules={{ required: "Full name is required" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Full name"
            keyboardType="default"
            autoCapitalize="none"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputStyle={styles.inputText}
          />
        )}
      />
      {errors.name && <ErrorText message={errors.name.message} />}

      <Controller
        control={control}
        name="email"
        rules={{
          required: "Email is required",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "Must be a valid email",
          },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Email"
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
        rules={{ required: "Password is required" }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Password"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputStyle={styles.inputText}
          />
        )}
      />
      {errors.password && <ErrorText message={errors.password.message} />}

      <Controller
        control={control}
        name="confirmPassword"
        rules={{
          required: "Please confirm your password",
          validate: (value) => value === password || "Passwords do not match",
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <StyledTextInput
            placeholder="Confirm Password"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            inputStyle={styles.inputText}
          />
        )}
      />
      {errors.confirmPassword && (
        <ErrorText message={errors.confirmPassword.message} />
      )}

      {registrationError && <ErrorText message={registrationError} />}

      <IconButton
        icon={<FontAwesome5 name="user-plus" size={16} color="#fff" />}
        text="Register"
        onPress={handleSubmit(onSubmit)}
        buttonStyle={styles.registerButton}
        textStyle={{ color: "#fff" }}
      />

      <IconButton
        text="Already have an account? Log in"
        onPress={toLogin}
        buttonStyle={styles.loginRedirectButton}
        textStyle={{ color: "#000" }}
      />

      <GoogleLoginButton
        text="Sign up with Google"
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
  registerButton: {
    backgroundColor: "#34A853",
    marginTop: 8,
  },
  loginRedirectButton: {
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

export default RegisterForm;
