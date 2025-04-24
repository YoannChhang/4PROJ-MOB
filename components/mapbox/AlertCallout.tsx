import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    borderRadius: 12,
    padding: 16,
    minWidth: 220,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    color: '#555',
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },
});

export default AlertCallout;