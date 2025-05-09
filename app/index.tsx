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
} from "react-native";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  PointAnnotation,
  UserTrackingMode, // Ensure this is imported
} from "@rnmapbox/maps";
import { usePathname, useRouter } from "expo-router";
import { useQRCode } from "@/providers/QRCodeProvider";
// import { usePins } from '@/providers/PinProvider'; // Already imported via useAlertPins or directly state.selectedPin
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

type AppState = {
  uiMode: "map" | "search" | "route-selection" | "navigation";
  destination: [number, number] | null;
  isSideMenuOpen: boolean;
  selectedPin: PinRead | null;
  isInitializing: boolean;
  // isLoading and error are now primarily driven by the useRoute hook
};

type AppAction =
  | { type: "INITIALIZE_COMPLETE" }
  | { type: "SHOW_SEARCH" }
  | { type: "HIDE_SEARCH" }
  | { type: "SET_DESTINATION"; payload: [number, number] | null }
  | { type: "START_NAVIGATION_UI" } // UI intent to navigate
  | { type: "STOP_NAVIGATION_UI" }  // UI intent to stop
  | { type: "TOGGLE_SIDE_MENU" }
  | { type: "SELECT_PIN"; payload: PinRead | null };
  // | { type: "SET_LOADING"; payload: boolean } // Removed, handled by useRoute
  // | { type: "SET_ERROR"; payload: string | null }; // Removed, handled by useRoute

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "INITIALIZE_COMPLETE":
      return { ...state, isInitializing: false };
    case "SHOW_SEARCH":
      return { ...state, uiMode: "search" }; // Simplified: always go to search
    case "HIDE_SEARCH":
      return { ...state, uiMode: "map", destination: null }; // Reset destination
    case "SET_DESTINATION":
      return { ...state, destination: action.payload, uiMode: action.payload ? "route-selection" : "search" };
    case "START_NAVIGATION_UI":
      return { ...state, uiMode: "navigation" };
    case "STOP_NAVIGATION_UI":
      return { ...state, uiMode: "map", destination: null };
    case "TOGGLE_SIDE_MENU":
      return { ...state, isSideMenuOpen: !state.isSideMenuOpen };
    case "SELECT_PIN":
      return { ...state, selectedPin: action.payload };
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedRouteIdxState, setSelectedRouteIdxState] = useState(0); // Local state for SearchAndRouteControl

  const [preferences, setPreferences] = useState<RoutingPreference[]>([
    { id: "avoid_tolls", label: "Avoid Tolls", enabled: userData?.preferences?.avoid_tolls || false },
    { id: "avoid_highways", label: "Avoid Highways", enabled: userData?.preferences?.avoid_highways || false },
    { id: "avoid_unpaved", label: "Avoid Unpaved Roads", enabled: userData?.preferences?.avoid_unpaved || false },
  ]);

  useEffect(() => {
    if (userData?.preferences) {
      setPreferences([
        { id: "avoid_tolls", label: "Avoid Tolls", enabled: userData.preferences.avoid_tolls || false },
        { id: "avoid_highways", label: "Avoid Highways", enabled: userData.preferences.avoid_highways || false },
        { id: "avoid_unpaved", label: "Avoid Unpaved Roads", enabled: userData.preferences.avoid_unpaved || false },
      ]);
      const currentExcludes = getExcludesFromPreferences(userData.preferences);
      setRouteExcludes(currentExcludes.length > 0 ? currentExcludes : undefined);
    }
  }, [userData?.preferences]); // setRouteExcludes will be defined by useRoute hook later

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: routeHookLoading, // From useRoute
    error: routeHookError,     // From useRoute
    isNavigating,
    liveUserLocation, // This is the live location from useRoute -> useRouteNavigation
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation, // This is the function from useRoute
    stopNavigation,  // This is the function from useRoute
    chooseRoute,
    setRouteExcludes,
    routeFeatures,
    calculateRoutes,
    recalculateRoute, // This is the function from useRoute for manual recalculation
  } = useRoute(userLocation, state.destination); // Pass initial/current userLocation and state.destination

  useEffect(() => {
    const initializeAppServices = async () => {
      try {
        await ttsManager.initialize();
        console.log("TTS initialized successfully from App Index");

        const trackingStarted = await locationTracker.startTracking();
        if (!trackingStarted) {
          console.warn("Location tracking could not be started, check permissions");
          Alert.alert(
            "Location Required",
            "This app needs location access to provide navigation services. Please enable location access in your device settings.",
            [{ text: "OK" }]
          );
        }

        locationTracker.on("locationUpdate", (loc) => {
          setUserLocation(loc); // Update initial/current userLocation for useRoute
        });

        const initialLoc = await locationTracker.getLastKnownLocation();
        if (initialLoc) {
          setUserLocation(initialLoc);
        }
        dispatch({ type: "INITIALIZE_COMPLETE" });
      } catch (error) {
        console.error("Initialization error:", error);
        dispatch({ type: "INITIALIZE_COMPLETE" }); // Still complete initialization
        Alert.alert("Error", "Failed to initialize app services. Some features may not work.");
      }
    };
    initializeAppServices();
    return () => {
      locationTracker.cleanup();
      ttsManager.cleanup();
    };
  }, []);
  
  // Sync isNavigating from hook to local UI state
  useEffect(() => {
    if (isNavigating && state.uiMode !== "navigation") {
      dispatch({ type: "START_NAVIGATION_UI" });
    } else if (!isNavigating && state.uiMode === "navigation") {
      dispatch({ type: "STOP_NAVIGATION_UI" });
    }
  }, [isNavigating, state.uiMode]);


  const globalTrafficLevel = useMemo(() => {
    if (selectedRoute && routeFeatures && routeFeatures["primary"]) {
      return routeFeatures["primary"].trafficLevel;
    }
    return "unknown";
  }, [selectedRoute, routeFeatures]);


  const { pins: alertPinsFromHook } = useAlertPins(
    liveUserLocation ? { latitude: liveUserLocation[1], longitude: liveUserLocation[0] } : null
  );

  useEffect(() => {
    if (qrData && !qrDataProcessed.current && userLocation) { // Ensure userLocation is available for QR
      console.log("Processing QR code data with user location:", qrData, userLocation);
      qrDataProcessed.current = true;

      setSelectedRoute(null);
      setAlternateRoutes([]);

      if (qrData.toCoords) {
        dispatch({ type: "SET_DESTINATION", payload: qrData.toCoords });
        // No need to call dispatch({ type: "SHOW_SEARCH" }) as SET_DESTINATION handles uiMode
        
        const qrExcludes = qrData.excludes && qrData.excludes.length > 0 ? qrData.excludes : undefined;
        setRouteExcludes(qrExcludes); // This will trigger route calculation via useRoute's useEffect

        // Calculate routes explicitly if userLocation and destination are set
        calculateRoutes(userLocation, qrData.toCoords, qrExcludes);

      } else {
         Alert.alert("QR Code Error", "Invalid route data in QR code.");
      }
      // Clear QR data after processing attempt
      // Timeout to ensure state updates before clearing, might need adjustment or better state management
      setTimeout(() => {
        setQRData(null);
        qrDataProcessed.current = false; // Allow reprocessing if needed
      }, 1500);
    } else if (qrData && !userLocation) {
        console.log("QR data received, but waiting for user location to process.");
        // Optionally, show a message to the user
    }
  }, [qrData, userLocation, calculateRoutes, setQRData, setSelectedRoute, setAlternateRoutes, setRouteExcludes]);


  const handleMapPress = useCallback(() => {
    if (state.selectedPin !== null) {
      dispatch({ type: "SELECT_PIN", payload: null });
      return;
    }
    if (state.uiMode === "map") {
      dispatch({ type: "SHOW_SEARCH" });
    }
  }, [state.selectedPin, state.uiMode]);

  const toggleSearchUI = useCallback(() => {
    if (state.uiMode === "map") dispatch({ type: "SHOW_SEARCH" });
    else if (state.uiMode === "search" || state.uiMode === "route-selection") {
      dispatch({ type: "HIDE_SEARCH" });
      setSelectedRoute(null); // Clear routes when hiding search
      setAlternateRoutes([]);
    }
  }, [state.uiMode, setSelectedRoute, setAlternateRoutes]);

  const handleQRScan = useCallback(() => router.push("/qr-scanner"), [router]);
  const handleOpenReportModal = useCallback(() => setReportModalVisible(true), []);
  const handleCloseReportModal = useCallback(() => setReportModalVisible(false), []);
  const handleShowLoginPrompt = useCallback(() => setLoginPromptVisible(true), []);
  const handleCloseLoginPrompt = useCallback(() => setLoginPromptVisible(false), []);
  
  const navigateToLogin = useCallback(() => {
    setLoginPromptVisible(false);
    router.push("/auth");
  }, [router]);

  const handleSelectPin = useCallback((pin: PinRead) => dispatch({ type: "SELECT_PIN", payload: pin }), []);

  const handleDestinationSelected = useCallback((coords: [number, number]) => {
    dispatch({ type: "SET_DESTINATION", payload: coords });
    setSelectedRouteIdxState(0); // Reset selected route index for new destination
    if (userLocation) { // Ensure userLocation is available before calculating
        const currentExcludes = getExcludesFromPreferences(userData?.preferences);
        calculateRoutes(userLocation, coords, currentExcludes.length > 0 ? currentExcludes : undefined);
    } else {
        console.warn("User location not available to calculate routes for selected destination.");
        Alert.alert("Location Needed", "Waiting for your current location to calculate routes.");
    }
  }, [userLocation, calculateRoutes, userData?.preferences]);


  const handleCancelSearch = useCallback(() => {
    dispatch({ type: "HIDE_SEARCH" });
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
  }, [setSelectedRoute, setAlternateRoutes]);

  // Called by SearchAndRouteControl when a route is tapped
  const handleUIRouteSelected = useCallback((route: Route, alternates: Route[]) => {
    // This updates the useRoute's selectedRoute and alternateRoutes
    chooseRoute(route, selectedRoute); // Use chooseRoute from useRoute hook
  }, [chooseRoute, selectedRoute]);


  // Called by SearchAndRouteControl when "Start" is pressed
  const handleUIStartNavigation = useCallback(async () => {
    if (!selectedRoute) {
      Alert.alert("Error", "No route selected to start navigation.");
      return;
    }
    await startNavigation(); // Call useRoute's startNavigation
    // uiMode is updated by useEffect watching isNavigating
  }, [selectedRoute, startNavigation]);

  // Called by NavigationInterface when "Stop" is pressed
  const handleUICancelNavigation = useCallback(() => {
    stopNavigation(); // Call useRoute's stopNavigation
    // uiMode is updated by useEffect watching isNavigating
    // Reset other UI specific states if necessary
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    qrDataProcessed.current = false; // Allow QR reprocessing if navigation is cancelled
  }, [stopNavigation, setSelectedRoute, setAlternateRoutes]);

   const handleTogglePreference = useCallback((id: string, value: boolean) => {
    setPreferences((prev) =>
      prev.map((pref) => (pref.id === id ? { ...pref, enabled: value } : pref))
    );
    // Update user preferences in the backend via useUser if signed in
    // And then update routeExcludes for useRoute
    const updatedPrefsObject = preferences.reduce((acc, pref) => {
        // @ts-ignore
        acc[pref.id] = pref.enabled;
        return acc;
    }, {} as UserPreferences);
    // @ts-ignore
    updatedPrefsObject[id] = value;

    const newExcludes = getExcludesFromPreferences(updatedPrefsObject);
    setRouteExcludes(newExcludes.length > 0 ? newExcludes : undefined);
    
    // If user is signed in, persist preferences to backend (implementation needed in UserProvider)
    // if (isSignedIn && userData.updatePreferences) {
    //   userData.updatePreferences(updatedPrefsObject);
    // }

  }, [preferences, setRouteExcludes /*, isSignedIn, userData.updatePreferences */]);


  if (state.isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Initializing navigation services...</Text>
      </View>
    );
  }

  const isSearchUIVisible = state.uiMode === "search" || state.uiMode === "route-selection";

  return (
    <View style={styles.page}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={Config.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/navigation-night-v1"}
        logoEnabled={false}
        scaleBarEnabled={false}
        attributionPosition={{ bottom: state.uiMode === "navigation" ? 130 : 8, right: 8 }}
        onPress={handleMapPress}
      >
        <Camera
          animationMode="flyTo"
          animationDuration={1500} // Slightly faster animation
          followUserLocation={isNavigating} // Follow only when navigating
          followUserMode={isNavigating ? UserTrackingMode.FollowWithCourse : UserTrackingMode.Follow}
          followZoomLevel={isNavigating ? 17 : 15} // Adjusted zoom levels
          centerCoordinate={!isNavigating && liveUserLocation ? liveUserLocation : undefined}
          zoomLevel={!isNavigating && liveUserLocation ? 15 : undefined}
        />

        {!isNavigating && alternateRoutes.map((route, index) => (
          <Mapbox.ShapeSource
            id={`altRouteSource-${index}`}
            key={`altRouteSource-${index}`}
            shape={{ type: "LineString", coordinates: route.geometry.coordinates }}
          >
            <Mapbox.LineLayer
              id={`altRouteFill-${index}`}
              style={{ lineColor: "grey", lineWidth: 4, lineOpacity: 0.6, lineCap: "round", lineJoin: "round" }}
              belowLayerID={selectedRoute ? "routeFill" : undefined} // Place below main route if it exists
            />
          </Mapbox.ShapeSource>
        ))}
        
        {selectedRoute && selectedRoute.geometry.coordinates.length > 0 && (
          <Mapbox.ShapeSource id="routeSource" shape={{ type: "LineString", coordinates: selectedRoute.geometry.coordinates }}>
            <Mapbox.LineLayer
              id="routeFill"
              style={{
                lineColor: isNavigating ? "#2196F3" : (selectedRouteIdxState === 0 ? "#3b82f6" : "grey"), // Main selected is blue, others grey
                lineWidth: isNavigating ? 6 : 5,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: isNavigating ? 0.9 : 0.7,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {isNavigating && traveledCoords.length > 1 && ( // Ensure at least two points to form a line
          <Mapbox.ShapeSource id="traveledRoute" shape={{ type: "LineString", coordinates: traveledCoords }}>
            <Mapbox.LineLayer
              id="traveledLine"
              style={{ lineColor: "#4CAF50", lineWidth: 7, lineCap: "round", lineJoin: "round", lineOpacity: 0.8 }}
              aboveLayerID={selectedRoute ? "routeFill" : undefined} // Ensure it's above the main route line
            />
          </Mapbox.ShapeSource>
        )}

        {state.destination && !isNavigating && ( // Show destination only if not navigating or if it's part of route planning
          <PointAnnotation id="destinationLocation" coordinate={state.destination}>
            <View style={styles.destinationMarker}><View style={styles.destinationMarkerInner} /></View>
          </PointAnnotation>
        )}

        {alertPinsFromHook.map((pin) => (
          <PointAnnotation
            key={`pin-${pin.id}`}
            id={`pin-${pin.id}`}
            coordinate={[pin.longitude, pin.latitude]}
            onSelected={() => handleSelectPin(pin)} // No need for `return true`
          >
            <SimplifiedAlertPin type={pin.type} />
          </PointAnnotation>
        ))}
        
        <LocationPuck
            visible={true}
            pulsing={ isNavigating ? {isEnabled: true, color: 'rgba(0,122,255,0.3)'} : {isEnabled: true} } // More prominent pulsing during navigation
        />
      </MapView>

      <HamburgerMenuButton onPress={() => dispatch({ type: "TOGGLE_SIDE_MENU" })} />
      <IncidentReportButton onPress={handleOpenReportModal} isSignedIn={isSignedIn} onLoginRequired={handleShowLoginPrompt} />
      <QRCodeButton onPress={handleQRScan} />

      {!isNavigating && ( // Show search FAB only when not navigating
          <FloatingActionButton
            iconName="search-location"
            onPress={toggleSearchUI}
            visible={state.uiMode === "map"} // Only visible in pure map mode
            backgroundColor="#4285F4"
            size="medium"
            style={{ bottom: 20, left: 20 }}
          />
      )}

      {globalTrafficLevel !== "unknown" && !isNavigating && ( // Show traffic only when not navigating actively on instruction UI
          <TrafficStatusIndicator
            trafficLevel={globalTrafficLevel}
            compact={false}
            style={{ position: "absolute", top: 50, right: 120, zIndex: 10 }}
          />
      )}

      <SearchAndRouteControl
        userLocation={userLocation} // Pass current user location for origin calculation
        onDestinationSelected={handleDestinationSelected}
        onStartNavigation={handleUIStartNavigation}
        onCancelSearch={handleCancelSearch}
        onRouteSelected={handleUIRouteSelected}
        calculateRoutes={calculateRoutes} // Pass the function from useRoute
        loading={routeHookLoading}
        visible={isSearchUIVisible}
        routeFeatures={routeFeatures}
        selectedRoute={selectedRoute}
        alternateRoutes={alternateRoutes}
        selectedRouteIndex={selectedRouteIdxState}
        setSelectedRouteIndex={setSelectedRouteIdxState}
      />

      {isNavigating && selectedRoute && (
        <NavigationInterface
          route={selectedRoute}
          instruction={displayedInstruction}
          distanceToNext={distanceToNextManeuver}
          onCancelNavigation={handleUICancelNavigation}
          onRecalculateRoute={recalculateRoute} // Pass the main recalculateRoute from useRoute
          routeFeatures={routeFeatures && routeFeatures["primary"] ? routeFeatures["primary"] : undefined}
        />
      )}

      {reportModalVisible && (
        <ReportAlertButton
          userLocation={ liveUserLocation ? { latitude: liveUserLocation[1], longitude: liveUserLocation[0] } : null }
          isVisible={reportModalVisible}
          onClose={handleCloseReportModal}
        />
      )}
      <LoginRequiredModal visible={loginPromptVisible} onClose={handleCloseLoginPrompt} onNavigateToLogin={navigateToLogin} />
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
      <PinInfoModal selectedPin={state.selectedPin} onClose={() => dispatch({ type: "SELECT_PIN", payload: null })} />

      {routeHookError && ( // Display errors from the useRoute hook
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{routeHookError}</Text>
        </View>
      )}
      { (routeHookLoading || state.isInitializing) && // Combined loading indicator
        <View style={styles.fullScreenLoading}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.fullScreenLoadingText}>
                {state.isInitializing ? "Initialisation..." : "Chargement..."}
            </Text>
        </View>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5FCFF" },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5FCFF" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#555" },
  destinationMarker: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(59, 130, 246, 0.3)",
    justifyContent: "center", alignItems: "center",
  },
  destinationMarkerInner: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: "#3b82f6",
    borderWidth: 2, borderColor: "white",
  },
  errorContainer: {
    position: "absolute", top: 60, left: 20, right: 20, backgroundColor: "rgba(220, 53, 69, 0.9)",
    padding: 12, borderRadius: 8, alignItems: "center", zIndex: 2000,
  },
  errorText: { color: "white", fontWeight: "bold", textAlign: "center" },
  fullScreenLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Ensure it's on top
  },
  fullScreenLoadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  }
});

export default Map;