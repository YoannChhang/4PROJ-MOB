import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { 
  StyleSheet, 
  View, 
  Dimensions
} from "react-native";
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
import useRoute from "@/hooks/useRoute";
import ItinerarySelect from "@/components/mapbox/ItinerarySelect";
import { usePathname, useRouter } from "expo-router";
import NavigationCard from "@/components/mapbox/NavigationCard";
import NavigationControlCard from "@/components/mapbox/NavigationControlCard";
import { useQRCode } from "@/providers/QRCodeProvider";
import { usePins } from "@/providers/PinProvider";
import AlertPin from "@/components/mapbox/AlertPin";
import ReportAlertButton from "@/components/mapbox/ReportAlertButton";
import useAlertPins from "@/hooks/useAlertPins";
import { PinRead } from "@/types/api";
import PinWithCallout from "@/components/mapbox/PinWithCallout";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
  const mapRef = useRef<MapView>(null);

  // Use QR code context instead of URL params
  const { qrData, setQRData } = useQRCode();

  // Flag to track if QR data was processed
  const qrDataProcessed = useRef(false);

  // Track selected alert pin
  const [selectedPinId, setSelectedPinId] = useState<number | null>(null);

  const handleMapPress = () => {
    // Close any open callouts when tapping on the map
    if (selectedPinId !== null) {
      setSelectedPinId(null);
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

  const fetchUserLocation = async () => {
    try {
      console.log("Fetching user location...");
      const location = await Mapbox.locationManager.getLastKnownLocation();
      if (location) {
        console.log("User location found:", {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setCurrUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        console.log("User location not available");
      }
    } catch (error) {
      console.error("Error fetching user location:", error);
    }
  };

  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
    fetchUserLocation();
  }, []);

  // Reset QR data processed flag when QR data is null
  useEffect(() => {
    if (!qrData) {
      qrDataProcessed.current = false;
    }
  }, [qrData]);

  useEffect(() => {
    if (selectedLocation) {
      console.log("Selected location changed, fetching user location");
      fetchUserLocation();
    }
  }, [selectedLocation]);

  const origin = useMemo(
    () =>
      currUserLocation
        ? ([currUserLocation.longitude, currUserLocation.latitude] as [
            number,
            number
          ])
        : null,
    [currUserLocation]
  );

  const destination = useMemo(
    () =>
      selectedLocation
        ? ([selectedLocation.longitude, selectedLocation.latitude] as [
            number,
            number
          ])
        : null,
    [selectedLocation]
  );

  const {
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    chooseRoute,
    traveledCoords,
    loading,
    error,
    liveUserLocation,
    isNavigating,
    startNavigation,
    stopNavigation,
    currentInstruction,
    setRouteExcludes,
  } = useRoute(origin, destination);

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
        setRouteExcludes(undefined);
      }

      // Refresh user location
      fetchUserLocation();

      // Clear QR data to prevent reprocessing
      setTimeout(() => {
        setQRData(null);
      }, 1000);
    }
  }, [qrData, setRouteExcludes, setQRData]);

  // Toggle settings modal
  const toggleSettings = useCallback(() => {
    setIsSettingsVisible((prev) => !prev);
  }, []);

  // Handle QR code button press
  const handleQRScan = () => {
    router.push({
      pathname:
        "/qr-scanner" as any /* Type assertion to bypass type checking */,
    });
  };

  // Handle pin selection
  const handlePinSelected = (pin: PinRead) => {
    setSelectedPinId(pin.id);
  };

  // Clear route flag when canceling navigation
  const handleCancelNavigation = useCallback(() => {
    stopNavigation();
    setSelectedLocation(null);
    setSelectedRoute(null);
    setAlternateRoutes([]);
    // Clear QR data
    setQRData(null);
    qrDataProcessed.current = false;
  }, [stopNavigation, setQRData]);

  // Force route calculation when QR code is processed and we have coordinates
  useEffect(() => {
    if (qrDataProcessed.current && currUserLocation && selectedLocation) {
      console.log("Ready to calculate route after QR code scan:");
      console.log("- Origin:", [
        currUserLocation.longitude,
        currUserLocation.latitude,
      ]);
      console.log("- Destination:", [
        selectedLocation.longitude,
        selectedLocation.latitude,
      ]);

      // At this point, we should have everything needed for route calculation
      // The route calculation is normally triggered by changes to origin/destination
      // in the useRoute hook, but we'll force a refresh of those values here:

      // Create a slight delay to ensure all state updates have propagated
      setTimeout(() => {
        // Force a recalculation by creating new coordinate objects
        const refreshedOrigin = {
          latitude: currUserLocation.latitude,
          longitude: currUserLocation.longitude,
        };
        setCurrUserLocation(refreshedOrigin);
      }, 500);
    }
  }, [qrDataProcessed.current, currUserLocation, selectedLocation]);

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
            <LocationPuck />
            
            {/* Render pins with their callouts directly attached */}
            {pins.map((pin) => (
              <PinWithCallout
                key={`pin-with-callout-${pin.id}`}
                pin={pin}
                onSelectPin={handlePinSelected}
                isSelected={selectedPinId === pin.id}
                onCalloutClose={() => setSelectedPinId(null)}
              />
            ))}
          </MapView>
        </View>

        <MapboxSearchBar
          selectedLocation={selectedLocation}
          onSelectLocation={(location) => setSelectedLocation(location)}
        />

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
          onStartNavigation={() => {
            startNavigation();
          }}
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
          style={{ bottom: isNavigating ? 160 : 60 }} // Position below search bar
        />
        {/* Settings Button and Modal */}
        <SettingsButton
          onPress={toggleSettings}
          style={{ bottom: isNavigating ? 110 : 10 }}
        />
        <ReportAlertButton userLocation={currUserLocation} />
        <SettingsModal
          isVisible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          toLogin={() => {
            if (pathname == "/auth") return;
            router.push("/auth");
          }}
        />
        {isNavigating && selectedRoute && (
          <>
            <NavigationCard
              route={selectedRoute}
              instruction={currentInstruction}
            />
            <NavigationControlCard
              route={selectedRoute}
              onCancelNavigation={handleCancelNavigation}
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
  }
});

export default Map;