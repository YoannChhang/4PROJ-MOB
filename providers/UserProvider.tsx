/**
 * UserProvider manages authentication state, user profile data, and preferences.
 * It supports both Google Sign-In and email/password login flows.
 * It also handles bearer token setup for secure API communication.
 */

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

/**
 * UserContextType defines the shape of the authentication context.
 */
interf
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

// Create context with default values (mocked empty implementation)
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

/**
 * Custom hook to consume the UserContext.
 */
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

  /**
   * Configures Google Sign-In and checks if the user is already signed in.
   * If signed in, fetches user data and sets it in the context.
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        configureGoogleSignIn();
        const currentUser = await GoogleSignin.getCurrentUser();

        if (currentUser) {
          const { idToken, user } = currentUser as GoogleUser;

          if (idToken) {
            try {
              const googleAuthMethod =
                Platform.OS === "ios" ? googleIOS : googleAndroid;

              googleAuthMethod(idToken)
                .then((res) => {
                  const token = res.data.access_token || undefined;
                  setBearerToken(token);

                  setAuthToken(token);

                  getCurrentUser()
                    .then((userResponse) => {
                      if (userResponse.data && user) {
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

  /**
   * Registers a new user with the provided credentials.
   * @param name - User's name
   * @param email - User's email
   * @param password - User's password
   * @param onSuccess - Callback function to call on successful registration
   * @param onFail - Callback function to call on failed registration
   */
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

  /**
   * Finalizes the login process once bearer token is acquired.
   */
  const afterSignIn = (res: ApiResponse<any>) => {
    const token = res.data?.access_token || "";

    setAuthToken(token);

    setBearerToken(token);

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

  /**
   * Signs in either with Google or with email/password.
   */
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
      const { data: signedUser } = await GoogleSignin.signIn();

      if (signedUser) {
        const { idToken } = signedUser as GoogleUser;

        if (idToken) {
          try {
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

  /**
   * Signs out the user, clears token and resets user state.
   */
  const signOut = async () => {
    if (!isSignedIn) return;

    try {
      setIsLoading(true);
      await GoogleSignin.signOut();
      setUserData({
        preferences: {
          avoid_tolls: false,
          avoid_highways: false,
          avoid_unpaved: false,
        },
      } as User);

      setAuthToken(undefined);

      setBearerToken(undefined);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Updates user preferences on the backend and reflects changes locally.
   */
  const updatePreferences = useCallback(
    async (preferences: UserPreferences) => {
      if (!isSignedIn) return;

      try {
        setIsLoading(true);

        const response = await updateUser({ preferences });

        if (response.data) {
          setUserData((prevData) => ({
            ...prevData,
            preferences: response.data.preferences || preferences,
          }));
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
