import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Route } from "@/types/mapbox";
import {
  formatDistance,
  formatDuration,
  formatTime,
} from "@/components/navigation/RouteStats";

interface NavigationControlCardProps {
  route: Route;
  onCancelNavigation: () => void;
}

const NavigationControlCard: React.FC<NavigationControlCardProps> = ({
  route,
  onCancelNavigation,
}) => {
  const estimatedArrival = new Date(Date.now() + route.duration * 1000);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>
            ETA • {formatDistance(route.distance)}
          </Text>
          <View style={styles.statsContainer}>
            <Text style={styles.etaTime}>{formatDuration(route.duration)}</Text>
            <Text style={styles.stats}>
              {" • "}
              {formatTime(estimatedArrival)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancelNavigation}
        >
          <FontAwesome5 name="times" size={20} color="#fff" />
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  stats: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  content: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  etaContainer: {
    flex: 1,
  },
  etaLabel: {
    fontSize: 14,
    color: "gray",
  },
  etaTime: {
    fontSize: 20,
    fontWeight: "bold",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff4444",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default NavigationControlCard;
