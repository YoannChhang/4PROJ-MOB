// components/map/MapControlsOverlay.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import HamburgerMenuButton from '@/components/settings/HamburgerMenuButton';
import IncidentReportButton from '@/components/mapbox/pins/IncidentReportButton';
import QRCodeButton from '@/components/mapbox/searchAndNav/QRCodeButton';
import FloatingActionButton from '@/components/ui/FloatingActionButton';

interface MapControlsOverlayProps {
  onToggleSideMenu: () => void;
  onOpenReportModal: () => void;
  isSignedIn: boolean;
  onShowLoginPrompt: () => void;
  onQRScan: () => void;
  isNavigating: boolean;
  uiMode: "map" | "search" | "route-selection" | "navigation";
  isSideMenuOpen: boolean;
  onToggleSearchUI: () => void;
}

const MapControlsOverlay: React.FC<MapControlsOverlayProps> = ({
  onToggleSideMenu,
  onOpenReportModal,
  isSignedIn,
  onShowLoginPrompt,
  onQRScan,
  isNavigating,
  uiMode,
  isSideMenuOpen,
  onToggleSearchUI,
}) => {
  return (
    <>
      <HamburgerMenuButton onPress={onToggleSideMenu} />
      <IncidentReportButton
        onPress={onOpenReportModal}
        isSignedIn={isSignedIn}
        onLoginRequired={onShowLoginPrompt}
      />
      <QRCodeButton onPress={onQRScan} />

      {!isNavigating && uiMode === 'map' && !isSideMenuOpen && (
        <FloatingActionButton
          iconName="search-location"
          onPress={onToggleSearchUI}
          visible={true}
          backgroundColor="#4285F4"
          size="medium"
          style={styles.searchFab}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  searchFab: {
    bottom: 20,
    left: 20,
  },
  trafficIndicator: {
    position: 'absolute',
    top: 50,
    right: 120, // This might need adjustment based on other buttons
    zIndex: 10,
  },
});

export default MapControlsOverlay;