import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

export interface RoutingPreference {
  id: string;
  label: string;
  enabled: boolean;
}

interface RoutingPreferencesProps {
  preferences: RoutingPreference[];
  onToggle: (id: string, value: boolean) => void;
}

const RoutingPreferences: React.FC<RoutingPreferencesProps> = ({
  preferences,
  onToggle,
}) => {
  const colorScheme = useColorScheme() ?? "light";

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
        Préférences d'itinéraire
      </Text>

      {preferences.map((preference) => (
        <View key={preference.id} style={styles.preferenceItem}>
          <Text
            style={[
              styles.preferenceLabel,
              { color: Colors[colorScheme].text },
            ]}
          >
            {preference.label}
          </Text>
          <Switch
            trackColor={{ false: "#767577", true: Colors[colorScheme].tint }}
            thumbColor="#f4f3f4"
            ios_backgroundColor="#3e3e3e"
            onValueChange={(value) => onToggle(preference.id, value)}
            value={preference.enabled}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
  },
  preferenceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  preferenceLabel: {
    fontSize: 16,
  },
});

export default RoutingPreferences;
