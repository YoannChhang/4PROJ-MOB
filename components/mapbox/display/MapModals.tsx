// components/map/MapModals.tsx
import React from 'react';
import ReportAlertModal from '@/components/mapbox/pins/ReportAlertModal';
import LoginRequiredModal from '@/components/mapbox/pins/LoginRequiredModal';
import SideMenu from '@/components/settings/SideMenu';
import PinInfoModal from '@/components/mapbox/pins/PinInfoModal';
import { PinRead, UserPreferences } from '@/types/api';
import { RoutingPreference } from '@/components/settings/RoutingPreferences';

interface MapModalsProps {
  reportModalVisible: boolean;
  userLocationForModal: { longitude: number; latitude: number } | null;
  onCloseReportModal: () => void;
  loginPromptVisible: boolean;
  onCloseLoginPrompt: () => void;
  onNavigateToLogin: () => void;
  isSideMenuOpen: boolean;
  onToggleSideMenu: () => void;
  preferences: RoutingPreference[];
  onTogglePreference: (id: string, value: boolean) => void;
  selectedPinForModal: PinRead | null;
  onClosePinInfoModal: () => void;
}

const MapModals: React.FC<MapModalsProps> = ({
  reportModalVisible,
  userLocationForModal,
  onCloseReportModal,
  loginPromptVisible,
  onCloseLoginPrompt,
  onNavigateToLogin,
  isSideMenuOpen,
  onToggleSideMenu,
  preferences,
  onTogglePreference,
  selectedPinForModal,
  onClosePinInfoModal,
}) => {
  return (
    <>
      {reportModalVisible && ( // Conditionally render to ensure userLocationForModal is not null when modal is active
        <ReportAlertModal
          userLocation={userLocationForModal}
          isVisible={reportModalVisible}
          onClose={onCloseReportModal}
        />
      )}
      <LoginRequiredModal
        visible={loginPromptVisible}
        onClose={onCloseLoginPrompt}
        onNavigateToLogin={onNavigateToLogin}
      />
      <SideMenu
        isVisible={isSideMenuOpen}
        onClose={onToggleSideMenu}
        toLogin={onNavigateToLogin}
        preferences={preferences}
        onTogglePreference={onTogglePreference}
      />
      <PinInfoModal
        selectedPin={selectedPinForModal}
        onClose={onClosePinInfoModal}
      />
    </>
  );
};

export default MapModals;