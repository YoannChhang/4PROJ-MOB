import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import {
  GoogleSignin,
  type User as GoogleUser,
} from "@react-native-google-signin/google-signin";
import { configureGoogleSignIn } from "@/components/googleAuth/configureGoogle";
import {
  googleAndroid,
  googleIOS,
  loginWithEmail,
  registerUser,
  setAuthToken,
  getCurrentUser,
  updateUser,
} from "@/services/useService";
import { ApiResponse, User, UserPreferences } from "@/types/api";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

// Define context interface
interface UserContextType {
  userData: User;
  setUserData: React.Dispatch<React.SetStateAction<User>>;
  bearerToken: string | undefined;
  isLoading: boolean;
  isSignedIn: boolean;
  register: (
    name: string,
    email: string,
    password: string,
    onSuccess: () => void,
    onFail: (msg: string) => void
  ) => Promise<void>;
  signIn: (
    isGoogle: boolean,
    onFail: (msg: string) => void,
    email?: string,
    password?: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
}

// Create the context with a default value
const UserContext = createContext<UserContextType>({
  userData: {
    preferences: {
      avoid_tolls: false,
      avoid_highways: false,
      avoid_unpaved: false,
    },
  } as User,
  setUserData: () => {},
  bearerToken: undefined,
  isLoading: false,
  isSignedIn: false,
  register: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  updatePreferences: async () => {},
});

// Create a hook to use the user context
export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userData, setUserData] = useState<User>({
    preferences: {
      avoid_tolls: false,
      avoid_highways: false,
      avoid_unpaved: false,
    },
  } as User);
  const [bearerToken, setBearerToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const router = useRouter();

  const isSignedIn = useMemo(() => !!bearerToken, [bearerToken]);

  useEffect(() => {
    // Configure Google Sign-In and check if user is already signed in
    const initializeAuth = async () => {
      try {
        configureGoogleSignIn();
        const currentUser = await GoogleSignin.getCurrentUser();

        if (currentUser) {
          const { idToken, user } = currentUser as GoogleUser;

          // Get the bearer token
          if (idToken) {
            try {
              // Choose the appropriate Google auth method based on platform
              const googleAuthMethod =
                Platform.OS === "ios" ? googleIOS : googleAndroid;

              googleAuthMethod(idToken)
                .then((res) => {
                  // Extract token from response
                  const token = res.data.access_token || undefined;
                  setBearerToken(token);

                  // Set the token for all future API requests
                  setAuthToken(token);

                  // Fetch complete user profile from backend
                  getCurrentUser()
                    .then((userResponse) => {
                      // user is Google data and userResponse.data is BE data
                      if (userResponse.data && user) {
                        // setUserData(userResponse.data);

                        console.log(userResponse.data.preferences);
                        setUserData({
                          email: user.email,
                          name: `${user.familyName} ${user.givenName}`,
                          photo: user.photo,
                          id: user.id,
                          preferences: userResponse.data.preferences,
                        });
                      }
                    })
                    .catch((err) => {
                      console.error("Error fetching user data:", err);
                    });
                })
                .catch((error) => {
                  console.error("Authentication error:", error);
                });
            } catch (error) {
              console.error("Error retrieving tokens:", error);
            }
          }
        }
      } catch (error) {
        console.error("Error during auth initialization:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const register = async (
    name: string,
    email: string,
    password: string,
    onSuccess: () => void,
    onFail: (msg: string) => void
  ) => {
    if (isSignedIn) return;

    registerUser({
      name,
      email,
      password,
    })
      .then((res) => {
        if (res.data.ok) onSuccess();
        else onFail("Failed to register account");
      })
      .catch((error) => {
        onFail("Registration error:" + error);
        console.error("Registration error:", error);
      });
  };

  const afterSignIn = (res: ApiResponse<any>) => {
    // Extract token from response
    const token = res.data?.access_token || "";
    console.log("Sign in successful, setting bearer token");

    // Set the token for all future API requests
    setAuthToken(token);

    // Update the state - this will trigger the isSignedIn effect in useAlertPins
    setBearerToken(token);

    // Fetch complete user profile from backend
    getCurrentUser()
      .then((userResponse) => {
        if (userResponse.data) {
          setUserData(userResponse.data);
        }
      })
      .catch((err) => {
        console.error("Error fetching user data:", err);
      });

    router.dismissTo("/");
  };

  const signIn = async (
    isGoogle: boolean,
    onFail: (msg: string) => void,
    email?: string,
    password?: string
  ) => {
    if (isSignedIn) return;

    setIsLoading(true);

    if (!isGoogle) {
      try {
        if (!email || !password) return;

        loginWithEmail(email, password)
          .then(afterSignIn)
          .catch((error) => {
            onFail("Authentication error:" + error);
            console.error("Authentication error:", error);
          });
      } catch (error) {
        onFail("Error signing in:" + error);
        console.error("Error signing in:", error);
      } finally {
        setIsLoading(false);
      }

      return;
    }

    try {
      await GoogleSignin.hasPlayServices();
      // Use any to avoid type issues with GoogleSignin's changing API
      const { data: signedUser } = await GoogleSignin.signIn();

      if (signedUser) {
        const { idToken } = signedUser as GoogleUser;

        // Get the bearer token
        if (idToken) {
          try {
            // Choose the appropriate Google auth method based on platform
            const googleAuthMethod =
              Platform.OS === "ios" ? googleIOS : googleAndroid;

            googleAuthMethod(idToken)
              .then(afterSignIn)
              .catch((error) => {
                onFail("Authentication error:" + error);
                console.error("Authentication error:", error);
              });
          } catch (error) {
            onFail("Error retrieving tokens:" + error);
            console.error("Error retrieving tokens:", error);
          }
        }
      }
    } catch (error) {
      onFail("Error signing in:" + error);
      console.error("Error signing in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    if (!isSignedIn) return;

    try {
      setIsLoading(true);
      console.log("Signing out, clearing auth token");
      await GoogleSignin.signOut();

      // Update user data and clear token - this will trigger the isSignedIn effect in useAlertPins
      setUserData({
        preferences: {
          avoid_tolls: false,
          avoid_highways: false,
          avoid_unpaved: false,
        },
      } as User);

      // Clear the auth token from API headers
      setAuthToken(undefined);

      // Update state after token is cleared from API headers
      setBearerToken(undefined);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new function to update user preferences
  const updatePreferences = useCallback(
    async (preferences: UserPreferences) => {
      if (!isSignedIn) return;

      try {
        setIsLoading(true);
        console.log("Updating user preferences:", preferences);

        const response = await updateUser({ preferences });

        if (response.data) {
          // Update the local user data state with the updated preferences
          setUserData((prevData) => ({
            ...prevData,
            preferences: response.data.preferences || preferences,
          }));
          console.log("User preferences updated successfully");
        }
      } catch (error) {
        console.error("Error updating user preferences:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [isSignedIn]
  );

  const value = {
    userData,
    setUserData,
    bearerToken,
    isLoading,
    isSignedIn,
    register,
    signIn,
    signOut,
    updatePreferences,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
