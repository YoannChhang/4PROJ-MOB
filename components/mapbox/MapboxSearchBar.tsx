import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import {
  AddressAutofillCore,
  SearchBoxCore,
  SearchBoxAdministrativeUnitTypes,
  SearchBoxSuggestion,
} from "@mapbox/search-js-core";
import { useLocation } from "@/providers/LocationProvider";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Config from "react-native-config";

const MAPBOX_ACCESS_TOKEN = Config.MAPBOX_PK as string;

const searchClient = new SearchBoxCore({
  accessToken: MAPBOX_ACCESS_TOKEN,
});

const MapboxSearchBar = ({
  selectedLocation,
  onSelectLocation,
}: {
  selectedLocation: { latitude: number; longitude: number } | null;
  onSelectLocation: (
    place: { latitude: number; longitude: number } | null
  ) => void;
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchBoxSuggestion[]>([]);
  const [listVisible, setListVisible] = useState(false);
  const { searchSession } = useLocation();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await searchClient.suggest(text, {
        sessionToken: searchSession,
        country: "fr",
        language: "fr",
        navigation_profile: "driving",
        types: new Set<SearchBoxAdministrativeUnitTypes>([
          "place",
          "region",
          "district",
          "postcode",
          "locality",
          "neighborhood",
          "address",
          "poi" as SearchBoxAdministrativeUnitTypes,
        ]),
      });
      if (response.suggestions) {
        // console.log(response.suggestions);
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleSelect = async (suggestion: SearchBoxSuggestion) => {
    try {
      setQuery(`${suggestion.name}, ${suggestion.place_formatted}`);
      const response = await searchClient.retrieve(suggestion, {
        sessionToken: searchSession,
        language: "fr",
      });
      if (response.features) {
        if (response.features[0].geometry) {
          const { coordinates } = response.features[0].geometry;
          onSelectLocation({
            latitude: coordinates[1],
            longitude: coordinates[0],
          });
        }
        setListVisible(false);
      }
    } catch (error) {
      console.error("Retrieve error:", error);
    }
  };

  const opacity = useSharedValue(1);
  const height = useSharedValue(60); // 50px is the default height
  const padding = useSharedValue(20);

  useEffect(() => {
    if (selectedLocation) {
      // Hide search bar with smooth animation
      opacity.value = withTiming(0, { duration: 300 });
      height.value = withTiming(0, { duration: 300 });
      padding.value = withTiming(0, { duration: 300 });
    } else {
      // Show search bar again
      opacity.value = withTiming(1, { duration: 300 });
      height.value = withTiming(60, { duration: 300 });
      padding.value = withTiming(20, { duration: 300 });
      setQuery("");
    }
  }, [selectedLocation]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: height.value,
    padding: padding.value,
  }));

  return (
    <View style={[styles.container]}>
      <Animated.View style={animatedStyle}>
        <TextInput
          style={styles.input}
          placeholder="Search for a place..."
          value={query}
          onChangeText={handleSearch}
          onFocus={() => setListVisible(true)}
        />
      </Animated.View>

      {listVisible && suggestions.length > 0 && (
        <View style={styles.suggestionContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.suggestion,
                  index === suggestions.length - 1 && styles.lastSuggestion,
                ]}
                onPress={() => handleSelect(item)}
              >
                <Text>{`${item.name}, ${item.place_formatted}`}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 40,
    left: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 6,
    fontSize: 16,
  },
  suggestionContainer: {
    maxHeight: 200,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  suggestion: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  lastSuggestion: {
    borderBottomWidth: 0,
  },
});

export default MapboxSearchBar;
