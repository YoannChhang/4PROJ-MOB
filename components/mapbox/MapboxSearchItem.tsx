import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface MapboxSearchItemProps {
  feature: any;
  onSelect: () => void;
}

const MapboxSearchItem: React.FC<MapboxSearchItemProps> = ({ feature, onSelect }) => {
  // Determine the icon based on feature type
  const getIconName = (): string => {
    const type = feature.place_type?.[0] || '';
    
    switch (type) {
      case 'poi':
        return 'map-pin';
      case 'address':
        return 'home';
      case 'place':
        return 'city';
      case 'region':
        return 'map-marked-alt';
      case 'country':
        return 'flag';
      default:
        return 'map-marker-alt';
    }
  };

  // Format the result text
  const mainText = feature.text || feature.place_name?.split(',')[0] || '';
  const secondaryText = feature.place_name?.replace(`${mainText}, `, '') || '';

  return (
    <TouchableOpacity style={styles.container} onPress={onSelect}>
      <View style={styles.iconContainer}>
        <FontAwesome5 name={getIconName()} size={20} color="#555" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.mainText} numberOfLines={1}>
          {mainText}
        </Text>
        {secondaryText && (
          <Text style={styles.secondaryText} numberOfLines={1}>
            {secondaryText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  secondaryText: {
    fontSize: 14,
    color: '#777',
    marginTop: 2,
  },
});

export default MapboxSearchItem;