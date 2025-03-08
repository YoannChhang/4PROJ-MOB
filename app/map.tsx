import React, { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox, { MapView, Camera, LocationPuck } from "@rnmapbox/maps";
import MapboxSearchBar from "@/components/mapbox/MapboxSearchBar";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

const App = () => {
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    Mapbox.setTelemetryEnabled(false);
  }, []);

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
            followUserLocation={!selectedLocation}
            followZoomLevel={16}
            centerCoordinate={selectedLocation ? [selectedLocation.longitude, selectedLocation.latitude] : undefined}
            zoomLevel={selectedLocation ? 16 : undefined}
          />
          <LocationPuck />
        </MapView>
      </View>

      <MapboxSearchBar onSelectLocation={(location) => setSelectedLocation(location)} />
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