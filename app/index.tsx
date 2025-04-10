import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import useRoute from "@/hooks/useRoute";
import ItinerarySelect from "@/components/mapbox/ItinerarySelect";
import { usePathname, useRouter } from "expo-router";
import NavigationCard from "@/components/mapbox/NavigationCard.tsx";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

const Map = () => {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // origin should be the user's location
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
  } = useRoute(origin, destination);

  // Toggle settings modal
  const toggleSettings = useCallback(() => {
    setIsSettingsVisible((prev) => !prev);
  }, []);

  return (
    <>
      <View style={styles.page}>
        <View style={styles.container}>
          <MapView
            style={styles.map}
            styleURL="mapbox://styles/mapbox/navigation-night-v1"
            logoEnabled={false}
            scaleBarEnabled={false}
            attributionPosition={{ bottom: 8, left: 8 }}
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

        <ItinerarySelect
          selectedRoute={selectedRoute}
          alternateRoutes={alternateRoutes}
          chooseRoute={chooseRoute}
          onBack={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
          }}
          onStartNavigation={() => {
            startNavigation();
          }}
          onPlanLater={() => {
            setSelectedLocation(null);
            setSelectedRoute(null);
            setAlternateRoutes([]);
          }}
        />

        {/* Settings Button and Modal */}
        <SettingsButton onPress={toggleSettings} />
        <SettingsModal
          isVisible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          toLogin={() => {
            if (pathname == "/auth") return;
            router.push("/auth");
          }}
        />
        {isNavigating && selectedRoute && (
          <NavigationCard
            route={selectedRoute}
            instruction={currentInstruction}
          />
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
