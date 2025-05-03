import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";
import SettingsButton from "@/components/settings/SettingsButton";
import SettingsModal from "@/components/settings/SettingsModal";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  PointAnnotation,
  UserTrackingMode,
} from "@rnmapbox/maps";
import MapboxSearchBar from "@/components/mapbox/MapboxSearchBar";
import QRScanButton from "@/components/mapbox/QRScanButton";
import ItinerarySelect from "@/components/mapbox/ItinerarySelect";
import { usePathname, useRouter } from "expo-router";
import NavigationCard from "@/components/mapbox/NavigationCard";
import NavigationControlCard from "@/components/mapbox/NavigationControlCard";
import { useQRCode } from "@/providers/QRCodeProvider";
import SimplifiedAlertPin from "@/components/mapbox/SimplifiedAlertPin";
import ReportAlertButton from "@/components/mapbox/ReportAlertButton";
import useAlertPins from "@/hooks/useAlertPins";
import { PinRead } from "@/types/api";
import PinInfoModal from "@/components/mapbox/PinInfoModal";
import { useUser } from "@/providers/UserProvider";
import Config from "react-native-config";
import useRoute from "@/hooks/useRoute";
import locationTracker from "@/utils/locationTracker";
import ttsManager from "@/utils/ttsManager";
import * as Location from 'expo-location';
import { getExcludesFromPreferences } from "@/utils/routeUtils";

Mapbox.setAccessToken(Config.MAPBOX_PK as string);

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<MapView>(null);
  const { isSignedIn, userData } = useUser();

  // Use QR code context instead of URL params
  const { qrData, setQRData } = useQRCode();

  // Flag to track if QR data was processed
  const qrDataProcessed = useRef(false);

  // Track selected alert pin
  const [selectedPin, setSelectedPin] = useState<PinRead | null>(null);

  const handleMapPress = () => {
    // Close any open pin info when tapping on the map
    if (selectedPin !== null) {
      setSelectedPin(null);
    }
  };

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Origin should be the user's location
  const [currUserLocation, setCurrUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Settings modal state
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  // Initialize location tracking system
  useEffect(() => {
    const initLocation = async () => {
      try {
        // Initialize TTS
        await ttsManager.initialize();
        
        // Start location tracking
        await locationTracker.startTracking();
        
        // Get initial location
        const initialLocation = await locationTracker.getLastKnownLocation();
        if (initialLocation) {
          setCurrUserLocation({
            latitude: initialLocation[1],
            longitude: initialLocation[0],
          });
        }
        
        // Subscribe to location updates
        locationTracker.on('locationUpdate', (location) => {
          setCurrUserLocation({
            latitude: location[1],
            longitude: location[0],
          });
        });
      } catch (error) {
        console.error('Error initializing location and TTS:', error);
      }
    };

    initLocation();

    return () => {
      // Clean up resources when component unmounts
      locationTracker.cleanup();
      ttsManager.cleanup();
    };
  }, []);

  // Fetch pins when auth state changes if we have user location
  useEffect(() => {
    console.log("Auth state changed:", isSignedIn ? "Signed In" : "Signed Out");
    if (currUserLocation) {
      // This will trigger a pin refresh through the useAlertPins hook
      const refreshLocation = {
        ...currUserLocation,
      };
      setCurrUserLocation(refreshLocation);
    }
  }, [isSignedIn]);

  // Reset QR data processed flag when QR data is null
  useEffect(() => {
    if (!qrData) {
      qrDataProcessed.current = false;
    }
  }, [qrData]);

  // Format origins and destinations for useRoute hook
  const origin = useMemo<[number, number] | null>(() => 
    currUserLocation ? [currUserLocation.longitude, currUserLocation.latitude] : null,
  [currUserLocation]);

  const destination = useMemo<[number, number] | null>(() => 
    selectedLocation ? [selectedLocation.longitude, selectedLocation.latitude] : null,
  [selectedLocation]);

  // Use our new routing hook
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
    setRouteExcludes
  } = useRoute(origin, destination);

  // Set route excludes based on user preferences
  useEffect(() => {
    if (!userData?.preferences) return;
    
    const excludes = getExcludesFromPreferences(userData.preferences);
    setRouteExcludes(excludes.length > 0 ? excludes : undefined);
  }, [userData?.preferences, setRouteExcludes]);

  const { pins } = useAlertPins(currUserLocation);

  // Process QR code data if available
  useEffect(() => {
    if (qrData && !qrDataProcessed.current) {
      console.log("Processing QR code data:", qrData);
      qrDataProcessed.current = true;

      // Reset any existing routes
      setSelectedRoute(null);
      setAlternateRoutes([]);

      // Set the destination from QR code
      if (qrData.toCoords) {
        console.log("Setting destination from QR code:", qrData.toCoords);
        setSelectedLocation({
          latitude: qrData.toCoords[1],
          longitude: qrData.toCoords[0],
        });
      }

      // Set route excludes if present
      if (qrData.excludes && qrData.excludes.length > 0) {
        console.log("Setting excludes from QR code:", qrData.excludes);
        setRouteExcludes(qrData.excludes);
      } else {
        // Reset to user preferences if no excludes in QR
        console.log("No excludes in QR code, using user preferences");
        const excludes = getExcludesFromPreferences(userData?.preferences);
        setRouteExcludes(excludes.length > 0 ? excludes : undefined);
      }

      // Clear QR data to prevent reprocessing
      setTimeout(() => {
        setQRData(null);
      }, 1000);
    }
  }, [qrData, setRouteExcludes, setQRData, userData?.preferences]);

  // Toggle settings modal
  const toggleSettings = useCallback(() => {
    setIsSettingsVisible((prev) => !prev);
  }, []);

  // Handle QR code button press
  const handleQRScan = () => {
    router.push("/qr-scanner");
  };

  // Handle pin selection
  const handleSelectPin = (pin: PinRead) => {
    setSelectedPin(pin);
  };

  // Handle closing pin info modal
  const handleClosePinInfo = useCallback(() => {
    setSelectedPin(null);
  }, []);

  // Clear route flag when canceling navigation
  const handleCancelNavigation = useCallback(() => {
    stopNavigation();
    setSelectedLocation(null);
    // Clear QR data
    setQRData(null);
    qrDataProcessed.current = false;
  }, [stopNavigation, setQRData]);

  // Request background location permissions for navigation
  const requestBackgroundPermission = useCallback(async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Background location permission denied');
    } else {
      console.log('Background location permission granted');
    }
  }, []);

  // Handle starting navigation with permissions check
  const handleStartNavigation = useCallback(async () => {
    // Request background permissions on both platforms
    await requestBackgroundPermission();
    
    // Start navigation
    startNavigation();
  }, [startNavigation, requestBackgroundPermission]);

  // Handle route recalculation
  const handleRecalculateRoute = useCallback(() => {
    if (!currUserLocation || !selectedLocation) {
      console.warn("Cannot recalculate route: missing coordinates");
      return;
    }

    // Temporarily disable navigation mode
    setIsNavigating(false);
    
    // Announce rerouting
    ttsManager.speak("Recalcul d'itinéraire en cours");
    
    // Force a location update to trigger route recalculation
    setTimeout(() => {
      // This will trigger the useEffect in useRoute that fetches routes
      setCurrUserLocation({ ...currUserLocation });
      
      // Resume navigation after a short delay
      setTimeout(() => {
        setIsNavigating(true);
      }, 500);
    }, 1000);
  }, [currUserLocation, selectedLocation, setIsNavigating]);

  return (
    <>
      <View style={styles.page}>
        <View style={styles.container}>
          <MapView
            ref={mapRef}
            style={styles.map}
            styleURL="mapbox://styles/mapbox/navigation-night-v1"
            logoEnabled={false}
            scaleBarEnabled={false}
            attributionPosition={{
              bottom: isNavigating ? 130 : 8,
              left: 8,
            }}
            onPress={handleMapPress}
          >
            <Camera
              animationMode="flyTo"
              animationDuration={2000} // Smooth transition effect
              followUserLocation={isNavigating}
              followUserMode={"course" as UserTrackingMode}
              followZoomLevel={isNavigating ? 18 : undefined}
              bounds={
                selectedRoute &&
                (selectedRoute?.geometry.coordinates ?? []).length > 0
                  ? {
                      ne: selectedRoute.geometry.coordinates[0], // First coordinate (northeast)
                      sw: selectedRoute.geometry.coordinates[
                        selectedRoute?.geometry.coordinates.length - 1
                      ], // Last coordinate (southwest)
                      paddingLeft: 50,
                      paddingRight: 50,
                      paddingTop: 50,
                      paddingBottom: 50,
                    }
                  : currUserLocation // If no route, focus on user location
                  ? {
                      ne: [
                        currUserLocation.longitude + 0.01, // Slight padding to prevent being too close
                        currUserLocation.latitude + 0.01,
                      ],
                      sw: [
                        currUserLocation.longitude - 0.01,
                        currUserLocation.latitude - 0.01,
                      ],
                      paddingLeft: 50,
                      paddingRight: 50,
                      paddingTop: 50,
                      paddingBottom: 50,
                    }
                  : undefined
              }
            />

            {/* Route lines for alternative routes */}
            {!isNavigating &&
              alternateRoutes.map((route, index) => (
                <Mapbox.ShapeSource
                  id={`routeSource-${index}`}
                  key={`routeSource-${index}`}
                  shape={{
                    type: "LineString",
                    coordinates: route.geometry.coordinates,
                  }}
                  onPress={() => chooseRoute(route, selectedRoute)}
                >
                  <Mapbox.LineLayer
                    id={`routeFill-${index}`}
                    style={{ lineColor: "gray", lineWidth: 3 }}
                    belowLayerID="routeFill"
                  />
                </Mapbox.ShapeSource>
              ))}

            {/* Traveled portion of the selected route during navigation */}
            {isNavigating && traveledCoords.length > 0 && (
              <Mapbox.ShapeSource
                id="traveledRoute"
                shape={{ type: "LineString", coordinates: traveledCoords }}
              >
                <Mapbox.LineLayer
                  id="traveledLine"
                  style={{
                    lineColor: "gray",
                    lineWidth: 3,
                    lineCap: Mapbox.LineJoin.Round,
                    lineJoin: Mapbox.LineJoin.Round,
                  }}
                  aboveLayerID="routeFill"
                />
              </Mapbox.ShapeSource>
            )}

            {/* Selected route line */}
            {selectedRoute &&
              (selectedRoute.geometry.coordinates.length ?? []) > 0 && (
                <Mapbox.ShapeSource
                  id="routeSource"
                  shape={{
                    type: "LineString",
                    coordinates: selectedRoute.geometry.coordinates,
                  }}
                >
                  <Mapbox.LineLayer
                    id="routeFill"
                    style={{ lineColor: "blue", lineWidth: 3 }}
                  />
                </Mapbox.ShapeSource>
              )}

            {/* Destination marker */}
            {selectedLocation && (
              <PointAnnotation
                id="selectedLocation"
                coordinate={[
                  selectedLocation.longitude,
                  selectedLocation.latitude,
                ]}
              >
                <View />
              </PointAnnotation>
            )}

            {/* Render alert pins without callouts */}
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
            <LocationPuck />
          </MapView>
        </View>

        {/* Search bar component */}
        <MapboxSearchBar
          selectedLocation={selectedLocation}
          onSelectLocation={(location) => setSelectedLocation(location)}
        />

        {/* Route selection bottom sheet */}
        <ItinerarySelect
          selectedRoute={selectedRoute}
          alternateRoutes={alternateRoutes}
          chooseRoute={chooseRoute}
          onBack={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
            // Clear QR data
            setQRData(null);
            qrDataProcessed.current = false;
          }}
          onStartNavigation={handleStartNavigation}
          onPlanLater={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
            // Clear QR data
            setQRData(null);
            qrDataProcessed.current = false;
          }}
        />

        {/* QR Code Scan Button */}
        <QRScanButton
          onPress={handleQRScan}
          style={{ bottom: isNavigating ? 160 : 60 }}
        />

        {/* Settings Button */}
        <SettingsButton
          onPress={toggleSettings}
          style={{ bottom: isNavigating ? 110 : 10 }}
        />

        {/* Report Alert Button */}
        <ReportAlertButton userLocation={currUserLocation} />

        {/* Settings Modal */}
        <SettingsModal
          isVisible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          toLogin={() => {
            if (pathname == "/auth") return;
            router.push("/auth");
          }}
        />

        {/* Pin Info Modal */}
        <PinInfoModal selectedPin={selectedPin} onClose={handleClosePinInfo} />

        {/* Navigation UI components */}
        {isNavigating && selectedRoute && (
          <>
            <NavigationCard
              route={selectedRoute}
              instruction={currentInstruction}
              distanceToNext={distanceToNextManeuver}
            />
            <NavigationControlCard
              route={selectedRoute}
              onCancelNavigation={handleCancelNavigation}
              onRecalculateRoute={handleRecalculateRoute}
            />
          </>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  container: {
    height: "100%",
    width: "100%",
  },
  map: {
    flex: 1,
  },
});

export default Map;