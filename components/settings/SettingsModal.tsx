import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import ProfileSection from './ProfileSection';
import RoutingPreferences, { RoutingPreference } from './RoutingPreferences';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useUser } from '@/providers/UserProvider';
import { updateUserPreferences } from '@/services/useService';
import { UserPreferences, PreferredTravelMethodEnum } from '@/types/api';

interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onPreferenceChange?: (preferences: RoutingPreference[]) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isVisible,
  onClose,
  onPreferenceChange,
}) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme() ?? 'light';
  
  // Full screen (100%) and a small peek value for smooth opening
  const snapPoints = useMemo(() => ['100%'], []);
  
  const { userData, isSignedIn } = useUser();

  // Default routing preferences
  const [preferences, setPreferences] = useState<RoutingPreference[]>([
    { id: 'avoid_tolls', label: 'Avoid Tolls', enabled: userData?.preferences?.avoid_tolls || false },
    { id: 'prefer_highways', label: 'Prefer Highways', enabled: userData?.preferences?.preferred_travel_method === PreferredTravelMethodEnum.DRIVING || true },
    { id: 'avoid_ferries', label: 'Avoid Ferries', enabled: userData?.preferences?.avoid_ferries || false },
    { id: 'avoid_high_traffic', label: 'Avoid High Traffic Areas', enabled: true },
  ]);

  // Update preferences when user data changes
  useEffect(() => {
    if (userData?.preferences) {
      setPreferences([
        { id: 'avoid_tolls', label: 'Avoid Tolls', enabled: userData.preferences.avoid_tolls || false },
        { id: 'prefer_highways', label: 'Prefer Highways', enabled: userData.preferences.preferred_travel_method === PreferredTravelMethodEnum.DRIVING || true },
        { id: 'avoid_ferries', label: 'Avoid Ferries', enabled: userData.preferences.avoid_ferries || false },
        { id: 'avoid_high_traffic', label: 'Avoid High Traffic Areas', enabled: true },
      ]);
    }
  }, [userData]);

  // Handle preference toggles
  const handleTogglePreference = useCallback((id: string, value: boolean) => {
    setPreferences(prev => {
      const updated = prev.map(pref => 
        pref.id === id ? { ...pref, enabled: value } : pref
      );
      
      // Call the callback with updated preferences if provided
      if (onPreferenceChange) {
        onPreferenceChange(updated);
      }
      
      // Save preferences to backend if user is logged in
      if (isSignedIn && userData) {
        // Convert from UI preferences to API preferences
        const apiPreferences: UserPreferences = {
          avoid_tolls: updated.find(p => p.id === 'avoid_tolls')?.enabled,
          avoid_ferries: updated.find(p => p.id === 'avoid_ferries')?.enabled,
          preferred_travel_method: updated.find(p => p.id === 'prefer_highways')?.enabled 
            ? PreferredTravelMethodEnum.DRIVING 
            : PreferredTravelMethodEnum.WALKING,
        };
        
        // Update preferences through API
        updateUserPreferences(apiPreferences)
          .then(response => {
            console.log('Preferences updated successfully');
          })
          .catch(error => {
            console.error('Error updating preferences:', error);
          });
      }
      
      return updated;
    });
  }, [onPreferenceChange, isSignedIn, userData]);

  // Present the modal when isVisible changes
  useEffect(() => {
    if (isVisible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  // Handle back button press on Android
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isVisible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  // Handle modal closing
  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      handleIndicatorStyle={styles.indicator}
      backgroundStyle={[
        styles.background,
        { backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background }
      ]}
    >
      <BottomSheetView style={styles.contentContainer}>
        <ProfileSection />
        <View style={styles.divider} />
        <RoutingPreferences 
          preferences={preferences}
          onToggle={handleTogglePreference}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  indicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
});

export default SettingsModal;
