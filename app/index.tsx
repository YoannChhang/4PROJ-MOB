// app/index.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
} from "react";
import {
  StyleSheet,
  View,
  ActivityIndicator, // Keep for the very initial "services loading"
  Text, // Keep for the very initial "services loading"
  Alert,
  // Platform, // No longer directly needed here for attribution
} from "react-native";
import Mapbox, { MapView } from "@rnmapbox/maps"; // Only MapView might be needed for ref type
import { useRouter } from "expo-router"; // usePathname not used, removed
import { useQRCode } from "@/providers/QRCodeProvider";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";
import useRoute from "@/hooks/routing/useRoute";
import locationTracker from "@/utils/locationTracker";
import ttsManager from "@/utils/ttsManager";
import { getExcludesFromPreferences } from "@/utils/routeUtils";

import SearchAndRouteControl from "@/components/mapbox/searchAndNav/SearchAndRouteControl";
import NavigationInterface from "@/components/mapbox/searchAndNav/NavigationInterface";
import useAlertPins from "@/hooks/useAlertPins";

import { Route } from "@/types/mapbox";
import { PinRead, UserPreferences } from "@/types/api";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";

// New Component Imports
import MapDisplay from "@/components/mapbox/display/MapDisplay";
import MapControlsOverlay from "@/components/mapbox/display/MapControlsOverlay";
import MapModals from "@/components/mapbox/display/MapModals";
import MapFeedbackIndicators from "@/components/mapbox/display/MapFeedbackIndicators";

Mapbox.setAccessToken(Config.MAPBOX_PK as string);

type AppState = {
  uiMode: "map" | "search" | "route-selection" | "navigation";
  destination: [number, number] | null;
  isSideMenuOpen: boolean;
  selectedPin: PinRead | null;
  isInitializing: boolean;
  isInitialRouteCalculated: boolean;
};

type AppAction =
  | { type: "INITIALIZE_COMPLETE" }
  | { type: "SHOW_SEARCH" }
  | { type: "HIDE_SEARCH" }
  | { type: "SET_DESTINATION"; payload: [number, number] | null }
  | { type: "START_NAVIGATION_UI" }
  | { type: "STOP_NAVIGATION_UI" }
  | { type: "OPEN_SIDE_MENU" }
  | { type: "CLOSE_SIDE_MENU" }
  | { type: "SELECT_PIN"; payload: PinRead | null }
  | { type: "SET_INITIAL_ROUTE_CALCULATED"; payload: boolean };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "INITIALIZE_COMPLETE":
      return { ...state, isInitializing: false };
    case "SHOW_SEARCH":
      return {
        ...state,
        uiMode: "search",
        isInitialRouteCalculated: false,
        isSideMenuOpen: false,
      };
    case "HIDE_SEARCH":
      return {
        ...state,
        uiMode: "map",
        destination: null, // Also clear destination when hiding search fully
        isInitialRouteCalculated: false,
      };
    case "SET_DESTINATION":
      return {
        ...state,
        destination: action.payload,
        uiMode: action.payload ? "route-selection" : "search",
        isInitialRouteCalculated: false,
      };
    case "START_NAVIGATION_UI":
      return { ...state, uiMode: "navigation", isSideMenuOpen: false };
    case "STOP_NAVIGATION_UI":
      return {
        ...state,
        uiMode: "map",
        destination: null,
        isInitialRouteCalculated: false,
      };
    case "OPEN_SIDE_MENU":
      return { ...state, isSideMenuOpen: true, uiMode: "map" }; // Ensure uiMode is map when menu opens
    case "CLOSE_SIDE_MENU":
      return { ...state, isSideMenuOpen: false };
    case "SELECT_PIN":
      return { ...state, selectedPin: action.payload };
    case "SET_INITIAL_ROUTE_CALCULATED":
      return { ...state, isInitialRouteCalculated: action.payload };
    default:
      return state;
  }
};

const initialAppState: AppState = {
  uiMode: "map",
  destination: null,
  isSideMenuOpen: false,
  selectedPin: null,
  isInitializing: true,
  isInitialRouteCalculated: false,
};

interface CameraConfig {
  centerCoordinate?: [number, number];
  zoomLevel: number;
  animationMode: "flyTo" | "easeTo" | "linearTo" | "moveTo" | undefined;
  animationDuration: number;
  pitch?: number;
  heading?: number;
  isManuallyControlled?: boolean;
}

const Map = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { isSignedIn, userData, updatePreferences } = useUser();
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const { qrData, setQRData } = useQRCode();
  const qrDataProcessed = useRef(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [selectedRouteIdxState, setSelectedRouteIdxState] = useState(0);

  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    zoomLevel: 13,
    animationMode: "flyTo",
    animationDuration: 1200,
    isManuallyControlled: false,
  });

  const [preferences, setPreferences] = useState<RoutingPreference[]>([
    {
      id: "avoid_tolls",
      label: "Avoid Tolls",
      enabled: userData?.preferences?.avoid_tolls || false,
    },
    {
      id: "avoid_highways",
      label: "Avoid Highways",
      enabled: userData?.preferences?.avoid_highways || false,
    },
    {
      id: "avoid_unpaved",
      label: "Avoid Unpaved Roads",
      enabled: userData?.preferences?.avoid_unpaved || false,
    },
  ]);

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: routeHookLoading,
    error: routeHookError,
    isNavigating,
    // liveUserLocation from useRoute might be slightly different from userLocation state here,
    // but for most UI purposes, userLocation state should suffice or pass liveUserLocation if critical.
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation,
    stopNavigation,
    chooseRoute,
    setRouteExcludes,
    routeFeatures,
    calculateRoutes,
    recalculateRoute,
    isRerouting,
  } = useRoute(userLocation, state.destination);

  useEffect(() => {
    if (userData?.preferences) {
      const newPrefs = [
        {
          id: "avoid_tolls",
          label: "Avoid Tolls",
          enabled: !!userData.preferences.avoid_tolls,
        },
        {
          id: "avoid_highways",
          label: "Avoid Highways",
          enabled: !!userData.preferences.avoid_highways,
        },
        {
          id: "avoid_unpaved",
          label: "Avoid Unpaved Roads",
          enabled: !!userData.preferences.avoid_unpaved,
        },
      ];
      setPreferences(newPrefs);
      const currentExcludes = getExcludesFromPreferences(userData.preferences);
      setRouteExcludes(
        currentExcludes.length > 0 ? currentExcludes : undefined
      );
    }
  }, [userData?.preferences, setRouteExcludes]);

  useEffect(() => {
    if (
      userLocation &&
      !cameraConfig.centerCoordinate &&
      !cameraConfig.isManuallyControlled &&
      !isNavigating
    ) {
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: userLocation,
        zoomLevel: 15,
      }));
    }
  }, [
    userLocation,
    cameraConfig.centerCoordinate,
    cameraConfig.isManuallyControlled,
    isNavigating,
  ]);

  useEffect(() => {
    const initializeAppServices = async () => {
      try {
        await ttsManager.initialize();
        const trackingStarted = await locationTracker.startTracking();
        if (!trackingStarted)
          Alert.alert("Location Required", "Please enable location access.");
        const onLocationUpdate = (loc: [number, number]) =>
          setUserLocation(loc);
        locationTracker.on("locationUpdate", onLocationUpdate);
        const initialLoc = await locationTracker.getLastKnownLocation();
        if (initialLoc) setUserLocation(initialLoc);
        dispatch({ type: "INITIALIZE_COMPLETE" });
      } catch (error) {
        dispatch({ type: "INITIALIZE_COMPLETE" });
        Alert.alert("Error", "Failed to initialize app services.");
        console.error("Init error:", error);
      }
    };
    initializeAppServices();
    return () => {
      locationTracker.removeAllListeners("locationUpdate");
      locationTracker.cleanup();
      ttsManager.cleanup();
    };
  }, []);

  useEffect(() => {
    if (isNavigating && state.uiMode !== "navigation") {
      dispatch({ type: "START_NAVIGATION_UI" });
    } else if (!isNavigating && state.uiMode === "navigation") {
      dispatch({ type: "STOP_NAVIGATION_UI" });
    }
  }, [isNavigating, state.uiMode]);

  useEffect(() => {
    if (
      !state.isInitializing &&
      !routeHookLoading &&
      (selectedRoute || (alternateRoutes && alternateRoutes.length > 0)) &&
      !state.isInitialRouteCalculated
    ) {
      dispatch({ type: "SET_INITIAL_ROUTE_CALCULATED", payload: true });
    }
  }, [
    state.isInitializing,
    routeHookLoading,
    selectedRoute,
    alternateRoutes,
    state.isInitialRouteCalculated,
  ]);

  useEffect(() => {
    if (qrData && !qrDataProcessed.current && userLocation) {
      qrDataProcessed.current = true;
      dispatch({ type: "SET_INITIAL_ROUTE_CALCULATED", payload: false });
      setSelectedRoute(null);
      setAlternateRoutes([]);
      if (qrData.toCoords) {
        dispatch({ type: "SHOW_SEARCH" });
        dispatch({ type: "SET_DESTINATION", payload: qrData.toCoords });
        const qrExcludes =
          qrData.excludes && qrData.excludes.length > 0
            ? qrData.excludes
            : undefined;
        setRouteExcludes(qrExcludes);
        calculateRoutes(userLocation, qrData.toCoords, qrExcludes);
        setCameraConfig((prev) => ({
          ...prev,
          centerCoordinate: qrData.toCoords,
          zoomLevel: 14,
          isManuallyControlled: true,
        }));
      } else Alert.alert("QR Code Error", "Invalid route data.");
      setTimeout(() => {
        setQRData(null);
        qrDataProcessed.current = false;
        setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
      }, 1500);
    }
  }, [
    qrData,
    userLocation,
    calculateRoutes,
    setQRData,
    setSelectedRoute,
    setAlternateRoutes,
    setRouteExcludes,
  ]);

  const alertPinsLocation = useMemo(
    () =>
      userLocation
        ? { latitude: userLocation[1], longitude: userLocation[0] }
        : null,
    [userLocation]
  );
  const { pins: alertPinsFromHook } = useAlertPins(alertPinsLocation);

  const handleMapPress = useCallback(() => {
    if (state.selectedPin !== null) {
      dispatch({ type: "SELECT_PIN", payload: null });
      return;
    }
    if (cameraConfig.isManuallyControlled && !isNavigating) {
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
    }
  }, [state.selectedPin, cameraConfig.isManuallyControlled, isNavigating]);

  const handleToggleSearchUI = useCallback(() => {
    if (state.uiMode === "map" && !state.isSideMenuOpen) {
      dispatch({ type: "SHOW_SEARCH" });
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: true }));
    } else if (
      state.uiMode === "search" ||
      state.uiMode === "route-selection"
    ) {
      dispatch({ type: "HIDE_SEARCH" });
      setSelectedRoute(null);
      setAlternateRoutes([]);
      setSelectedRouteIdxState(0);
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
    } else if (state.isSideMenuOpen) {
      // If side menu is open and search is pressed
      dispatch({ type: "CLOSE_SIDE_MENU" }); // Close menu
      dispatch({ type: "SHOW_SEARCH" }); // Then show search
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: true }));
    }
  }, [
    state.uiMode,
    state.isSideMenuOpen,
    setSelectedRoute,
    setAlternateRoutes,
  ]);

  const handleToggleSideMenu = useCallback(() => {
    if (state.isSideMenuOpen) {
      dispatch({ type: "CLOSE_SIDE_MENU" });
      // Optionally, if not navigating, reset manual camera control
      if (!isNavigating) {
        setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
      }
    } else {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" }); // Close search/route selection if open
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
      }
      dispatch({ type: "OPEN_SIDE_MENU" });
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: true }));
    }
  }, [
    state.isSideMenuOpen,
    state.uiMode,
    isNavigating,
    setSelectedRoute,
    setAlternateRoutes,
  ]);

  const handleQRScan = useCallback(() => router.push("/qr-scanner"), [router]);
  const handleOpenReportModal = useCallback(
    () => setReportModalVisible(true),
    []
  );
  const handleCloseReportModal = useCallback(
    () => setReportModalVisible(false),
    []
  );
  const handleShowLoginPrompt = useCallback(
    () => setLoginPromptVisible(true),
    []
  );
  const handleCloseLoginPrompt = useCallback(
    () => setLoginPromptVisible(false),
    []
  );

  const navigateToLogin = useCallback(() => {
    setLoginPromptVisible(false); // Close prompt
    dispatch({ type: "CLOSE_SIDE_MENU" }); // Close side menu if open
    router.push("/auth");
  }, [router]);

  const handlePinSelectionForLayer = useCallback(
    (pin: PinRead) => {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" });
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
      }
      if (state.isSideMenuOpen) dispatch({ type: "CLOSE_SIDE_MENU" });
      dispatch({ type: "SELECT_PIN", payload: pin });
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: [pin.longitude, pin.latitude],
        isManuallyControlled: true,
      }));
    },
    [state.uiMode, state.isSideMenuOpen, setSelectedRoute, setAlternateRoutes]
  );

  const handleMapClusterPress = useCallback(
    async (coordinates: [number, number]) => {
      let currentZoom = cameraConfig.zoomLevel;
      if (mapRef.current) {
        try {
          currentZoom = await mapRef.current.getZoom();
        } catch (error) {
          console.warn("Could not get current zoom from mapRef:", error);
        }
      }
      setCameraConfig({
        ...cameraConfig,
        centerCoordinate: coordinates,
        zoomLevel: Math.min(currentZoom + 2, 20),
        animationMode: "flyTo",
        animationDuration: 1200,
        isManuallyControlled: true,
      });
      setTimeout(() => {
        setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
      }, 1300);
    },
    [mapRef, cameraConfig]
  );

  const handleDestinationSelected = useCallback(
    (coords: [number, number]) => {
      dispatch({ type: "SET_DESTINATION", payload: coords });
      setSelectedRouteIdxState(0); // Reset selected route index for new destination
      if (userLocation) {
        const currentExcludes = getExcludesFromPreferences(
          userData?.preferences
        );
        calculateRoutes(
          userLocation,
          coords,
          currentExcludes.length > 0 ? currentExcludes : undefined
        );
      } else
        Alert.alert(
          "Location Needed",
          "Waiting for location to calculate routes."
        );
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: coords,
        zoomLevel: 14,
        isManuallyControlled: true,
      }));
    },
    [userLocation, calculateRoutes, userData?.preferences]
  );

  const handleCancelSearchUIMode = useCallback(() => {
    dispatch({ type: "HIDE_SEARCH" });
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
  }, [setSelectedRoute, setAlternateRoutes]);

  const handleUIRouteSelected = useCallback(
    (route: Route, /* new: pass all alternates */ allAlternates: Route[]) => {
      // chooseRoute(route, selectedRoute); // This logic is now handled by useRoute's chooseRoute
      setSelectedRoute(route); // Directly set the selected route
      setAlternateRoutes(allAlternates.filter((r) => r !== route)); // Update alternates

      if (route.geometry.coordinates.length > 0) {
        setCameraConfig((prev) => ({
          ...prev,
          centerCoordinate: route.geometry.coordinates[0] as [number, number],
          isManuallyControlled: true,
        }));
      }
    },
    [setSelectedRoute, setAlternateRoutes, chooseRoute, selectedRoute]
  );

  const handleUIStartNavigation = useCallback(async () => {
    if (!selectedRoute) {
      Alert.alert("Error", "No route selected.");
      return;
    }
    await startNavigation();
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
  }, [selectedRoute, startNavigation]);

  const handleUICancelNavigation = useCallback(() => {
    stopNavigation(); // This will set isNavigating to false via useRoute
    // The useEffect for isNavigating will then dispatch STOP_NAVIGATION_UI
    setSelectedRoute(null); // Clear routes
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    // dispatch({ type: "HIDE_SEARCH" }); // Already handled by STOP_NAVIGATION_UI if it resets to map mode
    qrDataProcessed.current = false; // Reset QR flag
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
  }, [stopNavigation, setSelectedRoute, setAlternateRoutes]);

  const handleTogglePreference = useCallback(
    (id: string, value: boolean) => {
      const newPreferences = preferences.map((p) =>
        p.id === id ? { ...p, enabled: value } : p
      );
      setPreferences(newPreferences);
      const newPrefsObj = newPreferences.reduce((acc, p) => {
        (acc as any)[p.id] = p.enabled;
        return acc;
      }, {} as UserPreferences);
      if (isSignedIn)
        updatePreferences(newPrefsObj).catch((err) =>
          console.error("Pref update fail:", err)
        );
      const newExcludes = getExcludesFromPreferences(newPrefsObj);
      setRouteExcludes(newExcludes.length > 0 ? newExcludes : undefined);
    },
    [preferences, setRouteExcludes, isSignedIn, updatePreferences]
  );

  const handleRecalculateButtonPressed = useCallback(
    () => recalculateRoute(),
    [recalculateRoute]
  );

  // Initial loading screen for services like location, TTS
  if (state.isInitializing && !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Initialisation des services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <MapDisplay
        mapRef={mapRef}
        cameraConfig={cameraConfig}
        selectedRoute={selectedRoute}
        alternateRoutes={alternateRoutes || []}
        selectedRouteIdxState={selectedRouteIdxState}
        isNavigating={isNavigating}
        uiMode={state.uiMode}
        traveledCoords={traveledCoords}
        destination={state.destination}
        alertPins={alertPinsFromHook}
        onMapPress={handleMapPress}
        onPinSelect={handlePinSelectionForLayer}
        onClusterPress={handleMapClusterPress}
        selectedPin={state.selectedPin}
      />

      <MapControlsOverlay
        onToggleSideMenu={handleToggleSideMenu}
        onOpenReportModal={handleOpenReportModal}
        isSignedIn={isSignedIn}
        onShowLoginPrompt={handleShowLoginPrompt}
        onQRScan={handleQRScan}
        isNavigating={isNavigating}
        uiMode={state.uiMode}
        isSideMenuOpen={state.isSideMenuOpen}
        onToggleSearchUI={handleToggleSearchUI}
      />

      <SearchAndRouteControl
        userLocation={userLocation}
        onDestinationSelected={handleDestinationSelected}
        onStartNavigation={handleUIStartNavigation}
        onCancelSearch={handleCancelSearchUIMode}
        // Pass chooseRoute to SearchAndRouteControl. It will call this when a route is tapped.
        // SearchAndRouteControl will determine the primary and alternates based on what was tapped.
        onRouteSelected={(newSelectedRoute, newAlternates) => {
          setSelectedRoute(newSelectedRoute);
          setAlternateRoutes(newAlternates);
          // Update camera to new selected route if necessary
          if (newSelectedRoute.geometry.coordinates.length > 0) {
            setCameraConfig((prev) => ({
              ...prev,
              centerCoordinate: newSelectedRoute.geometry.coordinates[0] as [
                number,
                number
              ],
              isManuallyControlled: true,
            }));
          }
        }}
        calculateRoutes={calculateRoutes} // For initial calculation after destination select
        loading={
          routeHookLoading && !isRerouting && !state.isInitialRouteCalculated
        }
        visible={
          state.uiMode === "search" || state.uiMode === "route-selection"
        }
        routeFeatures={routeFeatures}
        selectedRoute={selectedRoute}
        alternateRoutes={alternateRoutes || []}
        selectedRouteIndex={selectedRouteIdxState}
        setSelectedRouteIndex={setSelectedRouteIdxState}
      />

      {isNavigating && selectedRoute && (
        <NavigationInterface
          route={selectedRoute}
          instruction={displayedInstruction}
          distanceToNext={distanceToNextManeuver}
          onCancelNavigation={handleUICancelNavigation}
          onRecalculateRoute={handleRecalculateButtonPressed}
          routeFeatures={
            routeFeatures && routeFeatures["primary"]
              ? routeFeatures["primary"]
              : undefined
          }
        />
      )}

      <MapModals
        reportModalVisible={reportModalVisible}
        userLocationForModal={
          userLocation
            ? { longitude: userLocation[0], latitude: userLocation[1] }
            : null
        }
        onCloseReportModal={handleCloseReportModal}
        loginPromptVisible={loginPromptVisible}
        onCloseLoginPrompt={handleCloseLoginPrompt}
        onNavigateToLogin={navigateToLogin}
        isSideMenuOpen={state.isSideMenuOpen}
        onToggleSideMenu={handleToggleSideMenu}
        preferences={preferences}
        onTogglePreference={handleTogglePreference}
        selectedPinForModal={state.selectedPin}
        onClosePinInfoModal={() =>
          dispatch({ type: "SELECT_PIN", payload: null })
        }
      />

      <MapFeedbackIndicators
        isInitializing={state.isInitializing}
        userLocationAvailable={!!userLocation}
        routeHookLoading={routeHookLoading}
        isInitialRouteCalculated={state.isInitialRouteCalculated}
        isRerouting={isRerouting}
        routeHookError={routeHookError}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5FCFF" },
  // Map styles are now in MapDisplay.tsx
  loadingContainer: {
    // Keep for the very initial "services loading"
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#555" }, // Keep for "services loading"
  // Destination marker styles are now in MapDisplay.tsx
  // Error, FullScreenLoading, ReroutingIndicator styles are now in MapFeedbackIndicators.tsx
});

export default Map;
