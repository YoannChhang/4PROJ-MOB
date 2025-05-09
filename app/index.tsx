// app/index.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer, // Ensure useReducer is imported
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
  PointAnnotation,
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

import SimplifiedAlertPin from "@/components/mapbox/SimplifiedAlertPin";
import SearchAndRouteControl from "@/components/mapbox/SearchAndRouteControl";
import NavigationInterface from "@/components/mapbox/NavigationInterface";
import PinInfoModal from "@/components/mapbox/PinInfoModal";
import useAlertPins from "@/hooks/useAlertPins";

import FloatingActionButton from "@/components/ui/FloatingActionButton";
import { Route } from "@/types/mapbox"; // Ensure Route is imported
import { PinRead, UserPreferences } from "@/types/api";

import HamburgerMenuButton from "@/components/settings/HamburgerMenuButton";
import SideMenu from "@/components/settings/SideMenu";
import QRCodeButton from "@/components/mapbox/QRCodeButton";
import IncidentReportButton from "@/components/mapbox/IncidentReportButton";
import ReportAlertButton from "@/components/mapbox/ReportAlertButton";
import LoginRequiredModal from "@/components/mapbox/LoginRequiredModal";
import { RoutingPreference } from "@/components/settings/RoutingPreferences";
import TrafficStatusIndicator from "@/components/mapbox/TrafficStatusIndicator";

Mapbox.setAccessToken(Config.MAPBOX_PK as string);

// AppState definition
type AppState = {
  uiMode: "map" | "search" | "route-selection" | "navigation";
  destination: [number, number] | null;
  isSideMenuOpen: boolean;
  selectedPin: PinRead | null;
  isInitializing: boolean; // For app services like TTS, location
  isInitialRouteCalculated: boolean; // For tracking if the first route plan after search/QR is complete
};

// AppAction definition
type AppAction =
  | { type: "INITIALIZE_COMPLETE" }
  | { type: "SHOW_SEARCH" }
  | { type: "HIDE_SEARCH" }
  | { type: "SET_DESTINATION"; payload: [number, number] | null }
  | { type: "START_NAVIGATION_UI" }
  | { type: "STOP_NAVIGATION_UI" }
  | { type: "TOGGLE_SIDE_MENU" }
  | { type: "SELECT_PIN"; payload: PinRead | null }
  | { type: "SET_INITIAL_ROUTE_CALCULATED"; payload: boolean };

// App Reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "INITIALIZE_COMPLETE":
      return { ...state, isInitializing: false };
    case "SHOW_SEARCH":
      return { ...state, uiMode: "search", isInitialRouteCalculated: false };
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
      return { ...state, uiMode: "navigation" }; // isInitialRouteCalculated remains true if already set
    case "STOP_NAVIGATION_UI":
      return {
        ...state,
        uiMode: "map",
        destination: null,
        isInitialRouteCalculated: false,
      };
    case "TOGGLE_SIDE_MENU":
      return { ...state, isSideMenuOpen: !state.isSideMenuOpen };
    case "SELECT_PIN":
      return { ...state, selectedPin: action.payload };
    case "SET_INITIAL_ROUTE_CALCULATED":
      return { ...state, isInitialRouteCalculated: action.payload };
    default:
      return state;
  }
};

// Initial App State
const initialAppState: AppState = {
  uiMode: "map",
  destination: null,
  isSideMenuOpen: false,
  selectedPin: null,
  isInitializing: true,
  isInitialRouteCalculated: false,
};

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<MapView>(null);
  const { isSignedIn, userData } = useUser();

  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const { qrData, setQRData } = useQRCode();
  const qrDataProcessed = useRef(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  ); // For initial origin
  const [selectedRouteIdxState, setSelectedRouteIdxState] = useState(0);

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
    liveUserLocation, // The continuously updating location during navigation from useRoute
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation,
    stopNavigation,
    chooseRoute,
    setRouteExcludes,
    routeFeatures,
    calculateRoutes,
    recalculateRoute, // This is the manualRecalculateRoute for the UI button
    isRerouting, // Specific state for rerouting phase
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
    const initializeAppServices = async () => {
      try {
        await ttsManager.initialize();
        console.log("TTS initialized successfully from App Index");
        const trackingStarted = await locationTracker.startTracking();
        if (!trackingStarted) {
          Alert.alert(
            "Location Required",
            "Please enable location access in settings."
          );
        }
        locationTracker.on("locationUpdate", (loc) => setUserLocation(loc));
        const initialLoc = await locationTracker.getLastKnownLocation();
        if (initialLoc) setUserLocation(initialLoc);
        dispatch({ type: "INITIALIZE_COMPLETE" });
      } catch (error) {
        console.error("Initialization error:", error);
        dispatch({ type: "INITIALIZE_COMPLETE" });
        Alert.alert("Error", "Failed to initialize app services.");
      }
    };
    initializeAppServices();
    return () => {
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
      console.log("app/index.tsx: Initial route calculation complete.");
      dispatch({ type: "SET_INITIAL_ROUTE_CALCULATED", payload: true });
    }
  }, [
    state.isInitializing,
    routeHookLoading,
    selectedRoute,
    alternateRoutes,
    state.isInitialRouteCalculated,
  ]);

  const globalTrafficLevel = useMemo(() => {
    if (selectedRoute && routeFeatures && routeFeatures["primary"]) {
      return routeFeatures["primary"].trafficLevel;
    }
    return "unknown";
  }, [selectedRoute, routeFeatures]);

  const { pins: alertPinsFromHook } = useAlertPins(
    liveUserLocation
      ? { latitude: liveUserLocation[1], longitude: liveUserLocation[0] }
      : null
  );

  useEffect(() => {
    if (qrData && !qrDataProcessed.current && userLocation) {
      console.log(
        "Processing QR code data with user location:",
        qrData,
        userLocation
      );
      qrDataProcessed.current = true;
      dispatch({ type: "SET_INITIAL_ROUTE_CALCULATED", payload: false });
      setSelectedRoute(null);
      setAlternateRoutes([]);
      if (qrData.toCoords) {
        dispatch({ type: "SET_DESTINATION", payload: qrData.toCoords });
        const qrExcludes =
          qrData.excludes && qrData.excludes.length > 0
            ? qrData.excludes
            : undefined;
        setRouteExcludes(qrExcludes);
        calculateRoutes(userLocation, qrData.toCoords, qrExcludes);
      } else {
        Alert.alert("QR Code Error", "Invalid route data in QR code.");
      }
      setTimeout(() => {
        setQRData(null);
        qrDataProcessed.current = false;
      }, 1500);
    } else if (qrData && !userLocation) {
      console.log(
        "QR data received, but waiting for user location to process."
      );
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

  const handleMapPress = useCallback(() => {
    if (state.selectedPin !== null) {
      dispatch({ type: "SELECT_PIN", payload: null });
      return;
    }
    if (state.uiMode === "map") dispatch({ type: "SHOW_SEARCH" });
  }, [state.selectedPin, state.uiMode]);

  const toggleSearchUI = useCallback(() => {
    if (state.uiMode === "map") dispatch({ type: "SHOW_SEARCH" });
    else if (state.uiMode === "search" || state.uiMode === "route-selection") {
      dispatch({ type: "HIDE_SEARCH" });
      setSelectedRoute(null);
      setAlternateRoutes([]);
    }
  }, [state.uiMode, setSelectedRoute, setAlternateRoutes]);

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
    router.push("/auth");
  }, [router]);
  const handleSelectPin = useCallback(
    (pin: PinRead) => dispatch({ type: "SELECT_PIN", payload: pin }),
    []
  );

  const handleDestinationSelected = useCallback(
    (coords: [number, number]) => {
      dispatch({ type: "SET_DESTINATION", payload: coords }); // This will set isInitialRouteCalculated to false
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
      } else {
        Alert.alert(
          "Location Needed",
          "Waiting for your current location to calculate routes."
        );
      }
    },
    [userLocation, calculateRoutes, userData?.preferences]
  );

  const handleCancelSearch = useCallback(() => {
    dispatch({ type: "HIDE_SEARCH" });
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
  }, [setSelectedRoute, setAlternateRoutes]);

  const handleUIRouteSelected = useCallback(
    (route: Route) => {
      // Removed alternates from params as chooseRoute handles it
      chooseRoute(route, selectedRoute);
    },
    [chooseRoute, selectedRoute]
  );

  const handleUIStartNavigation = useCallback(async () => {
    if (!selectedRoute) {
      Alert.alert("Error", "No route selected to start navigation.");
      return;
    }
    await startNavigation();
  }, [selectedRoute, startNavigation]);

  const handleUICancelNavigation = useCallback(() => {
    stopNavigation();
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    qrDataProcessed.current = false;
  }, [stopNavigation, setSelectedRoute, setAlternateRoutes]);

  const handleTogglePreference = useCallback(
    (id: string, value: boolean) => {
      const newPreferences = preferences.map((pref) =>
        pref.id === id ? { ...pref, enabled: value } : pref
      );
      setPreferences(newPreferences);
      const newPrefsObject = newPreferences.reduce((acc, pref) => {
        // @ts-ignore
        acc[pref.id] = pref.enabled;
        return acc;
      }, {} as UserPreferences);
      const newExcludes = getExcludesFromPreferences(newPrefsObject);
      setRouteExcludes(newExcludes.length > 0 ? newExcludes : undefined);
      // TODO: If signed in, call a function from useUser to update preferences on backend.
    },
    [preferences, setRouteExcludes]
  );

  const handleRecalculateButtonPressed = useCallback(() => {
    console.log("app/index.tsx: Recalculate button pressed by user.");
    recalculateRoute(); // This calls manualRecalculateRoute from useRoute
  }, [recalculateRoute]);

  // Determine if the full-screen loading overlay should be shown
  const showFullScreenLoadingOverlay =
    state.isInitializing ||
    (routeHookLoading && !state.isInitialRouteCalculated && !isRerouting);

  if (state.isInitializing && !userLocation) {
    // Show basic initializing screen until location is first found
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
          animationMode="flyTo"
          animationDuration={1500}
          followUserLocation={isNavigating}
          followUserMode={
            isNavigating
              ? UserTrackingMode.FollowWithCourse
              : UserTrackingMode.Follow
          }
          followZoomLevel={isNavigating ? 17 : 15}
          centerCoordinate={
            !isNavigating && liveUserLocation ? liveUserLocation : undefined
          } // Use liveUserLocation from useRoute for camera
          zoomLevel={!isNavigating && liveUserLocation ? 15 : undefined}
        />

        {!isNavigating &&
          alternateRoutes &&
          alternateRoutes.map((route, index) => (
            <Mapbox.ShapeSource
              id={`altRouteSource-${index}`}
              key={`altRouteSource-${index}`}
              shape={{
                type: "LineString",
                coordinates: route.geometry.coordinates,
              }}
            >
              <Mapbox.LineLayer
                id={`altRouteFill-${index}`}
                style={{
                  lineColor: "grey",
                  lineWidth: 4,
                  lineOpacity: 0.6,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                belowLayerID={selectedRoute ? "routeFill" : undefined}
              />
            </Mapbox.ShapeSource>
          ))}

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
                lineColor: isNavigating
                  ? "#2196F3"
                  : selectedRouteIdxState === 0
                  ? "#3b82f6"
                  : "grey",
                lineWidth: isNavigating ? 6 : 5,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: isNavigating ? 0.9 : 0.7,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {isNavigating && traveledCoords.length > 1 && (
          <Mapbox.ShapeSource
            id="traveledRoute"
            shape={{ type: "LineString", coordinates: traveledCoords }}
          >
            <Mapbox.LineLayer
              id="traveledLine"
              style={{
                lineColor: "#4CAF50",
                lineWidth: 7,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.8,
              }}
              aboveLayerID={selectedRoute ? "routeFill" : undefined}
            />
          </Mapbox.ShapeSource>
        )}

        {state.destination && !isNavigating && (
          <PointAnnotation
            id="destinationLocation"
            coordinate={state.destination}
          >
            <View style={styles.destinationMarker}>
              <View style={styles.destinationMarkerInner} />
            </View>
          </PointAnnotation>
        )}

        {alertPinsFromHook.map((pin) => (
          <PointAnnotation
            key={`pin-${pin.id}`}
            id={`pin-${pin.id}`}
            coordinate={[pin.longitude, pin.latitude]}
            onSelected={() => handleSelectPin(pin)}
          >
            <SimplifiedAlertPin type={pin.type} />
          </PointAnnotation>
        ))}

        <LocationPuck
          visible={true}
          pulsing={
            isNavigating
              ? { isEnabled: true, color: "rgba(0,122,255,0.3)" }
              : { isEnabled: true }
          }
          puckBearingEnabled={true}
          puckBearing="course" // Ensures puck rotates with course
          // headingImage={require('../assets/images/navigation_puck.png')} // Uncomment if you have this asset
        />
      </MapView>

      <HamburgerMenuButton
        onPress={() => dispatch({ type: "TOGGLE_SIDE_MENU" })}
      />
      <IncidentReportButton
        onPress={handleOpenReportModal}
        isSignedIn={isSignedIn}
        onLoginRequired={handleShowLoginPrompt}
      />
      <QRCodeButton onPress={handleQRScan} />

      {!isNavigating && (
        <FloatingActionButton
          iconName="search-location"
          onPress={toggleSearchUI}
          visible={state.uiMode === "map"}
          backgroundColor="#4285F4"
          size="medium"
          style={{ bottom: 20, left: 20 }}
        />
      )}

      {globalTrafficLevel !== "unknown" && !isNavigating && (
        <TrafficStatusIndicator
          trafficLevel={globalTrafficLevel}
          compact={false}
          style={{ position: "absolute", top: 50, right: 120, zIndex: 10 }}
        />
      )}

      <SearchAndRouteControl
        userLocation={userLocation} // Pass the initial/current userLocation for origin
        onDestinationSelected={handleDestinationSelected}
        onStartNavigation={handleUIStartNavigation}
        onCancelSearch={handleCancelSearch}
        onRouteSelected={handleUIRouteSelected}
        calculateRoutes={calculateRoutes}
        loading={
          routeHookLoading && !isRerouting && !state.isInitialRouteCalculated
        } // Show loading in SearchAndRoute only for initial calc
        visible={
          state.uiMode === "search" || state.uiMode === "route-selection"
        }
        routeFeatures={routeFeatures}
        selectedRoute={selectedRoute}
        alternateRoutes={alternateRoutes || []} // Ensure alternateRoutes is not undefined
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

      {reportModalVisible && (
        <ReportAlertButton
          userLocation={
            liveUserLocation
              ? {
                  latitude: liveUserLocation[1],
                  longitude: liveUserLocation[0],
                }
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
        onClose={() => dispatch({ type: "TOGGLE_SIDE_MENU" })}
        toLogin={() => {
          if (pathname !== "/auth") router.push("/auth");
          dispatch({ type: "TOGGLE_SIDE_MENU" });
        }}
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

      {/* Subtle Rerouting Indicator */}
      {isRerouting &&
        !showFullScreenLoadingOverlay && ( // Show only if full screen isn't active
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
