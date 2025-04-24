// components/mapbox/AlertCallout.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { PinRead } from '@/types/api';

interface AlertCalloutProps {
  pin: PinRead;
  onClose: () => void;
}

// Human-readable labels for pin types
const TYPE_LABELS: Record<string, string> = {
  obstacle: 'Obstacle',
  traffic_jam: 'Traffic Jam',
  cop: 'Police',
  accident: 'Accident',
  roadwork: 'Road Work',
};

// Format date to a readable string
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

const AlertCallout: React.FC<AlertCalloutProps> = ({ pin, onClose }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{TYPE_LABELS[pin.type]}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <FontAwesome5 name="times" size={16} color="#555" />
        </TouchableOpacity>
      </View>
      
      {pin.description && (
        <Text style={styles.description}>{pin.description}</Text>
      )}
      
      <View style={styles.footer}>
        <Text style={styles.time}>Reported at {formatDate(pin.created_at)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    minWidth: 180,
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: '#666',
  },
  upvotes: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upvoteCount: {
    fontSize: 12,
    marginLeft: 4,
    color: '#4CAF50',
  },
});

export default AlertCallout;