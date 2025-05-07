import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";

interface TrafficStatusIndicatorProps {
  trafficLevel: "low" | "moderate" | "heavy" | "severe" | "unknown";
  compact?: boolean;
  style?: any;
}

const TrafficStatusIndicator: React.FC<TrafficStatusIndicatorProps> = ({
  trafficLevel,
  compact = false,
  style,
}) => {
  // Don't render if traffic data is unknown
  if (trafficLevel === "unknown") {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        trafficLevel === "low"
          ? styles.low
          : trafficLevel === "moderate"
          ? styles.moderate
          : trafficLevel === "heavy" || trafficLevel === "severe"
          ? styles.heavy
          : styles.unknown,
        compact && styles.compact,
        style,
      ]}
    >
      <FontAwesome5
        name="traffic-light"
        size={compact ? 12 : 16}
        color="#fff"
      />

      {!compact && (
        <Text style={styles.text}>
          {trafficLevel === "low"
            ? "Trafic fluide"
            : trafficLevel === "moderate"
            ? "Trafic modéré"
            : trafficLevel === "heavy" || trafficLevel === "severe"
            ? "Trafic dense"
            : "Trafic inconnu"}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#555",
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  low: {
    backgroundColor: "#4CAF50",
  },
  moderate: {
    backgroundColor: "#FFC107",
  },
  heavy: {
    backgroundColor: "#F44336",
  },
  unknown: {
    backgroundColor: "#9E9E9E",
  },
  text: {
    marginLeft: 8,
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default TrafficStatusIndicator;
