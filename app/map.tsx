import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  PointAnnotation,
  UserTrackingMode,
} from "@rnmapbox/maps";
import MapboxSearchBar from "@/components/mapbox/MapboxSearchBar";
import useRoute from "@/hooks/useRoute";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

const App = () => {
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // origin should be the user's location
  const [currUserLocation, setCurrUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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
    selectedRouteCoords,
    alternateRoutesCoords,
    traveledCoords,
    loading,
    error,
    liveUserLocation,
    isNavigating,
    startNavigation,
    stopNavigation,
  } = useRoute(origin, destination);

  return (
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
            followZoomLevel={isNavigating ? 14 : undefined}
            bounds={
              selectedRouteCoords.length > 0
                ? {
                    ne: selectedRouteCoords[0], // First coordinate (northeast)
                    sw: selectedRouteCoords[selectedRouteCoords.length - 1], // Last coordinate (southwest)
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

          {!isNavigating &&
            alternateRoutesCoords.map((route, index) => (
              <Mapbox.ShapeSource
                id={`routeSource-${index}`}
                key={`routeSource-${index}`}
                shape={{ type: "LineString", coordinates: route }}
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

          {selectedRouteCoords.length > 0 && (
            <Mapbox.ShapeSource
              id="routeSource"
              shape={{ type: "LineString", coordinates: selectedRouteCoords }}
            >
              <Mapbox.LineLayer
                id="routeFill"
                style={{ lineColor: "blue", lineWidth: 3 }}
              />
            </Mapbox.ShapeSource>
          )}

          <LocationPuck />
        </MapView>
      </View>

      <MapboxSearchBar
        onSelectLocation={(location) => setSelectedLocation(location)}
      />
    </View>
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

export default App;
