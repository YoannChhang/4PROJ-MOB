// app/index.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useReducer,
} from "react";
import { StyleSheet, View, ActivityIndicator, Text, Alert } from "react-native";
import Mapbox, { MapView } from "@rnmapbox/maps";
import { useRouter } from "expo-router";
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

import MapDisplay from "@/components/mapbox/display/MapDisplay";
import MapControlsOverlay from "@/components/mapbox/display/MapControlsOverlay";
import MapModals from "@/components/mapbox/display/MapModals";
import MapFeedbackIndicators from "@/components/mapbox/display/MapFeedbackIndicators";
import { useNearbyPinProximity } from "@/hooks/useNearbyPinProximity";
import { usePins } from "@/providers/PinProvider";

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

interface CameraConfig {
  centerCoordinate?: [number, number];
  zoomLevel: number;
  animationMode: "flyTo" | "easeTo" | "linearTo" | "moveTo" | undefined;
  animationDuration: number;
  pitch?: number;
  heading?: number;
  isManuallyControlled?: boolean;
}

const PIN_PROMPT_TIMEOUT_MS = 20 * 1000;

const Map = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { isSignedIn, userData, updatePreferences } = useUser();
  const { removePin: removeAlertPin } = usePins();
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const [isPinConfirmationModalVisible, setIsPinConfirmationModalVisible] =
    useState(false);
  const [loginPromptVisible, setLoginPromptVisible] = useState(false);
  const { qrData, setQRData } = useQRCode();
  const qrDataProcessed = useRef(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [selectedRouteIdxState, setSelectedRouteIdxState] = useState(0);
  const isQrRouteActive = useRef(false);

  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    zoomLevel: 13,
    animationMode: "flyTo",
    animationDuration: 1200,
    isManuallyControlled: false,
  });

  const [preferences, setPreferences] = useState<RoutingPreference[]>([
    {
      id: "avoid_tolls",
      label: "Éviter les péages",
      enabled: userData?.preferences?.avoid_tolls || false,
    },
    {
      id: "avoid_highways",
      label: "Éviter les autoroutes",
      enabled: userData?.preferences?.avoid_highways || false,
    },
    {
      id: "avoid_unpaved",
      label: "Éviter les routes non goudronnées",
      enabled: userData?.preferences?.avoid_unpaved || false,
    },
  ]);

  const [forceRouteSelectionMode, setForceRouteSelectionMode] = useState(false);

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading: routeHookLoading,
    error: routeHookError,
    isNavigating,
    traveledCoords,
    displayedInstruction,
    distanceToNextManeuver,
    startNavigation,
    stopNavigation,
    setRouteExcludes,
    routeFeatures,
    recalculateRoute,
    isRerouting,
    remainingDistance,
    remainingDuration,
    estimatedArrival,
  } = useRoute(userLocation, state.destination);

  const revertToUserPreferencesIfQrActive = useCallback(
    (reason: string) => {
      if (isQrRouteActive.current) {
        console.log(`${reason}. Reverting to user preferences for excludes.`);
        const userPrefsExcludes = getExcludesFromPreferences(
          userData?.preferences
        );
        setRouteExcludes(
          userPrefsExcludes.length > 0 ? userPrefsExcludes : undefined
        );
        isQrRouteActive.current = false;
      }
    },
    [userData?.preferences, setRouteExcludes]
  );

  useEffect(() => {
    if (userData?.preferences && !isQrRouteActive.current) {
      const userPrefsExcludes = getExcludesFromPreferences(
        userData.preferences
      );
      setRouteExcludes(
        userPrefsExcludes.length > 0 ? userPrefsExcludes : undefined
      );
    }
    if (userData?.preferences) {
      const newPrefsUI = [
        {
          id: "avoid_tolls",
          label: "Éviter les péages",
          enabled: !!userData.preferences.avoid_tolls,
        },
        {
          id: "avoid_highways",
          label: "Éviter les autoroutes",
          enabled: !!userData.preferences.avoid_highways,
        },
        {
          id: "avoid_unpaved",
          label: "Éviter les routes non goudronnées",
          enabled: !!userData.preferences.avoid_unpaved,
        },
      ];
      setPreferences(newPrefsUI);
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
          Alert.alert(
            "Localisation Requise",
            "Veuillez activer l'accès à la localisation."
          );
        const onLocationUpdate = (loc: [number, number]) =>
          setUserLocation(loc);
        locationTracker.on("locationUpdate", onLocationUpdate);
        const initialLoc = await locationTracker.getLastKnownLocation();
        if (initialLoc) setUserLocation(initialLoc);
        dispatch({ type: "INITIALIZE_COMPLETE" });
      } catch (error) {
        dispatch({ type: "INITIALIZE_COMPLETE" });
        Alert.alert(
          "Erreur",
          "Échec de l'initialisation des services de l'application."
        );
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
      revertToUserPreferencesIfQrActive("QR-initiated navigation ended");
    }
  }, [isNavigating, state.uiMode, revertToUserPreferencesIfQrActive]);

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
        setForceRouteSelectionMode(true); // Force route-selection mode for QR

        if (qrData.hasOwnProperty("excludes")) {
          const qrSpecificExcludes =
            qrData.excludes && qrData.excludes.length > 0
              ? qrData.excludes
              : undefined;
          setRouteExcludes(qrSpecificExcludes);
          isQrRouteActive.current = true;
          console.log(
            "QR Route: Applying excludes from QR data:",
            qrSpecificExcludes
          );
        } else {
          revertToUserPreferencesIfQrActive(
            "New QR scan without excludes received"
          );
          // isQrRouteActive.current will be set to false by the revert function
          console.log(
            "QR Route: 'excludes' not specified in QR. Using/Reverting to user preferences."
          );
        }

        setCameraConfig(
          (prev) =>
            ({
              ...prev,
              centerCoordinate: qrData.toCoords,
              zoomLevel: 14,
              isManuallyControlled: true,
            } as CameraConfig)
        );

        dispatch({ type: "SET_DESTINATION", payload: qrData.toCoords });

        setCameraConfig(
          (prev) =>
            ({
              ...prev,
              centerCoordinate: qrData.toCoords,
              zoomLevel: 14,
              isManuallyControlled: true,
            } as CameraConfig)
        );
      } else
        Alert.alert("Erreur de Code QR", "Données d'itinéraire invalides.");

      setTimeout(() => {
        setQRData(null);
        qrDataProcessed.current = false;
        setCameraConfig(
          (prev) => ({ ...prev, isManuallyControlled: false } as CameraConfig)
        );
        setForceRouteSelectionMode(false); // Reset after showing
      }, 1500);
    }
  }, [
    qrData,
    userLocation,
    setQRData,
    setSelectedRoute,
    setAlternateRoutes,
    setRouteExcludes,
    revertToUserPreferencesIfQrActive,
  ]);

  const alertPinsLocation = useMemo(
    () =>
      userLocation
        ? { latitude: userLocation[1], longitude: userLocation[0] }
        : null,
    [userLocation]
  );
  const { pins: alertPinsFromHook } = useAlertPins(alertPinsLocation);

  const { pinForConfirmationAttempt, confirmPinHandled } =
    useNearbyPinProximity(
      userLocation,
      alertPinsFromHook,
      isPinConfirmationModalVisible
    );

  useEffect(() => {
    if (pinForConfirmationAttempt && !isPinConfirmationModalVisible) {
      console.log(
        `[AppIndex] Pin ${pinForConfirmationAttempt.id} identified by proximity hook. Showing modal.`
      );
      setIsPinConfirmationModalVisible(true);
    } else if (!pinForConfirmationAttempt && isPinConfirmationModalVisible) {
      setIsPinConfirmationModalVisible(false);
    }
  }, [pinForConfirmationAttempt, isPinConfirmationModalVisible]);

  const handlePinConfirmationResponse = useCallback(
    async (isStillThere: boolean) => {
      const pinThatWasConfirmed = pinForConfirmationAttempt;

      if (pinThatWasConfirmed) {
        console.log(
          `[AppIndex] User response for pin ${pinThatWasConfirmed.id}: ${
            isStillThere ? "Still there" : "Not there"
          }`
        );
        if (!isStillThere && isSignedIn) {
          try {
            await removeAlertPin(pinThatWasConfirmed.id);
            console.log(
              `[AppIndex] Pin ${pinThatWasConfirmed.id} removed successfully.`
            );
          } catch (err) {
            console.error(
              `[AppIndex] Failed to remove pin ${pinThatWasConfirmed.id}:`,
              err
            );
            Alert.alert(
              "Erreur",
              "Impossible de supprimer le signalement. Veuillez réessayer plus tard."
            );
          }
        }
        confirmPinHandled(pinThatWasConfirmed.id);
      } else {
        console.warn(
          "[AppIndex] handlePinConfirmationResponse called but pinForConfirmationAttempt was null when modal closed."
        );
      }
    },
    [pinForConfirmationAttempt, removeAlertPin, confirmPinHandled, isSignedIn]
  );

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
      revertToUserPreferencesIfQrActive(
        "QR-initiated route planning cancelled by toggling search UI"
      );
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
    revertToUserPreferencesIfQrActive,
  ]);

  const handleToggleSideMenu = useCallback(() => {
    if (state.isSideMenuOpen) {
      dispatch({ type: "CLOSE_SIDE_MENU" });
      if (!isNavigating) {
        setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
      }
    } else {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" });
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
        revertToUserPreferencesIfQrActive(
          "QR-initiated route planning cancelled by opening side menu"
        );
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
    revertToUserPreferencesIfQrActive,
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

  const handlePinSelectionForLayer = useCallback(
    (pin: PinRead) => {
      if (state.uiMode === "search" || state.uiMode === "route-selection") {
        dispatch({ type: "HIDE_SEARCH" });
        setSelectedRoute(null);
        setAlternateRoutes([]);
        setSelectedRouteIdxState(0);
        revertToUserPreferencesIfQrActive(
          "QR-initiated route planning cancelled by selecting a pin"
        );
      }
      if (state.isSideMenuOpen) dispatch({ type: "CLOSE_SIDE_MENU" });
      dispatch({ type: "SELECT_PIN", payload: pin });
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: [pin.longitude, pin.latitude],
        isManuallyControlled: true,
      }));
    },
    [
      state.uiMode,
      state.isSideMenuOpen,
      setSelectedRoute,
      setAlternateRoutes,
      revertToUserPreferencesIfQrActive,
    ]
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
      revertToUserPreferencesIfQrActive("Manual search initiated after QR");
      dispatch({ type: "SET_DESTINATION", payload: coords });
      setSelectedRouteIdxState(0);
      setCameraConfig((prev) => ({
        ...prev,
        centerCoordinate: coords,
        zoomLevel: 14,
        isManuallyControlled: true,
      }));
    },
    [revertToUserPreferencesIfQrActive]
  );

  const handleCancelSearchUIMode = useCallback(() => {
    dispatch({ type: "HIDE_SEARCH" });
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
    revertToUserPreferencesIfQrActive(
      "QR-initiated route planning cancelled by explicit cancel"
    );
  }, [setSelectedRoute, setAlternateRoutes, revertToUserPreferencesIfQrActive]);

  const handleUIStartNavigation = useCallback(async () => {
    if (!selectedRoute) {
      Alert.alert("Erreur", "Aucun itinéraire sélectionné.");
      return;
    }
    await startNavigation();
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
  }, [selectedRoute, startNavigation]);

  const handleUICancelNavigation = useCallback(() => {
    stopNavigation();
    setSelectedRoute(null);
    setAlternateRoutes([]);
    setSelectedRouteIdxState(0);
    qrDataProcessed.current = false;
    setCameraConfig((prev) => ({ ...prev, isManuallyControlled: false }));
    // The useEffect watching `isNavigating` will handle reverting preferences
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

      if (isSignedIn) {
        updatePreferences(newPrefsObj).catch((err) =>
          console.error("Pref update fail:", err)
        );
      }
      if (!isQrRouteActive.current) {
        const newExcludes = getExcludesFromPreferences(newPrefsObj);
        setRouteExcludes(newExcludes.length > 0 ? newExcludes : undefined);
      } else {
        console.log(
          "Preference changed, but QR route is active. Excludes will update after QR session ends."
        );
      }
    },
    [preferences, setRouteExcludes, isSignedIn, updatePreferences]
  );

  const handleRecalculateButtonPressed = useCallback(
    () => recalculateRoute(),
    [recalculateRoute]
  );

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
        onRouteSelected={(newSelectedRoute, newAlternates) => {
          setSelectedRoute(newSelectedRoute);
          setAlternateRoutes(
            newAlternates.filter((r) => r !== newSelectedRoute)
          );
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
        forceRouteSelectionMode={forceRouteSelectionMode} // Pass prop
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
          remainingDistance={remainingDistance}
          remainingDuration={remainingDuration}
          estimatedArrival={estimatedArrival}
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
        pinConfirmationModalVisible={isPinConfirmationModalVisible}
        pinForConfirmation={pinForConfirmationAttempt}
        onPinConfirmationResponse={handlePinConfirmationResponse}
        pinConfirmationTimeout={PIN_PROMPT_TIMEOUT_MS}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#555" },
});

export default Map;
