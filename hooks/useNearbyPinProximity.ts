// hooks/useNearbyPinProximity.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { PinRead } from '@/types/api';
import { Coordinate } from '@/hooks/routing/utils/types'; // Assuming this is [lon, lat]
import { calculateDistanceInMeters } from '@/hooks/routing/utils/routeAnalysis';

// --- Constants for this hook ---
const PIN_GENERAL_PROXIMITY_THRESHOLD_METERS = 50;
const PIN_GLOBAL_PROMPT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

interface UseNearbyPinProximityResult {
  pinForConfirmationAttempt: PinRead | null; // The pin that meets criteria for a prompt
  confirmPinHandled: (pinId: string) => void;    // Call this after modal is dealt with for this pin
}

export const useNearbyPinProximity = (
  userLocation: Coordinate | null,
  alertPins: PinRead[] | null,
  isPinConfirmationModalVisible: boolean // To prevent new prompts while one is active
): UseNearbyPinProximityResult => {
  const [pinForConfirmationAttempt, setPinForConfirmationAttempt] = useState<PinRead | null>(null);
  const lastGlobalPromptTimeRef = useRef<number>(0);
  // Tracks pins that have been selected for a prompt attempt in the current "cooldown window"
  // to avoid re-selecting them immediately if the user stays near multiple pins.
  const recentlyAttemptedPinIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Clear recently attempted pins when the global cooldown period effectively resets
    const timerId = setInterval(() => {
        if (Date.now() - lastGlobalPromptTimeRef.current >= PIN_GLOBAL_PROMPT_COOLDOWN_MS) {
            recentlyAttemptedPinIdsRef.current.clear();
        }
    }, PIN_GLOBAL_PROMPT_COOLDOWN_MS / 2); // Check periodically

    return () => clearInterval(timerId);
  }, []);


  useEffect(() => {
    if (!userLocation || !alertPins || alertPins.length === 0 || isPinConfirmationModalVisible || pinForConfirmationAttempt) {
      // If no location, no pins, modal is already up, or a pin is already pending confirmation, do nothing.
      return;
    }

    const now = Date.now();
    if (now - lastGlobalPromptTimeRef.current < PIN_GLOBAL_PROMPT_COOLDOWN_MS) {
      // Still in global cooldown for *any* pin prompt
      return;
    }

    const eligiblePins: PinRead[] = [];
    for (const pin of alertPins) {
      // Skip if this pin was recently selected for an attempt (even if modal was dismissed quickly)
      if (recentlyAttemptedPinIdsRef.current.has(pin.id)) {
        continue;
      }

      const distanceToPin = calculateDistanceInMeters(userLocation, [pin.longitude, pin.latitude]);
      if (distanceToPin < PIN_GENERAL_PROXIMITY_THRESHOLD_METERS) {
        eligiblePins.push(pin);
      }
    }

    if (eligiblePins.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligiblePins.length);
      const selectedPinToAttempt = eligiblePins[randomIndex];

      console.log(`[useNearbyPinProximity] Selected pin ${selectedPinToAttempt.id} for confirmation attempt.`);
      setPinForConfirmationAttempt(selectedPinToAttempt);
      lastGlobalPromptTimeRef.current = now; // Update timestamp for the global cooldown
      recentlyAttemptedPinIdsRef.current.add(selectedPinToAttempt.id); // Mark as attempted for this cooldown window
    }
  }, [userLocation, alertPins, isPinConfirmationModalVisible, pinForConfirmationAttempt]);

  const confirmPinHandled = useCallback((pinId: string) => {
    // Called from app/index.tsx after the modal for `pinId` is resolved.
    // This allows a new pin to be picked by the useEffect if conditions are met.
    setPinForConfirmationAttempt(null);
    // `recentlyAttemptedPinIdsRef` will clear based on its own timer logic,
    // or when the global cooldown expires. No need to remove `pinId` here immediately,
    // as we don't want to re-prompt for it right away if the user lingers.
    console.log(`[useNearbyPinProximity] Confirmation handled for pin ${pinId}. Ready for next potential prompt.`);
  }, []);

  return { pinForConfirmationAttempt, confirmPinHandled };
};