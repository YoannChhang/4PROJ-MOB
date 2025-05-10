// components/mapbox/SimplifiedAlertPin.tsx
import React from "react";
import { View, StyleSheet, Image, TouchableOpacity } from "react-native";
import { PinType } from "@/types/api";

interface AlertPinProps {
  type: PinType;
  onPress?: () => void;
}

const PIN_SIZE = 40; // Slightly smaller than before for better touch targeting

// Map pin types to their corresponding image paths
const PIN_IMAGES: Record<PinType, any> = {
  obstacle: require("@/assets/images/pins/obstacle.png"),
  traffic_jam: require("@/assets/images/pins/traffic_jam.png"),
  cop: require("@/assets/images/pins/cop.png"),
  accident: require("@/assets/images/pins/accident.png"),
  roadwork: require("@/assets/images/pins/roadwork.png"),
};

const SimplifiedAlertPin: React.FC<AlertPinProps> = ({ type, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      <Image
        source={PIN_IMAGES[type]}
        style={styles.image}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: PIN_SIZE,
    height: PIN_SIZE,
  },
});

export default SimplifiedAlertPin;
