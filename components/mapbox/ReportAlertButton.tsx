// components/mapbox/ReportAlertButton.tsx
import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal,
  TextInput,
  FlatList,
  TouchableWithoutFeedback,
  TouchableOpacity
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { usePins } from '@/providers/PinProvider';
import { PinType } from '@/types/api';

const ALERT_TYPES: { type: PinType; label: string; icon: string; color: string }[] = [
  { type: 'obstacle', label: 'Obstacle', icon: 'exclamation-triangle', color: '#FFA500' },
  { type: 'traffic_jam', label: 'Traffic Jam', icon: 'car', color: '#FF0000' },
  { type: 'cop', label: 'Police', icon: 'shield-alt', color: '#0000FF' },
  { type: 'accident', label: 'Accident', icon: 'car-crash', color: '#FF0000' },
  { type: 'roadwork', label: 'Road Work', icon: 'hard-hat', color: '#FF8C00' },
];

interface ReportAlertButtonProps {
  userLocation: { longitude: number; latitude: number } | null;
  // New props for external modal control
  isVisible?: boolean;
  onClose?: () => void;
}

const ReportAlertButton: React.FC<ReportAlertButtonProps> = ({ 
  userLocation,
  isVisible,
  onClose
}) => {
  // Use the external visibility state if provided, otherwise manage internally
  const [internalModalVisible, setInternalModalVisible] = useState(false);
  const [description, setDescription] = useState('');
  const { reportPin } = usePins();
  
  // Determine if modal should be shown based on props or internal state
  const modalVisible = isVisible !== undefined ? isVisible : internalModalVisible;
  
  // Handle closing the modal
  const handleCloseModal = () => {
    if (onClose) {
      // If external control is provided, use it
      onClose();
    } else {
      // Otherwise use internal state
      setInternalModalVisible(false);
    }
    // Always reset description when closing
    setDescription('');
  };
  
  const handleReport = async (type: PinType) => {
    if (!userLocation) {
      // Show an error or request location permission
      return;
    }
    
    await reportPin(
      type, 
      userLocation.longitude, 
      userLocation.latitude, 
      description.trim() || undefined
    );
    setDescription('');
    handleCloseModal();
  };
  
  return (
    <>
      {/* Modal for selecting alert type */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Report Alert</Text>
                  <TouchableOpacity onPress={handleCloseModal}>
                    <FontAwesome5 name="times" size={20} color="#555" />
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.sectionTitle}>Select Alert Type</Text>
                
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
                      <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                        <FontAwesome5 name={item.icon} size={24} color="white" />
                      </View>
                      <Text style={styles.alertTypeLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.alertTypesList}
                />
                
                <Text style={styles.sectionTitle}>Description (Optional)</Text>
                
                <TextInput
                  style={styles.input}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add details about this alert..."
                  multiline
                  numberOfLines={3}
                />
                
                <Text style={styles.note}>
                  Reports are sent anonymously and will show at your current location
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  alertTypesList: {
    paddingBottom: 16,
  },
  alertTypeItem: {
    flex: 1,
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTypeLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    height: 80,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
});

export default ReportAlertButton;