import React, { useState } from "react";
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

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_SK as string;

const searchClient = new SearchBoxCore({
  accessToken: MAPBOX_ACCESS_TOKEN,
});

const MapboxSearchBar = ({
  onSelectLocation,
}: {
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
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error("Search error:", error);
    }
  };

  const handleSelect = async (suggestion: SearchBoxSuggestion) => {
    try {
      setQuery(`${suggestion.name}, ${suggestion.place_formatted}`);
      console.log("test")
      const response = await searchClient.retrieve(suggestion, {
        sessionToken: searchSession,
        language: "fr",
      });
      if (response.features) {
        console.log("Features:", response.features);
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

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search for a place..."
        value={query}
        onChangeText={handleSearch}
        onFocus={() => setListVisible(true)}
      />

      {listVisible && suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.suggestion}
              onPress={() => {
                console.log("object")
                handleSelect(item);
              }}
            >
              <Text>{`${item.name}, ${item.place_formatted}`}</Text>
            </TouchableOpacity>
          )}
        />
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
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
  },
  suggestion: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
});

export default MapboxSearchBar;
