/**
 * Parses a route URL from QR code into a structured object
 * 
 * Example URL formats:
 * https://mayz.com/route?to=5.377085;43.294235&exclude=motorway,toll,ferry
 * https://mayz.com/route?to=5.377085;43.294235
 */

export interface ParsedRouteParams {
  toCoords: [number, number] | null;   // [longitude, latitude]
  excludes?: string[];
  isValid: boolean;
}

export const parseRouteUrl = (url: string): ParsedRouteParams => {
  // Default return with invalid state
  const defaultResponse: ParsedRouteParams = {
    toCoords: null,
    isValid: false
  };
  
  try {
    // Check if the URL matches our expected format
    if (!url.startsWith('https://mayz.com/route?')) {
      return defaultResponse;
    }
    
    // Create URL object to easily parse parameters
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    
    // Parse to coordinates
    const toParam = params.get('to');
    
    if (!toParam) {
      return defaultResponse;
    }
    
    // Parse to coordinates (longitude;latitude format)
    const toCoords = toParam.split(';').map(Number);
    if (toCoords.length !== 2 || isNaN(toCoords[0]) || isNaN(toCoords[1])) {
      return defaultResponse;
    }
    
    // Parse optional excludes (this is the key parameter for routing)
    let excludes: string[] | undefined;
    const excludeParam = params.get('exclude');
    if (excludeParam) {
      excludes = excludeParam.split(',');
    }
    
    return {
      toCoords: [toCoords[0], toCoords[1]],
      excludes,
      isValid: true
    };
  } catch (error) {
    console.error('Error parsing route URL:', error);
    return defaultResponse;
  }
};