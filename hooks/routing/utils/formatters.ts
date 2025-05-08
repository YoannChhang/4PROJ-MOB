// src/hooks/routing/utils/formatters.ts

/**
 * Format duration for display
 * @param seconds Duration in seconds
 * @returns Formatted string (e.g. "1h 30min")
 */
export const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
  
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };
  
  /**
   * Format distance for display
   * @param meters Distance in meters
   * @returns Formatted string (e.g. "10.5 km")
   */
  export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };
  
  /**
   * Format a maneuver instruction to be more user-friendly
   * @param instruction Original instruction 
   * @param distanceToNextManeuver Distance to the next maneuver in meters
   * @returns Formatted instruction with distance information
   */
  export const formatInstruction = (
    instruction: string, 
    distanceToNextManeuver: number | null
  ): string => {
    // Add distance information
    if (distanceToNextManeuver !== null) {
      const distance = distanceToNextManeuver < 1000 
        ? `${Math.round(distanceToNextManeuver)} mètres` 
        : `${(distanceToNextManeuver / 1000).toFixed(1)} kilomètres`;
      
      // Check if instruction already contains distance information
      if (!instruction.includes('mètres') && !instruction.includes('kilomètre')) {
        return `Dans ${distance}, ${instruction.toLowerCase()}`;
      }
    }
    
    return instruction;
  };