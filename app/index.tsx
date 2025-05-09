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
} from "react-native";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  PointAnnotation,
  UserTrackingMode,
} from "@rnmapbox/maps";
import { usePathname, useRouter } from "expo-router";
import { useQRCode } from "@/providers/QRCodeProvider";
import { usePins } from "@/providers/PinProvider";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";
import useRoute from "@/hooks/routing/useRoute";
import locationTracker from "@/utils/locationTracker";
import ttsManager from "@/utils/ttsManager";
import { getExcludesFromPreferences } from "@/utils/routeUtils";

import SimplifiedAlertPin from "@/components/mapbox/SimplifiedAlertPin";
import SearchAndRouteControl from "@/components/mapbox/SearchAndRouteControl";
import NavigationInterface from "@/components/mapbox/NavigationInterface";
import PinInfoModal from "@/components/mapbox/PinInfoModal";
import useAlertPins from "@/hooks/useAlertPins";

import FloatingActionButton from "@/components/ui/FloatingActionButton";
import { Route } from "@/types/mapbox";
import { PinRead } from "@/types/api";

// Import navigation button components
import HamburgerMenuButton from "@/components/settings/HamburgerMenuButton";
import SideMenu from "@/components/settings/SideMenu";
import QRCodeButton from "@/components/mapbox/QRCodeButton";
import IncidentReportButton from "@/components/mapbox/IncidentReportButton";
import ReportAlertButton from "@/components/mapbox/ReportAlertButton";
import LoginRequiredModal from "@/components/mapbox/LoginRequiredModal";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import TrafficStatusIndicator from "@/components/mapbox/TrafficStatusIndicator";

// Set Mapbox access token
Mapbox.setAccessToken(Config.MAPBOX_PK as string);

// Define app state and actions
type AppState = {
  uiMode: "map" | "search" | "route-selection" | "navigation";
  destination: [number, number] | null;
  isSideMenuOpen: boolean;
  selectedPin: PinRead | null;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
};

type AppAction =
  | { type: "INITIALIZE_COMPLETE" }
  | { type: "SHOW_SEARCH" }
  | { type: "HIDE_SEARCH" }
  | { type: "SET_DESTINATION"; payload: [number, number] | null }
  | { type: "START_NAVIGATION" }
  | { type: "STOP_NAVIGATION" }
  | { type: "TOGGLE_SIDE_MENU" }
  | { type: "SELECT_PIN"; payload: PinRead | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

// App state reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "INITIALIZE_COMPLETE":
      return { ...state, isInitializing: false };

    case "SHOW_SEARCH":
      return {
        ...state,
        uiMode: state.uiMode === "navigation" ? "navigation" : "search",
      };

    case "HIDE_SEARCH":
      return {
        ...state,
        uiMode: "map",
        destination: null,
      };

    case "SET_DESTINATION":
      return {
        ...state,
        destination: action.payload,
        uiMode: action.payload ? "route-selection" : state.uiMode,
      };

    case "START_NAVIGATION":
      return {
        ...state,
        uiMode: "navigation",
      };

    case "STOP_NAVIGATION":
      return {
        ...state,
        uiMode: "map",
        destination: null,
      };

    case "TOGGLE_SIDE_MENU":
      return {
        ...state,
        isSideMenuOpen: !state.isSideMenuOpen,
      };

    case "SELECT_PIN":
      return {
        ...state,
        selectedPin: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
};

// Initial app state
const initialAppState: AppState = {
  uiMode: "map",
  destination: null,
  isSideMenuOpen: false,
  selectedPin: null,
  isInitializing: true,
  isLoading: false,
  error: null,
};

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<MapView>(null);
  const { isSignedIn, userData } = useUser();
  const { width, height } = Dimensions.get("window");

  // Use reducer for app state
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  // State for incident report modal
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // State for login required modal
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);

  // Use QR code context
  const { qrData, setQRData } = useQRCode();
  const qrDataProcessed = useRef(false);

  // Location state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );

  // Routing preferences state
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

  const [globalTrafficLevel, setGlobalTrafficLevel] = useState<
    "low" | "moderate" | "heavy" | "severe" | "unknown"
  >("unknown");

  // Update preferences when user data changes
  useEffect(() => {
    if (userData?.preferences) {
      setPreferences([
        {
          id: "avoid_tolls",
          label: "Avoid Tolls",
          enabled: userData.preferences.avoid_tolls || false,
        },
        {
          id: "avoid_highways",
          label: "Avoid Highways",
          enabled: userData.preferences.avoid_highways || false,
        },
        {
          id: "avoid_unpaved",
          label: "Avoid Unpaved Roads",
          enabled: userData.preferences.avoid_unpaved || false,
        },
      ]);
    }
  }, [userData?.preferences]);

  // Handle preference toggle
  const handleTogglePreference = useCallback((id: string, value: boolean) => {
    setPreferences((prev) =>
      prev.map((pref) => (pref.id === id ? { ...pref, enabled: value } : pref))
    );

    // Update user preferences if needed
    // This logic should remain as it was in SettingsModal
  }, []);

  // Initialize location tracking and TTS
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize TTS with better error handling
        try {
          await ttsManager.initialize();
          console.log("TTS initialized successfully");
        } catch (error) {
          console.warn(
            "TTS initialization failed, continuing without voice guidance:",
            error
          );
        }

        // Start location tracking with error handling
        const trackingStarted = await locationTracker.startTracking();
        if (!trackingStarted) {
          console.warn(
            "Location tracking could not be started, check permissions"
          );
          Alert.alert(
            "Location Required",
            "This app needs location access to provide navigation services. Please enable location access in your device settings.",
            [{ text: "OK" }]
          );
        }

        // Set up location update listener
        locationTracker.on("locationUpdate", (location) => {
          setUserLocation(location);
        });

        // Get initial location
        const initialLocation = await locationTracker.getLastKnownLocation();
        if (initialLocation) {
          setUserLocation(initialLocation);
        }

        // Initialization complete
        dispatch({ type: "INITIALIZE_COMPLETE" });
      } catch (error) {
        console.error("Initialization error:", error);
        dispatch({ type: "INITIALIZE_COMPLETE" });
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to initialize app services",
        });
      }
    };

    initialize();

    return () => {
      // Clean up resources when component unmounts
      locationTracker.cleanup();
      ttsManager.cleanup();
    };
  }, []);

  // Use the route hook
  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: routeLoading,
    error: routeError,
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,
    startNavigation,
    stopNavigation,
    chooseRoute,
    setRouteExcludes,
    routeFeatures,
    isFeatureDetectionInProgress,
  } = useRoute(userLocation, state.destination);

  useEffect(() => {
    if (selectedRoute && routeFeatures["primary"]) {
      const primaryFeatures = routeFeatures["primary"];
      setGlobalTrafficLevel(primaryFeatures.trafficLevel);
    } else {
      setGlobalTrafficLevel("unknown");
    }
  }, [selectedRoute, routeFeatures]);

  // Handle route recalculation
  const handleRecalculateRoute = useCallback(() => {
    if (!userLocation || !state.destination) {
      dispatch({
        type: "SET_ERROR",
        payload: "Cannot recalculate route: missing coordinates",
      });
      return;
    }

    try {
      // Announce rerouting
      ttsManager.speak("Recalcul d'itinéraire en cours");

      // Since handleReroute doesn't exist, we'll manually trigger a reroute
      // by temporarily stopping navigation and then restarting it
      setIsNavigating(false);

      // Update dispatch to reflect navigation state
      dispatch({ type: "SET_LOADING", payload: true });

      // Force a recalculation by creating a slight delay
      setTimeout(() => {
        // Resume navigation after a short delay
        setIsNavigating(true);
        dispatch({ type: "SET_LOADING", payload: false });
      }, 1000);
    } catch (error) {
      console.error("Rerouting error:", error);
      dispatch({ type: "SET_ERROR", payload: "Failed to recalculate route" });
    }
  }, [userLocation, state.destination, setIsNavigating]);

  // Update app loading state when route loading changes
  useEffect(() => {
    dispatch({ type: "SET_LOADING", payload: routeLoading });
  }, [routeLoading]);

  // Handle route errors
  useEffect(() => {
    if (routeError) {
      dispatch({ type: "SET_ERROR", payload: routeError });
      // Display error to user if severe
      if (routeError.includes("Failed to fetch routes")) {
        Alert.alert(
          "Navigation Error",
          "Unable to calculate route. Please check your internet connection and try again.",
          [{ text: "OK" }]
        );
      }
    } else {
      dispatch({ type: "SET_ERROR", payload: null });
    }
  }, [routeError]);

  // Update UI mode when navigation state changes
  useEffect(() => {
    if (isNavigating && state.uiMode !== "navigation") {
      dispatch({ type: "START_NAVIGATION" });
    } else if (!isNavigating && state.uiMode === "navigation") {
      dispatch({ type: "STOP_NAVIGATION" });
    }
  }, [isNavigating, state.uiMode]);

  // Set route excludes based on user preferences
  useEffect(() => {
    if (!userData?.preferences) return;

    const excludes = getExcludesFromPreferences(userData.preferences);
    setRouteExcludes(excludes.length > 0 ? excludes : undefined);
  }, [userData?.preferences, setRouteExcludes]);

  // Get pins for the current location
  const { pins } = useAlertPins(
    userLocation
      ? {
          latitude: userLocation[1],
          longitude: userLocation[0],
        }
      : null
  );

  // Process QR code data with improved handling
  useEffect(() => {
    if (qrData && !qrDataProcessed.current) {
      console.log("Processing QR code data:", qrData);
      qrDataProcessed.current = true;

      // Set loading state
      dispatch({ type: "SET_LOADING", payload: true });

      // Reset existing route state
      setSelectedRoute(null);
      setAlternateRoutes([]);

      try {
        // Set destination from QR code
        if (qrData.toCoords) {
          console.log("Setting destination from QR code:", qrData.toCoords);
          dispatch({ type: "SET_DESTINATION", payload: qrData.toCoords });
          dispatch({ type: "SHOW_SEARCH" });

          // Set route excludes if present
          if (qrData.excludes && qrData.excludes.length > 0) {
            console.log("Setting excludes from QR code:", qrData.excludes);
            setRouteExcludes(qrData.excludes);
          } else {
            // Reset to user preferences if no excludes in QR
            console.log("Using user preferences for route options");
            const excludes = getExcludesFromPreferences(userData?.preferences);
            setRouteExcludes(excludes.length > 0 ? excludes : undefined);
          }
        }
      } catch (error) {
        console.error("Error processing QR data:", error);
        dispatch({ type: "SET_ERROR", payload: "Invalid QR code data" });
        Alert.alert(
          "QR Code Error",
          "Could not process the scanned QR code. Please try again with a valid route code.",
          [{ text: "OK" }]
        );
      } finally {
        // End loading state
        dispatch({ type: "SET_LOADING", payload: false });

        // Clear QR data to prevent reprocessing
        setTimeout(() => {
          setQRData(null);
        }, 1000);
      }
    }
  }, [qrData, setRouteExcludes, setQRData, userData?.preferences]);

  // Handle map tap with improved pin handling
  const handleMapPress = useCallback(() => {
    // Close any open pin info when tapping on the map
    if (state.selectedPin !== null) {
      dispatch({ type: "SELECT_PIN", payload: null });
      return;
    }

    // If we're in map mode, show search
    if (state.uiMode === "map") {
      dispatch({ type: "SHOW_SEARCH" });
    }
  }, [state.selectedPin, state.uiMode]);

  // Toggle search UI
  const toggleSearchUI = useCallback(() => {
    if (state.uiMode === "map") {
      dispatch({ type: "SHOW_SEARCH" });
    } else if (state.uiMode === "search") {
      dispatch({ type: "HIDE_SEARCH" });
    }
  }, [state.uiMode]);

  // Handle QR code button press
  const handleQRScan = useCallback(() => {
    router.push("/qr-scanner");
  }, [router]);

  // Handle incident report button press
  const handleOpenReportModal = useCallback(() => {
    setReportModalVisible(true);
  }, []);

  // Handle closing incident report modal
  const handleCloseReportModal = useCallback(() => {
    setReportModalVisible(false);
  }, []);

  // Handle showing login prompt modal
  const handleShowLoginPrompt = useCallback(() => {
    setLoginPromptVisible(true);
  }, []);

  // Handle closing login prompt modal
  const handleCloseLoginPrompt = useCallback(() => {
    setLoginPromptVisible(false);
  }, []);

  // Navigate to login screen
  const navigateToLogin = useCallback(() => {
    setLoginPromptVisible(false);
    router.push("/auth");
  }, [router]);

  // Handle pin selection
  const handleSelectPin = useCallback((pin: PinRead) => {
    dispatch({ type: "SELECT_PIN", payload: pin });
  }, []);

  // Handle destination selection
  const handleDestinationSelected = useCallback((coords: [number, number]) => {
    dispatch({ type: "SET_DESTINATION", payload: coords });
  }, []);

  // Cancel search
  const handleCancelSearch = useCallback(() => {
    dispatch({ type: "HIDE_SEARCH" });
    setSelectedRoute(null);
    setAlternateRoutes([]);
  }, [setSelectedRoute, setAlternateRoutes]);

  // Handle route selection
  const handleRouteSelected = useCallback(
    (selectedRoute: Route, alternateRoutes: Route[]) => {
      setSelectedRoute(selectedRoute);
      setAlternateRoutes(alternateRoutes);
    },
    [setSelectedRoute, setAlternateRoutes]
  );

  // Handle start navigation with proper initialization
  const handleStartNavigation = useCallback(() => {
    if (!selectedRoute) {
      dispatch({ type: "SET_ERROR", payload: "No route selected" });
      return;
    }

    // Start navigation using the hook's function
    startNavigation();

    // Update UI mode
    dispatch({ type: "START_NAVIGATION" });
  }, [selectedRoute, startNavigation]);

  // Handle cancel navigation with proper cleanup
  const handleCancelNavigation = useCallback(() => {
    // Stop navigation using the hook's function
    stopNavigation();

    // Reset state
    dispatch({ type: "STOP_NAVIGATION" });
    setSelectedRoute(null);
    setAlternateRoutes([]);

    // Reset QR data processing flag
    qrDataProcessed.current = false;
  }, [stopNavigation, setSelectedRoute, setAlternateRoutes]);

  // Loading screen while initializing
  if (state.isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>
          Initializing navigation services...
        </Text>
      </View>
    );
  }

  // Compute whether search UI is visible
  const isSearchVisible =
    state.uiMode === "search" || state.uiMode === "route-selection";

  return (
    <View style={styles.page}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/navigation-night-v1"
        logoEnabled={false}
        scaleBarEnabled={false}
        attributionPosition={{
          bottom: state.uiMode === "navigation" ? 130 : 8,
          right: 8,
        }}
        onPress={handleMapPress}
      >
        <Camera
          animationMode="flyTo"
          animationDuration={2000}
          followUserLocation={state.uiMode === "navigation"}
          followUserMode={"course" as UserTrackingMode}
          followZoomLevel={state.uiMode === "navigation" ? 18 : undefined}
          bounds={
            selectedRoute && selectedRoute.geometry.coordinates.length > 0
              ? {
                  ne: selectedRoute.geometry.coordinates[0],
                  sw: selectedRoute.geometry.coordinates[
                    selectedRoute.geometry.coordinates.length - 1
                  ],
                  paddingLeft: 50,
                  paddingRight: 50,
                  paddingTop: 50,
                  paddingBottom: 50,
                }
              : userLocation
              ? {
                  ne: [userLocation[0] + 0.01, userLocation[1] + 0.01],
                  sw: [userLocation[0] - 0.01, userLocation[1] - 0.01],
                  paddingLeft: 50,
                  paddingRight: 50,
                  paddingTop: 50,
                  paddingBottom: 50,
                }
              : undefined
          }
        />

        {/* Route lines for alternative routes */}
        {state.uiMode !== "navigation" &&
          alternateRoutes.map((route, index) => (
            <Mapbox.ShapeSource
              id={`routeSource-${index}`}
              key={`routeSource-${index}`}
              shape={{
                type: "LineString",
                coordinates: route.geometry.coordinates,
              }}
            >
              <Mapbox.LineLayer
                id={`routeFill-${index}`}
                style={{
                  lineColor: "gray",
                  lineWidth: 3,
                  lineOpacity: 0.7,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                belowLayerID="routeFill"
              />
            </Mapbox.ShapeSource>
          ))}

        {/* Traveled portion of the selected route during navigation */}
        {state.uiMode === "navigation" && traveledCoords.length > 0 && (
          <Mapbox.ShapeSource
            id="traveledRoute"
            shape={{ type: "LineString", coordinates: traveledCoords }}
          >
            <Mapbox.LineLayer
              id="traveledLine"
              style={{
                lineColor: "#4CAF50",
                lineWidth: 5,
                lineCap: "round",
                lineJoin: "round",
              }}
              aboveLayerID="routeFill"
            />
          </Mapbox.ShapeSource>
        )}

        {/* Selected route line */}
        {selectedRoute && selectedRoute.geometry.coordinates.length > 0 && (
          <Mapbox.ShapeSource
            id="routeSource"
            shape={{
              type: "LineString",
              coordinates: selectedRoute.geometry.coordinates,
            }}
          >
            <Mapbox.LineLayer
              id="routeFill"
              style={{
                lineColor:
                  state.uiMode === "navigation" ? "#2196F3" : "#3b82f6",
                lineWidth: state.uiMode === "navigation" ? 4 : 3,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: state.uiMode === "navigation" ? 0.8 : 1,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Destination marker */}
        {state.destination && (
          <PointAnnotation id="selectedLocation" coordinate={state.destination}>
            <View style={styles.destinationMarker}>
              <View style={styles.destinationMarkerInner} />
            </View>
          </PointAnnotation>
        )}

        {/* Render alert pins */}
        {pins.map((pin) => (
          <PointAnnotation
            key={`pin-${pin.id}`}
            id={`pin-${pin.id}`}
            coordinate={[pin.longitude, pin.latitude]}
            onSelected={() => {
              handleSelectPin(pin);
              return true;
            }}
          >
            <SimplifiedAlertPin type={pin.type} />
          </PointAnnotation>
        ))}

        {/* User location marker */}
        <LocationPuck pulsing={{ isEnabled: true }} visible={true} />
      </MapView>

      {/* Hamburger Menu Button */}
      <HamburgerMenuButton
        onPress={() => dispatch({ type: "TOGGLE_SIDE_MENU" })}
      />

      {/* Incident Report Button (updated with login check) */}
      <IncidentReportButton
        onPress={handleOpenReportModal}
        isSignedIn={isSignedIn}
        onLoginRequired={handleShowLoginPrompt}
      />

      {/* QR Code Button */}
      <QRCodeButton onPress={handleQRScan} />

      {/* Floating Search Button */}
      <FloatingActionButton
        iconName="search-location"
        onPress={toggleSearchUI}
        visible={state.uiMode === "map"}
        backgroundColor="#4285F4"
        size="medium"
        style={{ bottom: 20, left: 20 }}
      />

      <TrafficStatusIndicator
        trafficLevel={globalTrafficLevel}
        compact={false}
        style={{
          position: "absolute",
          top: 50,
          right: 120, // Position next to other buttons
          zIndex: 10,
        }}
      />

      {/* Search and Route Control */}
      <SearchAndRouteControl
        userLocation={userLocation}
        onDestinationSelected={handleDestinationSelected}
        onStartNavigation={handleStartNavigation}
        onCancelSearch={handleCancelSearch}
        onRouteSelected={handleRouteSelected}
        loading={routeLoading}
        visible={isSearchVisible}
        routeFeatures={routeFeatures} // Keep this prop
        isFeatureDetectionInProgress={isFeatureDetectionInProgress()}
      />

      {/* Navigation Interface */}
      {state.uiMode === "navigation" && selectedRoute && (
        <NavigationInterface
          route={selectedRoute}
          instruction={currentInstruction}
          distanceToNext={distanceToNextManeuver}
          onCancelNavigation={handleCancelNavigation}
          onRecalculateRoute={handleRecalculateRoute}
          routeFeatures={routeFeatures["primary"]} // Add route features
        />
      )}

      {/* Report Alert Functionality */}
      {reportModalVisible && (
        <ReportAlertButton
          userLocation={
            userLocation
              ? {
                  latitude: userLocation[1],
                  longitude: userLocation[0],
                }
              : null
          }
          isVisible={reportModalVisible}
          onClose={handleCloseReportModal}
        />
      )}

      {/* Login Required Modal */}
      <LoginRequiredModal
        visible={loginPromptVisible}
        onClose={handleCloseLoginPrompt}
        onNavigateToLogin={navigateToLogin}
      />

      {/* Side Menu */}
      <SideMenu
        isVisible={state.isSideMenuOpen}
        onClose={() => dispatch({ type: "TOGGLE_SIDE_MENU" })}
        toLogin={() => {
          if (pathname == "/auth") return;
          router.push("/auth");
          dispatch({ type: "TOGGLE_SIDE_MENU" });
        }}
        preferences={preferences}
        onTogglePreference={handleTogglePreference}
      />

      {/* Pin Info Modal */}
      <PinInfoModal
        selectedPin={state.selectedPin}
        onClose={() => dispatch({ type: "SELECT_PIN", payload: null })}
      />

      {/* Error display */}
      {state.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5FCFF",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#555",
  },
  routeLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
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
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(244, 67, 54, 0.8)",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  errorText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default Map;
