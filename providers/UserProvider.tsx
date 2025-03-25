import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useMemo,
} from "react";
import {
  GoogleSignin,
  type User as GoogleUser,
} from "@react-native-google-signin/google-signin";
import { configureGoogleSignIn } from "@/components/googleAuth/configureGoogle";
import {
  googleAndroid,
  googleIOS,
  setAuthToken,
  getCurrentUser,
} from "@/services/useService";
import { User } from "@/types/api";
import { Platform } from "react-native";

// Define context interface
interface UserContextType {
  userData: User | null;
  bearerToken: string | undefined;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Create the context with a default value
const UserContext = createContext<UserContextType>({
  userData: null,
  bearerToken: undefined,
  isLoading: false,
  isSignedIn: false,
  signIn: async () => {},
  signOut: async () => {},
});

// Create a hook to use the user context
export const useUser = () => useContext(UserContext);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [userData, setUserData] = useState<User | null>(null);
  const [bearerToken, setBearerToken] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isSignedIn = useMemo(() => !!bearerToken, [bearerToken]);

  useEffect(() => {
    console.log(bearerToken);
  }, [bearerToken]);

  useEffect(() => {
    // Configure Google Sign-In and check if user is already signed in
    const initializeAuth = async () => {
      try {
        configureGoogleSignIn();
        const currentUser = await GoogleSignin.getCurrentUser();

        if (currentUser) {
          const { idToken, user } = currentUser as GoogleUser;

          if (user) {
            setUserData({
              email: user.email,
              name: `${user.familyName} ${user.givenName}`,
              photo: user.photo,
              id: user.id,
            });
          }

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
                      if (userResponse.data) {
                        setUserData(userResponse.data);
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

  const signIn = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices();
      // Use any to avoid type issues with GoogleSignin's changing API
      const { data: signedUser } = await GoogleSignin.signIn();

      if (signedUser) {
        const { idToken, user } = signedUser as GoogleUser;

        if (user) {
          setUserData({
            email: user.email,
            name: `${user.familyName} ${user.givenName}`,
            photo: user.photo,
            id: user.id,
          });
        }

        // Get the bearer token
        if (idToken) {
          try {
            // Choose the appropriate Google auth method based on platform
            const googleAuthMethod =
              Platform.OS === "ios" ? googleIOS : googleAndroid;

            googleAuthMethod(idToken)
              .then((res) => {
                // Extract token from response
                const token = res.data?.access_token || "";
                setBearerToken(token);

                // Set the token for all future API requests
                setAuthToken(token);

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
      console.error("Error signing in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.signOut();
      setUserData(null);
      setBearerToken(undefined);
      // Clear the auth token from API headers
      setAuthToken(undefined);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    userData,
    bearerToken,
    isLoading,
    isSignedIn,
    signIn,
    signOut,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
