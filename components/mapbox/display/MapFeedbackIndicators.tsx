// components/map/MapFeedbackIndicators.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';

interface MapFeedbackIndicatorsProps {
  isInitializing: boolean;
  userLocationAvailable: boolean; // To refine initial loading condition
  routeHookLoading: boolean;
  isInitialRouteCalculated: boolean;
  isRerouting: boolean;
  routeHookError: string | null;
}

const MapFeedbackIndicators: React.FC<MapFeedbackIndicatorsProps> = ({
  isInitializing,
  userLocationAvailable,
  routeHookLoading,
  isInitialRouteCalculated,
  isRerouting,
  routeHookError,
}) => {
  const showInitialLoading = isInitializing && !userLocationAvailable;
  const showFullScreenRouteCalcLoading =
    !isInitializing && // only show if app init is done
    routeHookLoading &&
    !isInitialRouteCalculated &&
    !isRerouting;

  if (showInitialLoading) {
    return (
      <View style={styles.fullScreenLoading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.fullScreenLoadingText}>Initialisation des services...</Text>
      </View>
    );
  }

  return (
    <>
      {routeHookError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{routeHookError}</Text>
        </View>
      )}
      {isRerouting && !showFullScreenRouteCalcLoading && (
        <View style={styles.reroutingIndicator}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.reroutingText}>Recalcul en cours...</Text>
        </View>
      )}
      {showFullScreenRouteCalcLoading && (
        <View style={styles.fullScreenLoading}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.fullScreenLoadingText}>Calcul d'itinéraire...</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 2000,
  },
  errorText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  fullScreenLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  fullScreenLoadingText: {
    color: '#FFFFFF',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '500',
  },
  reroutingIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 1000,
  },
  reroutingText: { marginLeft: 10, fontSize: 14, color: '#007AFF' },
});

export default MapFeedbackIndicators;