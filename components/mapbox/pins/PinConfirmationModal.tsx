// components/mapbox/pins/PinConfirmationModal.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { PinRead } from "@/types/api";

const TYPE_LABELS: Record<string, string> = {
  obstacle: "Obstacle",
  traffic_jam: "Embouteillage",
  cop: "Police",
  accident: "Accident",
  roadwork: "Travaux",
};

interface PinConfirmationModalProps {
  visible: boolean;
  pin: PinRead | null;
  onResponse: (isStillThere: boolean) => void;
  timeoutDuration?: number; // in milliseconds
}

const PinConfirmationModal: React.FC<PinConfirmationModalProps> = ({
  visible,
  pin,
  onResponse,
  timeoutDuration = 20000, // Default 20 seconds
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState(Math.floor(timeoutDuration / 1000));

  useEffect(() => {
    if (visible && pin) {
      setTimeLeft(Math.floor(timeoutDuration / 1000)); // Reset time left

      const intervalId = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(intervalId);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);

      timerRef.current = setTimeout(() => {
        clearInterval(intervalId);
        onResponse(true); // Default to 'Yes' on timeout
      }, timeoutDuration);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        clearInterval(intervalId);
        timerRef.current = null;
      };
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimeLeft(Math.floor(timeoutDuration / 1000));
    }
  }, [visible, pin, timeoutDuration, onResponse]);

  if (!pin) return null;

  const incidentTypeLabel = TYPE_LABELS[pin.type] || "Incident";

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={() => onResponse(true)} // Default to 'Yes' if closed (e.g., Android back button)
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <FontAwesome5
              name="map-marker-question"
              size={24}
              color="#4285F4"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Vérification d'incident</Text>
          </View>
          <Text style={styles.message}>
            Il y'a t-il encore un incident de type{" "}
            <Text style={styles.incidentType}>{incidentTypeLabel}</Text>{" "}
            present?
          </Text>
          {pin.description && (
            <Text style={styles.description}>"{pin.description}"</Text>
          )}

          <View style={styles.timerContainer}>
            <ActivityIndicator
              size="small"
              color="#FFA500"
              style={styles.timerIcon}
            />
            <Text style={styles.timerText}>
              Confirmation automatique dans {timeLeft}s
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.yesButton]}
              onPress={() => onResponse(true)}
            >
              <FontAwesome5 name="check" size={16} color="#fff" />
              <Text style={styles.buttonText}>Oui</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.noButton]}
              onPress={() => onResponse(false)}
            >
              <FontAwesome5 name="times" size={16} color="#fff" />
              <Text style={styles.buttonText}>Non, disparu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: "95%",
    maxWidth: 380,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    alignSelf: "flex-start",
  },
  headerIcon: {
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
  },
  message: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    color: "#34495e",
    lineHeight: 26,
  },
  incidentType: {
    fontWeight: "bold",
    color: "#3b82f6", // A blue color
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
    color: "#7f8c8d",
    marginBottom: 22,
    paddingHorizontal: 10,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fef3c7", // Light yellow background
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a", // Slightly darker yellow border
  },
  timerIcon: {
    marginRight: 8,
  },
  timerText: {
    fontSize: 14,
    color: "#b45309", // Dark amber color
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: Platform.OS === "ios" ? "row" : "column-reverse", // Stack buttons vertically on Android for better fit
    justifyContent: "space-around",
    width: "100%",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    marginVertical: Platform.OS === "ios" ? 0 : 6, // Add vertical margin on Android
  },
  yesButton: {
    backgroundColor: "#27ae60", // Emerald green
    marginRight: Platform.OS === "ios" ? 10 : 0,
  },
  noButton: {
    backgroundColor: "#c0392b", // Pomegranate red
    marginLeft: Platform.OS === "ios" ? 10 : 0,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 10,
  },
});

export default PinConfirmationModal;
