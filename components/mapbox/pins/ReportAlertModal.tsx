// components/mapbox/ReportAlertButton.tsx
import React, { useState } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Modal,
  TextInput,
  FlatList,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { usePins } from "@/providers/PinProvider";
import { PinType } from "@/types/api";

const ALERT_TYPES: {
  type: PinType;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    type: "obstacle",
    label: "Obstacle",
    icon: "exclamation-triangle",
    color: "#FFA500",
  },
  {
    type: "traffic_jam",
    label: "Embouteillage",
    icon: "car",
    color: "#FF0000",
  },
  { type: "cop", label: "Police", icon: "shield-alt", color: "#0000FF" },
  { type: "accident", label: "Accident", icon: "car-crash", color: "#FF0000" },
  { type: "roadwork", label: "Travaux", icon: "hard-hat", color: "#FF8C00" },
];

interface ReportAlertModalProps {
  userLocation: { longitude: number; latitude: number } | null;
  isVisible?: boolean;
  onClose: () => void;
}

const ReportAlertModal: React.FC<ReportAlertModalProps> = ({
  userLocation,
  isVisible,
  onClose,
}) => {
  const [description, setDescription] = useState("");
  const { reportPin } = usePins();

  const handleCloseModal = () => {
    setDescription("");
    onClose();
  };

  const handleReport = async (type: PinType) => {
    if (!userLocation) {
      Alert.alert(
        "Localisation indisponible",
        "Nous avons besoin de votre localisation pour signaler une alerte. Veuillez activer les services de localisation.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      console.log(
        `Reporting ${type} at ${userLocation.longitude}, ${userLocation.latitude}`
      );

      await reportPin(
        type,
        userLocation.longitude,
        userLocation.latitude,
        description.trim() || undefined
      );
    } finally {
      handleCloseModal();
    }
  };

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={isVisible}
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Signaler une alerte</Text>
                  <TouchableOpacity onPress={handleCloseModal}>
                    <FontAwesome5 name="times" size={20} color="#555" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>
                  Sélectionner le type d'alerte
                </Text>

                <FlatList
                  data={ALERT_TYPES}
                  horizontal={false}
                  numColumns={3}
                  keyExtractor={(item) => item.type}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.alertTypeItem}
                      onPress={() => handleReport(item.type)}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: item.color },
                        ]}
                      >
                        <FontAwesome5
                          name={item.icon}
                          size={24}
                          color="white"
                        />
                      </View>
                      <Text style={styles.alertTypeLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.alertTypesList}
                />

                <Text style={styles.sectionTitle}>
                  Description (facultatif)
                </Text>

                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ajoutez des détails sur cette alerte..."
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.note}>
                  Les signalements sont envoyés anonymement et apparaîtront à
                  votre position actuelle.
                </Text>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  alertTypesList: {
    paddingBottom: 16,
  },
  alertTypeItem: {
    flex: 1,
    alignItems: "center",
    marginBottom: 16,
    marginHorizontal: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  alertTypeLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    height: 80,
    textAlignVertical: "top",
  },
  note: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 12,
  },
});

export default ReportAlertModal;
