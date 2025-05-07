import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Text,
  Platform,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { Route, RouteFeatures } from "@/types/mapbox";
import * as Location from "expo-location";
import { useUser } from "@/providers/UserProvider";
import MapboxSearchItem from "./MapboxSearchItem";
import mapboxService from "@/services/mapboxService";
import { getExcludesFromPreferences } from "@/utils/routeUtils";
import ttsManager from "@/utils/ttsManager";
import Config from "react-native-config";

interface SearchAndRouteControlProps {
  userLocation: [number, number] | null;
  onDestinationSelected: (coordinates: [number, number]) => void;
  onStartNavigation: () => void;
  onCancelSearch: () => void;
  onRouteSelected: (route: Route, alternateRoutes: Route[]) => void;
  loading: boolean;
  visible: boolean;
  isNavigating: boolean;
  routeFeatures?: Record<string, RouteFeatures>;
  isFeatureDetectionInProgress?: boolean;
}

const SearchAndRouteControl: React.FC<SearchAndRouteControlProps> = ({
  userLocation,
  onDestinationSelected,
  onStartNavigation,
  onCancelSearch,
  onRouteSelected,
  loading,
  visible,
  isNavigating,
  routeFeatures,
  isFeatureDetectionInProgress,
}) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchMode, setSearchMode] = useState(true); // true = search, false = route selection
  const [selectedDestination, setSelectedDestination] = useState<
    [number, number] | null
  >(null);

  // Route state
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  // References
  const searchInputRef = useRef<TextInput>(null);

  // Get user preferences
  const { userData } = useUser();
  const colorScheme = useColorScheme() ?? "light";

  // Animate panel based on visibility
  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Reset state when returning to search mode
  useEffect(() => {
    if (searchMode) {
      setSelectedDestination(null);
      setRoutes([]);
    }
  }, [searchMode]);

  // Handle search input change
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    try {
      // Call the geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?` +
          `access_token=${Config.MAPBOX_PK}&` +
          "country=fr&" +
          "language=fr&" +
          "limit=5&" +
          "types=place,address,poi"
      );

      const data = await response.json();
      setSearchResults(data.features || []);
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle selection of a search result
  const handleSelectSearchResult = useCallback(
    async (feature: any) => {
      const coordinates: [number, number] = feature.geometry.coordinates;
      setSelectedDestination(coordinates);
      setSearchMode(false);

      // Notify parent component
      onDestinationSelected(coordinates);

      // If we have user location, fetch routes
      if (userLocation) {
        try {
          // Get route excludes from preferences
          const excludes = getExcludesFromPreferences(userData?.preferences);

          // Fetch routes
          const response = await mapboxService.getDirections(
            userLocation,
            coordinates,
            { excludes: excludes.length > 0 ? excludes : undefined }
          );

          if (response.routes && response.routes.length > 0) {
            setRoutes(response.routes);
            setSelectedRouteIndex(0);

            // Notify parent of selected route
            onRouteSelected(response.routes[0], response.routes.slice(1));
          }
        } catch (error) {
          console.error("Error fetching routes:", error);
        }
      }
    },
    [
      userLocation,
      onDestinationSelected,
      onRouteSelected,
      userData?.preferences,
    ]
  );

  // Select a different route
  const handleSelectRoute = useCallback(
    (index: number) => {
      if (index >= 0 && index < routes.length) {
        setSelectedRouteIndex(index);

        // Update the selected route in the parent
        const newSelectedRoute = routes[index];
        const newAlternateRoutes = routes.filter((_, i) => i !== index);

        onRouteSelected(newSelectedRoute, newAlternateRoutes);
      }
    },
    [routes, onRouteSelected]
  );

  // Handle start navigation button
  const handleStartNavigation = useCallback(async () => {
    // Request background location permissions if needed (iOS)
    if (Platform.OS === "ios") {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== "granted") {
        ttsManager.speak(
          "Pour une navigation optimale, veuillez autoriser la localisation en arrière-plan"
        );
      }
    }

    // Start navigation
    onStartNavigation();
  }, [onStartNavigation]);

  // Handle back button in route selection mode
  const handleBackToSearch = useCallback(() => {
    setSearchMode(true);
    onCancelSearch();
  }, [onCancelSearch]);

  // Format route details for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
  };

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const FeatureBadge = ({
    icon,
    label,
    color = "#555",
  }: {
    icon: string;
    label: string;
    color?: string;
  }) => (
    <View style={styles.featureBadge}>
      <FontAwesome5 name={icon} size={10} color={color} />
      <Text style={styles.featureText}>{label}</Text>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [500, 0],
              }),
            },
          ],
          opacity: slideAnim,
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      {searchMode ? (
        // Search mode
        <View style={styles.searchContainer}>
          <View style={styles.searchHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancelSearch}
            >
              <FontAwesome5
                name="times"
                size={20}
                color={Colors[colorScheme].text}
              />
            </TouchableOpacity>

            <View style={styles.searchInputContainer}>
              <FontAwesome5
                name="search"
                size={16}
                color="#777"
                style={styles.searchIcon}
              />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Rechercher un lieu"
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <FontAwesome5 name="times-circle" size={16} color="#777" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.resultsContainer}>
            {searchLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={Colors[colorScheme].tint}
                />
                <Text style={styles.loadingText}>Recherche en cours...</Text>
              </View>
            ) : (
              <>
                {searchResults.map((feature, index) => (
                  <MapboxSearchItem
                    key={feature.id || index}
                    feature={feature}
                    onSelect={() => handleSelectSearchResult(feature)}
                  />
                ))}

                {searchResults.length === 0 && searchQuery.length > 2 && (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      Aucun résultat trouvé pour "{searchQuery}"
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        // Route selection mode
        <View style={styles.routeSelectionContainer}>
          <View style={styles.routeHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackToSearch}
            >
              <FontAwesome5
                name="arrow-left"
                size={20}
                color={Colors[colorScheme].text}
              />
            </TouchableOpacity>
            <Text style={styles.routeHeaderText}>Routes disponibles</Text>
          </View>

          <ScrollView style={styles.routesList}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={Colors[colorScheme].tint}
                />
                <Text style={styles.loadingText}>
                  Recherche des itinéraires...
                </Text>
              </View>
            ) : (
              routes.map((route, index) => {
                // Get features for this route
                const features =
                  routeFeatures?.[
                    index === 0 ? "primary" : `alternate-${index - 1}`
                  ];

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.routeOption,
                      index === selectedRouteIndex && styles.selectedRoute,
                    ]}
                    onPress={() => handleSelectRoute(index)}
                  >
                    <View style={styles.routeDetails}>
                      <Text style={styles.routeDuration}>
                        {features?.estimatedTime ||
                          formatDuration(route.duration)}
                      </Text>
                      <Text style={styles.routeDistance}>
                        {features?.distance || formatDistance(route.distance)}
                      </Text>
                    </View>

                    <View style={styles.routeTypeContainer}>
                      <Text style={styles.routeType}>
                        {route.weight_name === "auto"
                          ? "Recommandé"
                          : route.weight_name === "shortest"
                          ? "Le plus court"
                          : "Le plus rapide"}
                      </Text>

                      {/* Traffic indicator */}
                      {features?.trafficLevel &&
                        features.trafficLevel !== "unknown" && (
                          <View
                            style={[
                              styles.trafficBadge,
                              features.trafficLevel === "low"
                                ? styles.trafficLow
                                : features.trafficLevel === "moderate"
                                ? styles.trafficModerate
                                : styles.trafficHeavy,
                            ]}
                          >
                            <Text style={styles.trafficText}>
                              {features.trafficLevel === "low"
                                ? "Fluide"
                                : features.trafficLevel === "moderate"
                                ? "Modéré"
                                : "Dense"}
                            </Text>
                          </View>
                        )}
                    </View>

                    {/* Features badges */}
                    <View style={styles.featureBadges}>
                      {features?.hasTolls && (
                        <FeatureBadge
                          icon="receipt"
                          label="Péage"
                          color="#FF9800"
                        />
                      )}

                      {features?.hasHighways && (
                        <FeatureBadge
                          icon="road"
                          label="Autoroute"
                          color="#2196F3"
                        />
                      )}

                      {features?.hasUnpavedRoads && (
                        <FeatureBadge
                          icon="truck-monster"
                          label="Non pavé"
                          color="#795548"
                        />
                      )}

                      {isFeatureDetectionInProgress && (
                        <View style={styles.featureLoadingIndicator}>
                          <ActivityIndicator size="small" color="#777" />
                          <Text style={styles.featureLoadingText}>
                            Analyse en cours...
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
          {routes.length > 0 && (
            <View style={styles.trafficInfo}>
              <FontAwesome5 name="info-circle" size={14} color="#4285F4" />
              <Text style={styles.trafficInfoText}>
                Les temps de trajet incluent le trafic en temps réel
              </Text>
            </View>
          )}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.startNavigationButton}
              onPress={handleStartNavigation}
              disabled={routes.length === 0}
            >
              <FontAwesome5 name="play" size={16} color="#fff" />
              <Text style={styles.startNavigationText}>Démarrer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleBackToSearch}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: "70%",
  },
  searchContainer: {
    padding: 16,
    maxHeight: 500,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  closeButton: {
    padding: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    height: "100%",
  },
  clearButton: {
    padding: 8,
  },
  resultsContainer: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: "#777",
  },
  noResultsContainer: {
    padding: 16,
    alignItems: "center",
  },
  noResultsText: {
    color: "#777",
    fontSize: 16,
  },
  routeSelectionContainer: {
    padding: 16,
  },
  routeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    padding: 10,
  },
  routeHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
  routesList: {
    maxHeight: 300,
  },
  routeOption: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedRoute: {
    borderWidth: 2,
    borderColor: "#2196f3",
    backgroundColor: "#e3f2fd",
  },
  routeDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  routeDuration: {
    fontSize: 18,
    fontWeight: "bold",
  },
  routeDistance: {
    fontSize: 16,
    color: "#555",
  },
  routeTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeType: {
    fontSize: 14,
    color: "#666",
  },
  routeBadge: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#000",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  startNavigationButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    padding: 16,
    marginRight: 8,
  },
  startNavigationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
  },
  cancelButtonText: {
    color: "#555",
    fontSize: 16,
  },
  featureBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  featureBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  featureText: {
    fontSize: 10,
    color: "#555",
    marginLeft: 4,
  },
  featureLoadingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  featureLoadingText: {
    fontSize: 10,
    color: "#777",
    marginLeft: 4,
  },
  trafficBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  trafficLow: {
    backgroundColor: "#4CAF50",
  },
  trafficModerate: {
    backgroundColor: "#FFC107",
  },
  trafficHeavy: {
    backgroundColor: "#F44336",
  },
  trafficText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  trafficInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(66, 133, 244, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  trafficInfoText: {
    fontSize: 12,
    color: "#4285F4",
    marginLeft: 8,
  },
});

export default SearchAndRouteControl;
