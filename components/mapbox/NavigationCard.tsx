import React, { useEffect } from "react";
import Tts from "react-native-tts";
import { View, Text, StyleSheet } from "react-native";
import { Route } from "@/types/mapbox";

interface NavigationCardProps {
  route: Route;
  instruction: string;
}

const NavigationCard: React.FC<NavigationCardProps> = ({
  route,
  instruction,
}) => {
  useEffect(() => {
    Tts.speak(instruction);
    return () => {
      Tts.stop();
    };
  }, [instruction]);

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>{instruction}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 60,
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
  instruction: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default NavigationCard;
