import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Route } from "@/types/mapbox";

interface NavigationCardProps {
  route: Route;
  instruction: string;
  distanceToNext: number | null;
}

// Map instruction types to icons
const getInstructionIcon = (instruction: string) => {
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

const NavigationCard: React.FC<NavigationCardProps> = ({
  route,
  instruction,
  distanceToNext,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <FontAwesome5 
          name={getInstructionIcon(instruction)} 
          size={24} 
          color="#2563eb" 
        />
      </View>
      <View style={styles.instructionContainer}>
        <Text style={styles.instruction}>{instruction}</Text>
        {distanceToNext !== null && (
          <Text style={styles.distance}>
            {distanceToNext < 1000 
              ? `${Math.round(distanceToNext)}m` 
              : `${(distanceToNext / 1000).toFixed(1)}km`}
          </Text>
        )}
      </View>
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
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e6f0ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  instructionContainer: {
    flex: 1,
  },
  instruction: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: "#666",
  },
});

export default NavigationCard;