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
  Dimensions,
  ActivityIndicator,
  Text,
  Alert,
  Platform,
} from "react-native";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  UserTrackingMode, 
} from "@rnmapbox/maps";
import { usePathname, useRouter } from "expo-router";
import { useQRCode } from "@/providers/QRCodeProvider";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";
import useRoute from "@/hooks/routing/useRoute";
import locationTracker from "@/utils/locationTracker";
import ttsManager from "@/utils/ttsManager";
import { getExcludesFromPreferences } from "@/utils/routeUtils";

import SearchAndRouteControl from "@/components/mapbox/SearchAndRouteControl";
import NavigationInterface from "@/components/mapbox/NavigationInterface";
import PinInfoModal from "@/components/mapbox/PinInfoModal";
import useAlertPins from "@/hooks/useAlertPins";

import FloatingActionButton from "@/components/ui/FloatingActionButton";
import { Route } from "@/types/mapbox";
import { PinRead, UserPreferences } from "@/types/api";

import HamburgerMenuButton from "@/components/settings/HamburgerMenuButton";
import SideMenu from "@/components/settings/SideMenu";
import QRCodeButton from "@/components/mapbox/QRCodeButton";
import IncidentReportButton from "@/components/mapbox/IncidentReportButton";
import ReportAlertModal from "@/components/mapbox/ReportAlertModal";
import LoginRequiredModal from "@/components/mapbox/LoginRequiredModal";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import TrafficStatusIndicator from "@/components/mapbox/TrafficStatusIndicator";

// Import the new layer component
import MapboxAlertPinsLayer from "@/components/mapbox/MapboxAlertPinsLayer";

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
        destination: null,
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
      return { ...state, isSideMenuOpen: true, uiMode: "map" };
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

// Define CameraConfig state
interface CameraConfig {
  centerCoordinate?: [number, number];
  zoomLevel: number;
  animationMode: "flyTo" | "easeTo" | "linearTo" | "moveTo" | undefined;
  animationDuration: number;
  pitch?: number;
  heading?: number;
  isManuallyControlled?: boolean; // Flag to manage manual camera control vs. following user
}

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
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

  // NEW: State for camera configuration
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    zoomLevel: 13, 
    animationMode: "flyTo",
    animationDuration: 1200,
    isManuallyControlled: false,
    // centerCoordinate will be set by userLocation or other interactions
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
    liveUserLocation, // This one from useRoute might be slightly different from userLocation
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

  // Effect to set initial camera center when userLocation is available and not manually controlled
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

        const onLocationUpdate = (loc: [number, number]) => {
          setUserLocation(loc); // Update local userLocation state
        };
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
      locationTracker.removeAllListeners("locationUpdate"); // Clean up specific listener
      locationTracker.cleanup(); // General cleanup
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
        // Center camera on QR destination for planning
        setCameraConfig((prev) => ({
          ...prev,
          centerCoordinate: qrData.toCoords,
          zoomLevel: 14, // Or an appropriate zoom level
          isManuallyControlled: true,
        }));
      } else Alert.alert("QR Code Error", "Invalid route data.");
      setTimeout(() => {
        setQRData(null);
        qrDataProcessed.current = false;
        // Reset manual control after processing QR
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

  const globalTrafficLevel = useMemo(
    () =>
      selectedRoute && routeFeatures && routeFeatures["primary"]
        ? routeFeatures["primary"].trafficLevel
        : "unknown",
    [selectedRoute, routeFeatures]
  );

  const alertPinsLocation = useMemo(
    () =>
      userLocation
        ? { latitude: userLocation[1], longitude: userLocation[0] }
        : null,
    [userLocation] // Removed isSignedIn, as pin fetching might not depend on it or is handled within useAlertPins
  );

  const { pins: alertPinsFromHook } = useAlertPins(alertPinsLocation);

  const handleMapPress = useCallback(() => {
    if (state.selectedPin !== null) {
      dispatch({ type: "SELECT_PIN", payload: null });
      return;
    }
    // If user taps map, allow followUserLocation to resume if it was manually overridden
    if (cameraConfig.isManuallyControlled && !isNavigating) {
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
    }
  }, [state.selectedPin, cameraConfig.isManuallyControlled, isNavigating]);

  // ... (handleToggleSearchUI, handleToggleSideMenu, handleQRScan, etc. remain the same)
  const handleToggleSearchUI = useCallback(() => {
    if (state.uiMode === "map" && !state.isSideMenuOpen) {
      dispatch({ type: "SHOW_SEARCH" });
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: true })); // Stop following when search opens
    } else if (
      state.uiMode === "search" ||
      state.uiMode === "route-selection"
    ) {
      dispatch({ type: "HIDE_SEARCH" });
      setSelectedRoute(null);
      setAlternateRoutes([]);
      setSelectedRouteIdxState(0);
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false })); // Resume following if applicable
    } else if (state.isSideMenuOpen) {
      dispatch({ type: "CLOSE_SIDE_MENU" });
      dispatch({ type: "SHOW_SEARCH" });
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
    } else {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" });
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
      }
      dispatch({ type: "OPEN_SIDE_MENU" });
      setCameraConfig((prev) => ({ ...prev, isManuallyControlled: true })); // Stop following when menu opens
    }
  }, [
    state.isSideMenuOpen,
    state.uiMode,
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
    setLoginPromptVisible(false);
    dispatch({ type: "CLOSE_SIDE_MENU" });
    router.push("/auth");
  }, [router]);

  // MODIFIED: This is the callback for MapboxAlertPinsLayer when an INDIVIDUAL pin is selected
  const handlePinSelectionForLayer = useCallback(
    (pin: PinRead) => {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" });
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
      }
      if (state.isSideMenuOpen) {
        dispatch({ type: "CLOSE_SIDE_MENU" });
      }
      dispatch({ type: "SELECT_PIN", payload: pin });
      // Optionally, center map on selected pin
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: [pin.longitude, pin.latitude],
        // zoomLevel: Math.max(prev.zoomLevel, 15), // Zoom in if not already zoomed
        isManuallyControlled: true,
      }));
    },
    [state.uiMode, state.isSideMenuOpen, setSelectedRoute, setAlternateRoutes]
  );

  // NEW: Handler for when a CLUSTER is pressed (called by MapboxAlertPinsLayer)
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
        // Update cameraConfig to trigger re-render of <Camera />
        ...cameraConfig, // spread previous config to keep animationMode etc.
        centerCoordinate: coordinates,
        zoomLevel: Math.min(currentZoom + 2, 20), // Zoom in by 2 levels, max 20
        animationMode: "flyTo",
        animationDuration: 1200,
        isManuallyControlled: true, // Important: Set to true to override followUserLocation temporarily
      });
      // After animation, you might want to reset isManuallyControlled if appropriate for your UX
      setTimeout(() => {
        setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
      }, 1300); // Slightly longer than animation duration
    },
    [mapRef, cameraConfig]
  ); // Include cameraConfig to get current zoom and other settings

  const handleDestinationSelected = useCallback(
    (coords: [number, number]) => {
      dispatch({ type: "SET_DESTINATION", payload: coords });
      setSelectedRouteIdxState(0);
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
      // Center camera on destination for planning
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: coords,
        zoomLevel: 14, // Or an appropriate zoom level
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
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false })); // Resume following if applicable
  }, [setSelectedRoute, setAlternateRoutes]);

  const handleUIRouteSelected = useCallback(
    (route: Route) => {
      chooseRoute(route, selectedRoute);
      // Optionally, adjust camera to fit the newly selected route
      if (route.geometry.coordinates.length > 0) {
        // This is a simplified fit, Mapbox SDK might have better ways to fit bounds
        // For now, just center on the start of the route as an example
        setCameraConfig((prev) => ({
          ...prev,
          centerCoordinate: route.geometry.coordinates[0] as [number, number],
          // zoomLevel: 13, // Or calculate bounds and fit
          isManuallyControlled: true,
        }));
      }
    },
    [chooseRoute, selectedRoute]
  );

  const handleUIStartNavigation = useCallback(async () => {
    if (!selectedRoute) {
      Alert.alert("Error", "No route selected.");
      return;
    }
    await startNavigation(); // This sets isNavigating, which controls uiMode and Camera's followUserLocation
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false })); // Ensure follow mode is active
  }, [selectedRoute, startNavigation]);

  const handleUICancelNavigation = useCallback(() => {
    stopNavigation();
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    dispatch({ type: "HIDE_SEARCH" });
    qrDataProcessed.current = false;
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false })); // Resume default camera behavior
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

  const showFullScreenLoadingOverlay =
    state.isInitializing ||
    (routeHookLoading && !state.isInitialRouteCalculated && !isRerouting);

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
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={
          Config.MAPBOX_STYLE_URL ||
          "mapbox://styles/mapbox/navigation-night-v1"
        }
        logoEnabled={false}
        scaleBarEnabled={false}
        attributionPosition={{
          bottom:
            state.uiMode === "navigation"
              ? Platform.OS === "ios"
                ? 160
                : 130
              : 8,
          right: 8,
        }}
        onPress={handleMapPress}
      >
        <Camera
          // Bind camera props to cameraConfig state
          centerCoordinate={cameraConfig.centerCoordinate}
          zoomLevel={cameraConfig.zoomLevel}
          animationMode={cameraConfig.animationMode}
          animationDuration={cameraConfig.animationDuration}
          pitch={cameraConfig.pitch}
          heading={cameraConfig.heading}
          // Control followUserLocation with isManuallyControlled flag
          followUserLocation={
            !cameraConfig.isManuallyControlled &&
            (isNavigating ||
              (state.uiMode === "map" &&
                !state.destination &&
                !state.selectedPin))
          }
          followUserMode={
            isNavigating
              ? UserTrackingMode.FollowWithCourse
              : UserTrackingMode.Follow
          }
          followZoomLevel={isNavigating ? 17 : cameraConfig.zoomLevel} // use navigation zoom or current
          followPitch={isNavigating ? 45 : 0} // pitch for navigation
        />

        {/* Alternate Routes Rendering */}
        {state.uiMode === "route-selection" &&
          alternateRoutes &&
          alternateRoutes.map((altRoute, index) => (
            <Mapbox.ShapeSource
              id={`altRoute-${index}`}
              key={`altRoute-${index}`}
              shape={altRoute.geometry}
            >
              <Mapbox.LineLayer
                id={`altLine-${index}`}
                style={{
                  lineColor:
                    selectedRouteIdxState === index + 1 ? "#2563eb" : "grey",
                  lineWidth: selectedRouteIdxState === index + 1 ? 6 : 4,
                  lineOpacity: 0.6,
                }}
              />
            </Mapbox.ShapeSource>
          ))}

        {/* Selected Route Rendering */}
        {selectedRoute && selectedRoute.geometry.coordinates.length > 0 && (
          <Mapbox.ShapeSource id="routeSource" shape={selectedRoute.geometry}>
            <Mapbox.LineLayer
              id="routeFill"
              style={{
                lineColor: isNavigating
                  ? "#60a5fa"
                  : state.uiMode === "route-selection" &&
                    selectedRouteIdxState === 0
                  ? "#3b82f6"
                  : state.uiMode === "route-selection"
                  ? "grey"
                  : "#3b82f6",
                lineWidth: isNavigating ? 7 : 6,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: isNavigating ? 0.85 : 0.75,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Traveled Path */}
        {isNavigating && traveledCoords && traveledCoords.length > 1 && (
          <Mapbox.ShapeSource
            id="traveledRoute"
            shape={{ type: "LineString", coordinates: traveledCoords }}
          >
            <Mapbox.LineLayer
              id="traveledLine"
              style={{
                lineColor: "#9ca3af",
                lineWidth: 7,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.9,
              }}
              aboveLayerID="routeFill"
            />
          </Mapbox.ShapeSource>
        )}

        {/* Destination Marker */}
        {state.destination &&
          state.uiMode === "route-selection" &&
          !isNavigating && (
            <Mapbox.PointAnnotation // Use Mapbox.PointAnnotation
              id="destinationLocation"
              coordinate={state.destination}
            >
              <View style={styles.destinationMarker}>
                <View style={styles.destinationMarkerInner} />
              </View>
            </Mapbox.PointAnnotation>
          )}

        {/* Location Puck */}
        <LocationPuck
          visible={true}
          pulsing={
            isNavigating
              ? { isEnabled: true, color: "rgba(0,122,255,0.3)" }
              : { isEnabled: true }
          }
          puckBearingEnabled={true}
          puckBearing="course"
        />

        {/* NEW: Use the MapboxAlertPinsLayer component */}
        <MapboxAlertPinsLayer
          pins={alertPinsFromHook}
          onPinSelect={handlePinSelectionForLayer}
          onClusterPress={handleMapClusterPress} // Pass the new handler
        />
      </MapView>

      {/* UI Elements */}
      <HamburgerMenuButton onPress={handleToggleSideMenu} />
      <IncidentReportButton
        onPress={handleOpenReportModal}
        isSignedIn={isSignedIn}
        onLoginRequired={handleShowLoginPrompt}
      />
      <QRCodeButton onPress={handleQRScan} />

      {!isNavigating && state.uiMode === "map" && !state.isSideMenuOpen && (
        <FloatingActionButton
          iconName="search-location"
          onPress={handleToggleSearchUI}
          visible={true}
          backgroundColor="#4285F4"
          size="medium"
          style={{ bottom: 20, left: 20 }}
        />
      )}

      {globalTrafficLevel !== "unknown" &&
        !isNavigating &&
        state.uiMode === "map" && (
          <TrafficStatusIndicator
            trafficLevel={globalTrafficLevel}
            style={{ position: "absolute", top: 50, right: 120, zIndex: 10 }}
          />
        )}

      <SearchAndRouteControl
        userLocation={userLocation}
        onDestinationSelected={handleDestinationSelected}
        onStartNavigation={handleUIStartNavigation}
        onCancelSearch={handleCancelSearchUIMode}
        onRouteSelected={handleUIRouteSelected}
        calculateRoutes={calculateRoutes}
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

      {/* Modals */}
      {reportModalVisible && (
        <ReportAlertModal
          userLocation={
            userLocation
              ? { latitude: userLocation[1], longitude: userLocation[0] }
              : null
          }
          isVisible={reportModalVisible}
          onClose={handleCloseReportModal}
        />
      )}
      <LoginRequiredModal
        visible={loginPromptVisible}
        onClose={handleCloseLoginPrompt}
        onNavigateToLogin={navigateToLogin}
      />
      <SideMenu
        isVisible={state.isSideMenuOpen}
        onClose={handleToggleSideMenu}
        toLogin={navigateToLogin}
        preferences={preferences}
        onTogglePreference={handleTogglePreference}
      />
      <PinInfoModal
        selectedPin={state.selectedPin}
        onClose={() => dispatch({ type: "SELECT_PIN", payload: null })}
      />

      {routeHookError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{routeHookError}</Text>
        </View>
      )}
      {isRerouting && !showFullScreenLoadingOverlay && (
        <View style={styles.reroutingIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.reroutingText}>Recalcul en cours...</Text>
        </View>
      )}
      {showFullScreenLoadingOverlay && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.fullScreenLoadingText}>
            {state.isInitializing
              ? "Initialisation..."
              : "Calcul d'itinéraire..."}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5FCFF" },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#555" },
  destinationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  destinationMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#3b82f6",
    borderWidth: 2,
    borderColor: "white",
  },
  errorContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    left: 20,
    right: 20,
    backgroundColor: "rgba(220, 53, 69, 0.9)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    zIndex: 2000,
  },
  errorText: { color: "white", fontWeight: "bold", textAlign: "center" },
  fullScreenLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  fullScreenLoadingText: {
    color: "#FFFFFF",
    marginTop: 15,
    fontSize: 18,
    fontWeight: "500",
  },
  reroutingIndicator: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 20,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1000,
  },
  reroutingText: { marginLeft: 10, fontSize: 14, color: "#007AFF" },
});

export default Map;
