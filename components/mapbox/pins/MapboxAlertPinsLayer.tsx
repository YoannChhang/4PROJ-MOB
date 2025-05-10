// components/mapbox/MapboxAlertPinsLayer.tsx
import React, { useMemo, useCallback } from "react";
import { Images, ShapeSource, SymbolLayer } from "@rnmapbox/maps";
import { PinRead, PinType } from "@/types/api";
import type {
  FeatureCollection,
  Point,
  GeoJsonProperties as GenericGeoJsonProperties,
  Feature,
} from "geojson";

// --- Constants for pin images ---
const MAPBOX_PIN_IMAGE_ASSETS: Record<string, any> = {
  obstacle_icon: require("@/assets/images/pins/obstacle.png"),
  traffic_jam_icon: require("@/assets/images/pins/traffic_jam.png"),
  cop_icon: require("@/assets/images/pins/cop.png"),
  accident_icon: require("@/assets/images/pins/accident.png"),
  roadwork_icon: require("@/assets/images/pins/roadwork.png"),
  default_pin_icon: require("@/assets/images/pins/obstacle.png"),
};

const getPinImageKey = (type: PinType): string => {
  switch (type) {
    case "obstacle":
      return "obstacle_icon";
    case "traffic_jam":
      return "traffic_jam_icon";
    case "cop":
      return "cop_icon";
    case "accident":
      return "accident_icon";
    case "roadwork":
      return "roadwork_icon";
    default:
      return "default_pin_icon";
  }
};

// @ts-ignore
interface PinFeatureProperties extends GenericGeoJsonProperties {
  pinId: string;
  pinType: PinType;
  icon: string;
  description?: string;
}

interface MapboxAlertPinsLayerProps {
  pins: PinRead[];
  onPinSelect: (pin: PinRead) => void;
  onClusterPress: (coordinates: [number, number]) => void;
}

const MapboxAlertPinsLayer: React.FC<MapboxAlertPinsLayerProps> = ({
  pins,
  onPinSelect,
  onClusterPress,
}) => {
  const geoJsonPins = useMemo((): FeatureCollection<
    Point,
    PinFeatureProperties
  > => {
    if (!pins || pins.length === 0) {
      return {
        type: "FeatureCollection", // Explicit literal type
        features: [], // Ensure features is an empty array of the correct feature type
      };
    }
    const features: Feature<Point, PinFeatureProperties>[] = pins.map(
      (pin) => ({
        type: "Feature", // Explicit literal type
        geometry: {
          type: "Point", // Explicit literal type
          coordinates: [pin.longitude, pin.latitude],
        },
        properties: {
          pinId: pin.id,
          pinType: pin.type,
          icon: getPinImageKey(pin.type),
          description: pin.description ?? undefined,
        },
      })
    );

    return {
      type: "FeatureCollection", // Explicit literal type
      features: features,
    };
  }, [pins]);

  const handleIndividualPinPress = useCallback(
    (event: any) => {
      if (event.features && event.features.length > 0) {
        const feature = event.features[0];
        // Check properties carefully as they come from the native side
        const props = feature.properties as PinFeatureProperties | undefined;
        if (props && props.pinId) {
          const selectedPinObject = pins.find((p) => p.id === props.pinId);
          if (selectedPinObject) {
            onPinSelect(selectedPinObject);
          }
        }
      }
    },
    [pins, onPinSelect]
  );

  const handleClusterFeaturePress = useCallback(
    (event: any) => {
      if (event.features && event.features.length > 0) {
        const feature = event.features[0];
        const props = feature.properties; // Native properties might not be strictly typed
        const geom = feature.geometry as Point | undefined; // Cast geometry

        if (props && props.cluster_id && geom?.coordinates) {
          onClusterPress(geom.coordinates as [number, number]);
        }
      }
    },
    [onClusterPress]
  );

  const onShapeSourcePress = useCallback(
    (e: any) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        if (feature.properties?.cluster_id) {
          // cluster_id is a known property for clusters
          handleClusterFeaturePress(e);
        } else if (feature.properties?.pinId) {
          // pinId is our custom property
          handleIndividualPinPress(e);
        }
      }
    },
    [handleClusterFeaturePress, handleIndividualPinPress]
  );

  if (!pins || pins.length === 0) {
    return null;
  }

  return (
    <>
      <Images images={MAPBOX_PIN_IMAGE_ASSETS} />
      <ShapeSource
        id="alertPinSource"
        shape={geoJsonPins} 
        cluster={true}
        clusterRadius={50}
        clusterMaxZoomLevel={14}
        onPress={onShapeSourcePress}
      >
        <SymbolLayer
          id="unclusteredAlertPins"
          filter={["!", ["has", "point_count"]]}
          style={{
            iconImage: ["get", "icon"],
            iconSize: 0.07,
            iconAllowOverlap: false,
            iconIgnorePlacement: false,
          }}
        />
      </ShapeSource>
    </>
  );
};

export default MapboxAlertPinsLayer;
