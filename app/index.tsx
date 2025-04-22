import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import useRoute from "@/hooks/useRoute";
import ItinerarySelect from "@/components/mapbox/ItinerarySelect";
import { usePathname, useRouter, useLocalSearchParams } from "expo-router";
import NavigationCard from "@/components/mapbox/NavigationCard";
import NavigationControlCard from "@/components/mapbox/NavigationControlCard";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  
  // Ref to track if initial QR params have been processed
  const initialQrParamsProcessed = useRef(false);

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
      const location = await Mapbox.locationManager.getLastKnownLocation();
      if (location) {
        setCurrUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
    fetchUserLocation();
  }, []);

  // Process URL parameters if they exist and haven't been processed yet
  useEffect(() => {
    if (
      params.qrScanned === 'true' && 
      params.fromLng && 
      params.fromLat && 
      params.toLng && 
      params.toLat && 
      !initialQrParamsProcessed.current
    ) {
      initialQrParamsProcessed.current = true;
      
      // Set destination from QR code
      setSelectedLocation({
        latitude: Number(params.toLat),
        longitude: Number(params.toLng),
      });
      
      // If QR code includes a specific origin different from user's location
      // Note: We might want to add UI to ask if user wants to use their current location or the QR origin
      if (params.fromLng !== undefined && params.fromLat !== undefined) {
        setCurrUserLocation({
          latitude: Number(params.fromLat),
          longitude: Number(params.fromLng),
        });
      }
    }
  }, [params, currUserLocation]);

  useEffect(() => {
    if (selectedLocation) {
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

  // Parse excludes from QR code params
  const routeExcludes = useMemo(() => {
    if (params.excludes && typeof params.excludes === 'string') {
      return params.excludes.split(',');
    }
    return undefined;
  }, [params.excludes]);

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
  
  // Pass route excludes to useRoute
  useEffect(() => {
    if (routeExcludes) {
      setRouteExcludes(routeExcludes);
    }
  }, [routeExcludes, setRouteExcludes]);

  // Toggle settings modal
  const toggleSettings = useCallback(() => {
    setIsSettingsVisible((prev) => !prev);
  }, []);

  // Handle QR code button press
  const handleQRScan = () => {
    router.push({ pathname: "/qr-scanner" as any /* Type assertion to bypass type checking */ });
  };

  return (
    <>
      <View style={styles.page}>
        <View style={styles.container}>
          <MapView
            style={styles.map}
            styleURL="mapbox://styles/mapbox/navigation-night-v1"
            logoEnabled={false}
            scaleBarEnabled={false}
            attributionPosition={{
              bottom: isNavigating ? 130 : 8,
              left: 8,
            }}
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
          </MapView>
        </View>

        <MapboxSearchBar
          selectedLocation={selectedLocation}
          onSelectLocation={(location) => setSelectedLocation(location)}
        />
        
        {/* QR Code Scan Button */}
        <QRScanButton 
          onPress={handleQRScan} 
          style={{ top: 100 }} // Position below search bar
        />

        <ItinerarySelect
          selectedRoute={selectedRoute}
          alternateRoutes={alternateRoutes}
          chooseRoute={chooseRoute}
          onBack={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
            // Clear URL params when canceling
            router.setParams({});
            initialQrParamsProcessed.current = false;
          }}
          onStartNavigation={() => {
            startNavigation();
          }}
          onPlanLater={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
            // Clear URL params when canceling
            router.setParams({});
            initialQrParamsProcessed.current = false;
          }}
        />

        {/* Settings Button and Modal */}
        <SettingsButton
          onPress={toggleSettings}
          style={{ bottom: isNavigating ? 130 : 10 }}
        />
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
              onCancelNavigation={() => {
                stopNavigation();
                setSelectedLocation(null);
                setSelectedRoute(null);
                setAlternateRoutes([]);
                // Clear URL params when canceling navigation
                router.setParams({});
                initialQrParamsProcessed.current = false;
              }}
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