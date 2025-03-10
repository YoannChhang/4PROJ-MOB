import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Route } from "@/types/mapbox";
import { FontAwesome5 } from "@expo/vector-icons";

interface ItinerarySelectProps {
  selectedRoute: Route | null;
  alternateRoutes: Route[];
  onBack?: () => void;
  onStartNavigation?: () => void;
  onPlanLater?: () => void;
}

const ItinerarySelect = ({
  selectedRoute,
  alternateRoutes,
  onBack,
  onStartNavigation,
  onPlanLater,
}: ItinerarySelectProps) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["25%", "50%"], []);

  useEffect(() => {
    if (selectedRoute) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [selectedRoute]);

  // Format duration from seconds to hours and minutes
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  // Format distance from meters to kilometers
  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const renderRouteOption = useCallback((route: Route, index: number) => {
    const isMainRoute = index === 0;
    return (
      <View
        key={index}
        style={[styles.routeOption, isMainRoute && styles.selectedRoute]}
      >
        <View style={styles.routeHeader}>
          <Text style={styles.routeTitle}>
            {isMainRoute ? "Fastest Route" : `Alternative ${index}`}
          </Text>
          {route.weight_name === "toll" && (
            <Text style={styles.tollBadge}>Toll</Text>
          )}
        </View>
        <View style={styles.routeDetails}>
          <Text style={styles.routeInfo}>
            {formatDuration(route.duration)} • {formatDistance(route.distance)}
          </Text>
        </View>
      </View>
    );
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.bottomSheetBackground}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <FontAwesome5 name="arrow-left" size={20} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Available Routes</Text>
        </View>

        <View style={styles.routesList}>
          {selectedRoute && renderRouteOption(selectedRoute, 0)}
          {alternateRoutes.map((route, index) =>
            renderRouteOption(route, index + 1)
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={onStartNavigation}
          >
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.planLaterButton]}
            onPress={onPlanLater}
          >
            <Text style={styles.buttonTextSecondary}>Plan Later</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 16,
  },
  routesList: {
    flex: 1,
  },
  routeOption: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  selectedRoute: {
    backgroundColor: "#e3f2fd",
    borderWidth: 2,
    borderColor: "#2196f3",
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  tollBadge: {
    backgroundColor: "#ffd700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
  },
  routeDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeInfo: {
    color: "#666",
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#2196f3",
  },
  planLaterButton: {
    backgroundColor: "#f5f5f5",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomSheetBackground: {
    backgroundColor: "white",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  handleIndicator: {
    backgroundColor: "#DDDDDD",
    width: 40,
  },
});

export default ItinerarySelect;
