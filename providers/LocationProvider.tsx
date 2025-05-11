/**
 * LocationProvider handles location permissions and provides a search session token for Mapbox.
 * Displays a fallback screen prompting the user to allow location access if not granted.
 */

import React, { createContext, useEffect, useState, useContext } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { SessionToken, SessionTokenLike } from "@mapbox/search-js-core";

/**
 * Context shape exposed to consumers.
 */
interface LocationContextType {
  hasForegroundPermission: boolean;
  hasBackgroundPermission: boolean;
  requestForegroundPermission: () => Promise<void>;
  requestBackgroundPermission: () => Promise<void>;
  searchSession: SessionTokenLike;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

/**
 * LocationProvider wraps the app with permission checks.
 * If permissions are not granted, a fallback UI is shown.
 */
export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [hasForegroundPermission, setHasForegroundPermission] =
    useState<boolean>(false);
  const [hasBackgroundPermission, setHasBackgroundPermission] =
    useState<boolean>(false);

  const searchSession = new SessionToken();

  useEffect(() => {
    checkPermissions();
  }, []);

  /**
   * Checks the current foreground and background location permissions.
   */
  const checkPermissions = async () => {
    const { status: foregroundStatus } =
      await Location.getForegroundPermissionsAsync();
    setHasForegroundPermission(foregroundStatus === "granted");

    const { status: backgroundStatus } =
      await Location.getBackgroundPermissionsAsync();
    setHasBackgroundPermission(backgroundStatus === "granted");
  };

  /**
   * Requests foreground location access.
   */
  const requestForegroundPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasForegroundPermission(status === "granted");
  };

  /**
   * Requests background location access.
   */
  const requestBackgroundPermission = async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    setHasBackgroundPermission(status === "granted");
  };

  return (
    <LocationContext.Provider
      value={{
        hasForegroundPermission,
        hasBackgroundPermission,
        requestForegroundPermission,
        requestBackgroundPermission,
        searchSession,
      }}
    >
      {!hasForegroundPermission || !hasBackgroundPermission ? (
        <LocationPermissionScreen />
      ) : (
        children
      )}
    </LocationContext.Provider>
  );
};

/**
 * Custom hook to consume LocationContext.
 * Throws if used outside of provider.
 */
export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};

/**
 * Fallback UI shown when location permissions are not yet granted.
 */
const LocationPermissionScreen = () => {
  const {
    hasForegroundPermission,
    requestForegroundPermission,
    hasBackgroundPermission,
    requestBackgroundPermission,
  } = useLocation();

  useEffect(() => {
    requestForegroundPermission();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nous avons besoin de votre localisation</Text>
      <Text style={styles.description}>
        Cette application nécessite l'accès à votre localisation pour fournir la
        navigation et le suivi en temps réel. Veuillez accorder la permission
        pour continuer.
      </Text>

      <Button
        title="Autoriser l'accès à la localisation"
        onPress={requestForegroundPermission}
        disabled={hasForegroundPermission}
      />
      <Button
        title="Autoriser l'accès à la localisation en arrière-plan"
        onPress={requestBackgroundPermission}
        disabled={!hasForegroundPermission}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#666",
  },
  success: {
    fontSize: 18,
    color: "green",
    marginTop: 15,
  },
});
