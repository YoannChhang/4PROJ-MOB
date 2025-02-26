import React, { Component } from "react";
import { StyleSheet, View } from "react-native";
import Mapbox, {
  MapView,
  Camera,
  UserLocation,
  LocationPuck,
} from "@rnmapbox/maps";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_SK as string);

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
    backgroundColor: "tomato",
  },
  map: {
    flex: 1,
  },
});

export default class App extends Component {
  componentDidMount() {
    Mapbox.setTelemetryEnabled(false);
  }

  render() {
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
            {/* Center camera on user location with zoom */}
            <Camera
              followUserLocation
              followZoomLevel={15} // Adjust the zoom level
            />
            {/* Display user location */}
            {/* <UserLocation/>    */}
            <LocationPuck />
          </MapView>
        </View>
      </View>
    );
  }
}
