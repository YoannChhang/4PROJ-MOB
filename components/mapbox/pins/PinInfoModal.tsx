import React, { useCallback, useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { FontAwesome5 } from "@expo/vector-icons";
import { PinRead } from "@/types/api";

// Human-readable labels for pin types
const TYPE_LABELS: Record<string, string> = {
  obstacle: "Obstacle",
  traffic_jam: "Traffic Jam",
  cop: "Police",
  accident: "Accident",
  roadwork: "Road Work",
};

// Map pin types to their corresponding icons
const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  obstacle: { name: "exclamation-triangle", color: "#FFA500" },
  traffic_jam: { name: "car", color: "#FF0000" },
  cop: { name: "shield-alt", color: "#0000FF" },
  accident: { name: "car-crash", color: "#FF0000" },
  roadwork: { name: "hard-hat", color: "#FF8C00" },
};

// Format date to a readable string
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

interface PinInfoModalProps {
  selectedPin: PinRead | null;
  onClose: () => void;
}

const PinInfoModal: React.FC<PinInfoModalProps> = ({ selectedPin, onClose }) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  
  const snapPoints = useMemo(() => ["25%"], []);

  useEffect(() => {
    if (selectedPin) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [selectedPin]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  if (!selectedPin) return null;

  const { type, description, created_at } = selectedPin;
  const icon = TYPE_ICONS[type] || { name: "question", color: "#555" };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose={true}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: icon.color }]}>
            <FontAwesome5 name={icon.name} size={24} color="white" />
          </View>
          <Text style={styles.title}>{TYPE_LABELS[type]}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={18} color="#555" />
          </TouchableOpacity>
        </View>

        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.timestamp}>Reported at {formatDate(created_at)}</Text>
          <Text style={styles.reportedBy}>
            By {selectedPin.user.name || "Anonymous User"}
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  modalBackground: {
    backgroundColor: "white",
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  handleIndicator: {
    backgroundColor: "#DDDDDD",
    width: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  descriptionContainer: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  timestamp: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  reportedBy: {
    fontSize: 14,
    color: "#777",
  },
});

export default PinInfoModal;