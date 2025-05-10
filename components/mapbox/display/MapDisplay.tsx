// components/map/MapDisplay.tsx
import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
  UserTrackingMode,
  PointAnnotation, // Corrected import
  ShapeSource,
  LineLayer,
} from "@rnmapbox/maps";
import Config from "react-native-config";
import { Route } from "@/types/mapbox";
import { PinRead } from "@/types/api";
import MapboxAlertPinsLayer from "../pins/MapboxAlertPinsLayer"; // Assuming this is in the same directory or adjust path

interface CameraConfig {
  centerCoordinate?: [number, number];
  zoomLevel: number;
  animationMode: "flyTo" | "easeTo" | "linearTo" | "moveTo" | undefined;
  animationDuration: number;
  pitch?: number;
  heading?: number;
  isManuallyControlled?: boolean;
}

interface MapDisplayProps {
  mapRef: React.RefObject<MapView>;
  cameraConfig: CameraConfig;
  selectedRoute: Route | null;
  alternateRoutes: Route[];
  selectedRouteIdxState: number;
  isNavigating: boolean;
  uiMode: "map" | "search" | "route-selection" | "navigation";
  traveledCoords: [number, number][];
  destination: [number, number] | null;
  alertPins: PinRead[];
  onMapPress: () => void;
  onPinSelect: (pin: PinRead) => void;
  onClusterPress: (coordinates: [number, number]) => void;
  selectedPin: PinRead | null; // Added to determine if user is just viewing map or interacting with a pin
}

const MapDisplay: React.FC<MapDisplayProps> = ({
  mapRef,
  cameraConfig,
  selectedRoute,
  alternateRoutes,
  selectedRouteIdxState,
  isNavigating,
  uiMode,
  traveledCoords,
  destination,
  alertPins,
  onMapPress,
  onPinSelect,
  onClusterPress,
  selectedPin,
}) => {
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      styleURL={
        Config.MAPBOX_STYLE_URL || "mapbox://styles/mapbox/navigation-night-v1"
      }
      logoEnabled={false}
      scaleBarEnabled={false}
      attributionPosition={{
        bottom:
          uiMode === "navigation" ? (Platform.OS === "ios" ? 160 : 130) : 8,
        right: 8,
      }}
      onPress={onMapPress}
    >
      <Camera
        centerCoordinate={cameraConfig.centerCoordinate}
        zoomLevel={cameraConfig.zoomLevel}
        animationMode={cameraConfig.animationMode}
        animationDuration={cameraConfig.animationDuration}
        pitch={cameraConfig.pitch}
        heading={cameraConfig.heading}
        followUserLocation={
          !cameraConfig.isManuallyControlled &&
          (isNavigating || (uiMode === "map" && !destination && !selectedPin))
        }
        followUserMode={
          isNavigating
            ? UserTrackingMode.FollowWithCourse
            : UserTrackingMode.Follow
        }
        followZoomLevel={isNavigating ? 17 : cameraConfig.zoomLevel}
        followPitch={isNavigating ? 45 : 0}
      />

      {/* Alternate Routes Rendering */}
      {uiMode === "route-selection" &&
        alternateRoutes &&
        alternateRoutes.map((altRoute, index) => (
          <ShapeSource
            id={`altRoute-${index}`}
            key={`altRoute-${index}`}
            shape={altRoute.geometry}
          >
            <LineLayer
              id={`altLine-${index}`}
              style={{
                lineColor:
                  selectedRouteIdxState === index + 1 ? "#2563eb" : "grey",
                lineWidth: selectedRouteIdxState === index + 1 ? 6 : 4,
                lineOpacity: 0.6,
              }}
            />
          </ShapeSource>
        ))}

      {/* Selected Route Rendering */}
      {selectedRoute && selectedRoute.geometry.coordinates.length > 0 && (
        <ShapeSource id="routeSource" shape={selectedRoute.geometry}>
          <LineLayer
            id="routeFill"
            style={{
              lineColor: isNavigating
                ? "#60a5fa"
                : uiMode === "route-selection" && selectedRouteIdxState === 0
                ? "#3b82f6"
                : uiMode === "route-selection"
                ? "grey"
                : "#3b82f6",
              lineWidth: isNavigating ? 7 : 6,
              lineCap: "round",
              lineJoin: "round",
              lineOpacity: isNavigating ? 0.85 : 0.75,
            }}
          />
        </ShapeSource>
      )}

      {/* Traveled Path */}
      {isNavigating && traveledCoords && traveledCoords.length > 1 && (
        <ShapeSource
          id="traveledRoute"
          shape={{ type: "LineString", coordinates: traveledCoords }}
        >
          <LineLayer
            id="traveledLine"
            style={{
              lineColor: "#9ca3af",
              lineWidth: 7,
              lineCap: "round",
              lineJoin: "round",
              lineOpacity: 0.9,
            }}
            aboveLayerID="routeFill"
          />
        </ShapeSource>
      )}

      {/* Destination Marker */}
      {destination && uiMode === "route-selection" && !isNavigating && (
        <PointAnnotation id="destinationLocation" coordinate={destination}>
          <View style={styles.destinationMarker}>
            <View style={styles.destinationMarkerInner} />
          </View>
        </PointAnnotation>
      )}

      <LocationPuck
        visible={true}
        pulsing={
          isNavigating
            ? { isEnabled: true, color: "rgba(0,122,255,0.3)" }
            : { isEnabled: true }
        }
        puckBearingEnabled={true}
        puckBearing="course"
      />

      <MapboxAlertPinsLayer
        pins={alertPins}
        onPinSelect={onPinSelect}
        onClusterPress={onClusterPress}
      />
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
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
});

export default MapDisplay;
