import React, { createContext, useEffect, useState, useContext } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { SessionToken, SessionTokenLike } from "@mapbox/search-js-core";

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

  // useEffect(() => {
  //   console.log("Foreground Permission: ", hasForegroundPermission);
  // }, [hasForegroundPermission]);

  // useEffect(() => {
  //   console.log("Background Permission: ", hasBackgroundPermission);
  // }, [hasBackgroundPermission]);

  const checkPermissions = async () => {
    const { status: foregroundStatus } =
      await Location.getForegroundPermissionsAsync();
    setHasForegroundPermission(foregroundStatus === "granted");

    const { status: backgroundStatus } =
      await Location.getBackgroundPermissionsAsync();
    setHasBackgroundPermission(backgroundStatus === "granted");
  };

  const requestForegroundPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasForegroundPermission(status === "granted");
  };

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

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};

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
      <Text style={styles.title}>We Need Your Location</Text>
      <Text style={styles.description}>
        This app requires access to your location to provide navigation and
        real-time tracking. Please grant permission to continue.
      </Text>

      <Button
        title="Grant Location Access"
        onPress={requestForegroundPermission}
        disabled={hasForegroundPermission}
      />
      <Button
        title="Grant Background Location Access"
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
