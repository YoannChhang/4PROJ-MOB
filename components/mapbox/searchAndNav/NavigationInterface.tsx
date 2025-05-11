import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Route } from "@/types/mapbox";
import { RouteFeatures } from "@/types/mapbox";

interface NavigationInterfaceProps {
  route: Route | null;
  instruction: string;
  distanceToNext: number | null;
  onCancelNavigation: () => void;
  onRecalculateRoute: () => void;
  routeFeatures?: RouteFeatures; // Added route features
  remainingDistance?: number | null; // Live remaining distance
  remainingDuration?: number | null; // Live remaining duration
  estimatedArrival?: Date | null; // Live estimated arrival time
}

const NavigationInterface: React.FC<NavigationInterfaceProps> = ({
  route,
  instruction,
  distanceToNext,
  onCancelNavigation,
  onRecalculateRoute,
  routeFeatures,
  remainingDistance,
  remainingDuration,
  estimatedArrival,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [showOverview, setShowOverview] = useState(false);

  // Fade in the interface when it appears
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Format distance for display
  const formatDistance = (meters: number | null): string => {
    if (meters === null) return "";
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  // Format duration from seconds to human-readable
  const formatDuration = (seconds: number): string => {
    if (!seconds) return "";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  // Calculate estimated arrival time
  const getEstimatedArrival = (): string => {
    if (!route || !route.duration) return "";
    // Use the estimatedArrival prop if available (from useRoute)
    if (
      typeof estimatedArrival === "object" &&
      estimatedArrival instanceof Date
    ) {
      return estimatedArrival.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // Fallback: calculate from now + route.duration
    const arrivalTime = new Date(Date.now() + route.duration * 1000);
    return arrivalTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get appropriate icon for the instruction
  const getInstructionIcon = (): string => {
    const lowerInstruction = instruction.toLowerCase();

    if (lowerInstruction.includes("tournez à droite")) {
      return "arrow-right";
    } else if (lowerInstruction.includes("tournez à gauche")) {
      return "arrow-left";
    } else if (lowerInstruction.includes("tout droit")) {
      return "arrow-up";
    } else if (lowerInstruction.includes("demi-tour")) {
      return "undo";
    } else if (lowerInstruction.includes("rond-point")) {
      return "sync";
    } else if (lowerInstruction.includes("sortie")) {
      return "sign-out-alt";
    } else if (lowerInstruction.includes("arrivée")) {
      return "flag-checkered";
    } else {
      return "road";
    }
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.container}>
        {/* Traffic status indicator */}
        {routeFeatures?.trafficLevel &&
          routeFeatures.trafficLevel !== "unknown" && (
            <View
              style={[
                styles.trafficIndicator,
                routeFeatures.trafficLevel === "low"
                  ? styles.trafficLow
                  : routeFeatures.trafficLevel === "moderate"
                  ? styles.trafficModerate
                  : styles.trafficHeavy,
              ]}
            >
              <FontAwesome5 name="car" size={12} color="#fff" />
              <Text style={styles.trafficText}>
                {routeFeatures.trafficLevel === "low"
                  ? "Trafic fluide"
                  : routeFeatures.trafficLevel === "moderate"
                  ? "Trafic modéré"
                  : "Trafic dense"}
              </Text>
            </View>
          )}

        {/* Instruction card */}
        <View style={styles.instructionCard}>
          <View style={styles.instructionIconContainer}>
            <FontAwesome5
              name={getInstructionIcon()}
              size={24}
              color="#2563eb"
            />
          </View>
          <View style={styles.instructionTextContainer}>
            <Text style={styles.instructionText}>{instruction}</Text>
            {distanceToNext !== null && (
              <Text style={styles.distanceText}>
                {formatDistance(distanceToNext)}
              </Text>
            )}
          </View>
        </View>

        {/* Route features display */}
        {routeFeatures && (
          <View style={styles.routeFeatures}>
            {routeFeatures.hasTolls && (
              <View style={styles.featureChip}>
                <FontAwesome5 name="receipt" size={10} color="#FF9800" />
                <Text style={styles.featureChipText}>Péage</Text>
              </View>
            )}
            {routeFeatures.hasHighways && (
              <View style={styles.featureChip}>
                <FontAwesome5 name="road" size={10} color="#2196F3" />
                <Text style={styles.featureChipText}>Autoroute</Text>
              </View>
            )}
            {routeFeatures.hasUnpavedRoads && (
              <View style={styles.featureChip}>
                <FontAwesome5 name="truck-monster" size={10} color="#795548" />
                <Text style={styles.featureChipText}>Non pavé</Text>
              </View>
            )}
          </View>
        )}

        {/* Navigation control panel */}
        <View style={styles.controlPanel}>
          <TouchableOpacity
            style={styles.overviewButton}
            onPress={() => setShowOverview(!showOverview)}
          >
            <FontAwesome5
              name={showOverview ? "location-arrow" : "route"}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>

          {showOverview ? (
            <View style={styles.routeOverview}>
              <View style={styles.routeStats}>
                <View style={styles.routeStat}>
                  <Text style={styles.routeStatLabel}>Restant</Text>
                  <Text style={styles.routeStatValue}>
                    {remainingDistance != null
                      ? formatDistance(remainingDistance)
                      : route
                      ? formatDistance(route.distance)
                      : ""}
                  </Text>
                </View>
                <View style={styles.routeStat}>
                  <Text style={styles.routeStatLabel}>Durée</Text>
                  <Text style={styles.routeStatValue}>
                    {remainingDuration != null
                      ? formatDuration(remainingDuration)
                      : route
                      ? formatDuration(route.duration)
                      : ""}
                  </Text>
                </View>
                <View style={styles.routeStat}>
                  <Text style={styles.routeStatLabel}>Arrivée</Text>
                  <Text style={styles.routeStatValue}>
                    {getEstimatedArrival()}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.recalculateButton}
              onPress={onRecalculateRoute}
            >
              <FontAwesome5 name="sync" size={16} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancelNavigation}
            >
              <FontAwesome5 name="times" size={16} color="#fff" />
              <Text style={styles.cancelButtonText}>Arrêter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  instructionCard: {
    flexDirection: "row",
    backgroundColor: "white",
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e6f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  distanceText: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
  controlPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  routeOverview: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  routeStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  routeStat: {
    alignItems: "center",
  },
  routeStatLabel: {
    fontSize: 12,
    color: "#666",
  },
  routeStatValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  buttonGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  recalculateButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cancelButton: {
    flexDirection: "row",
    backgroundColor: "#ef4444",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "white",
    fontWeight: "600",
    marginLeft: 8,
  },
  // Traffic indicator styles
  trafficIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    position: "absolute",
    top: 8,
    right: 8,
  },
  trafficLow: {
    backgroundColor: "rgba(76, 175, 80, 0.8)",
  },
  trafficModerate: {
    backgroundColor: "rgba(255, 193, 7, 0.8)",
  },
  trafficHeavy: {
    backgroundColor: "rgba(244, 67, 54, 0.8)",
  },
  trafficText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 4,
  },
  // Route features styles
  routeFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  featureChipText: {
    fontSize: 10,
    color: "#333",
    marginLeft: 4,
  },
});

export default NavigationInterface;
