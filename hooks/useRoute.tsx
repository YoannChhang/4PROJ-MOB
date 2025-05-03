import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import Tts from 'react-native-tts';
import { MapboxDirectionsResponse, Route, Step, VoiceInstruction } from '@/types/mapbox';
import { useUser } from '@/providers/UserProvider';
import Config from 'react-native-config';

// Mapbox API access token
const MAPBOX_ACCESS_TOKEN = Config.MAPBOX_PK;

// Distance threshold in meters to consider if user is off-route
const OFF_ROUTE_THRESHOLD = 50;
// Distance to announce next maneuver (in meters)
const ANNOUNCEMENT_DISTANCES = [1000, 500, 200, 100, 50];
// Minimum distance (in meters) between route calculation attempts
const RECALCULATION_DISTANCE_THRESHOLD = 10;
// Minimum time (in ms) between route calculation attempts
const RECALCULATION_TIME_THRESHOLD = 10000;

/**
 * Custom hook for routing functionality
 * @param origin Starting point [longitude, latitude]
 * @param destination Ending point [longitude, latitude]
 * @returns Routing state and functions
 */
export default function useRoute(
  origin: [number, number] | null,
  destination: [number, number] | null
) {
  // Get user preferences
  const { userData } = useUser();

  // Core routing state
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [alternateRoutes, setAlternateRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<[number, number] | null>(null);
  const [traveledCoords, setTraveledCoords] = useState<[number, number][]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<number | null>(null);
  const [announcementsMade, setAnnouncementsMade] = useState<Set<number>>(new Set());
  
  // Rerouting state
  const [routeExcludes, setRouteExcludes] = useState<string[] | undefined>(undefined);
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const lastRerouteLocation = useRef<[number, number] | null>(null);
  const lastRerouteTime = useRef<number>(0);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Set up Text-to-Speech
  useEffect(() => {
    const initTts = async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDefaultLanguage('fr-FR');
        Tts.setDefaultRate(0.5);
      } catch (err) {
        console.error('Failed to initialize TTS:', err);
      }
    };

    initTts();

    return () => {
      // Clean up TTS when component unmounts
      Tts.stop();
    };
  }, []);

  // Parse user preferences into route excludes
  useEffect(() => {
    if (!userData?.preferences) return;

    const excludes: string[] = [];
    if (userData.preferences.avoid_tolls) excludes.push('toll');
    if (userData.preferences.avoid_highways) excludes.push('motorway');
    if (userData.preferences.avoid_unpaved) excludes.push('unpaved');

    setRouteExcludes(excludes.length > 0 ? excludes : undefined);
  }, [userData?.preferences]);

  // Fetch routes when origin or destination changes
  useEffect(() => {
    const fetchRoutes = async () => {
      if (!origin || !destination) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Format the request URL with optional exclude parameters
        let url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
        
        // Add query parameters
        const params = new URLSearchParams({
          access_token: MAPBOX_ACCESS_TOKEN,
          alternatives: 'true',
          geometries: 'geojson',
          overview: 'full',
          steps: 'true',
          voice_instructions: 'true',
          voice_units: 'metric',
          language: 'fr',
          annotations: 'duration,distance,speed,congestion'
        });

        // Add exclude parameters if needed
        if (routeExcludes && routeExcludes.length > 0) {
          params.append('exclude', routeExcludes.join(','));
        }

        url += `?${params.toString()}`;

        const response = await axios.get<MapboxDirectionsResponse>(url);
        
        if (response.data.routes.length > 0) {
          const primaryRoute = response.data.routes[0];
          const otherRoutes = response.data.routes.slice(1);
          
          setSelectedRoute(primaryRoute);
          setAlternateRoutes(otherRoutes);
          
          // Reset navigation state
          setCurrentStepIndex(0);
          setTraveledCoords([]);
          setAnnouncementsMade(new Set());
          
          // Set initial instruction
          if (primaryRoute.legs[0]?.steps[0]) {
            setCurrentInstruction(primaryRoute.legs[0].steps[0].maneuver.instruction);
          }
        } else {
          setError('No routes found');
        }
      } catch (err) {
        console.error('Error fetching routes:', err);
        setError('Failed to fetch routes');
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [origin, destination, routeExcludes]);

  // Start user location tracking for navigation
  const startLocationTracking = async () => {
    // Clear any existing subscription
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }

    // Start a new subscription
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, // Update every 5 meters
        timeInterval: 1000,  // Or at least every 1 second
      },
      (location) => {
        const coords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        
        setLiveUserLocation(coords);
        
        // Update traveled coordinates for the route line
        if (isNavigating && selectedRoute) {
          updateTraveledRoute(coords);
        }
      }
    );
  };

  // Update the traveled portion of the route
  const updateTraveledRoute = (userLocation: [number, number]) => {
    if (!selectedRoute || !isNavigating) return;

    // Add user location to traveled coordinates
    setTraveledCoords(prev => {
      // Check if the user has moved significantly from the last point
      const lastPoint = prev[prev.length - 1];
      if (lastPoint) {
        const distance = turf.distance(
          turf.point(lastPoint),
          turf.point(userLocation),
          { units: 'meters' }
        );
        
        // Only add the point if the user has moved at least 5 meters
        if (distance < 5) {
          return prev;
        }
      }
      
      return [...prev, userLocation];
    });

    // Check if user is on route
    checkRouteProgress(userLocation);
  };

  // Check user's progress along the route
  const checkRouteProgress = (userLocation: [number, number]) => {
    if (!selectedRoute || !isNavigating) return;

    try {
      // Get current leg (typically just one for simple routes)
      const currentLeg = selectedRoute.legs[0];
      if (!currentLeg) return;
      
      // Get all steps in the route
      const steps = currentLeg.steps;
      if (!steps || steps.length === 0) return;
      
      // Convert route line to a turf LineString
      const routeLine = turf.lineString(selectedRoute.geometry.coordinates);
      
      // Find the nearest point on the route line to the user's location
      const userPoint = turf.point(userLocation);
      const snapped = turf.nearestPointOnLine(routeLine, userPoint, { units: 'meters' });
      
      // Calculate distance from user to the route
      const distanceFromRoute = snapped.properties.dist || Infinity;
      
      // Check if user is off route
      if (distanceFromRoute > OFF_ROUTE_THRESHOLD) {
        // Check if enough time and distance has passed since last reroute
        const shouldRecalculate = checkShouldRecalculate(userLocation);
        
        if (shouldRecalculate) {
          handleReroute(userLocation);
        }
        
        return;
      }
      
      // Find current step and maneuver
      // Get the index along the line (percentage from 0 to 1)
      const currentIndex = snapped.properties.index || 0;
      const location = snapped.properties.location || 0;
      
      // Find which step we're currently in
      let newStepIndex = currentStepIndex;
      let cumulativeDistance = 0;
      
      // Calculate progress through the route
      for (let i = 0; i < steps.length; i++) {
        const stepDistance = steps[i].distance;
        if (location >= cumulativeDistance && location < cumulativeDistance + stepDistance) {
          newStepIndex = i;
          break;
        }
        cumulativeDistance += stepDistance;
      }
      
      // Update step index if needed
      if (newStepIndex !== currentStepIndex) {
        setCurrentStepIndex(newStepIndex);
        
        // Announce the new instruction
        const newInstruction = steps[newStepIndex].maneuver.instruction;
        setCurrentInstruction(newInstruction);
        speakInstruction(newInstruction);
        
        // Reset announcements for the new step
        setAnnouncementsMade(new Set());
      }
      
      // Calculate distance to the next maneuver
      if (newStepIndex < steps.length - 1) {
        const nextManeuverCoords = steps[newStepIndex + 1].maneuver.location;
        const distance = turf.distance(
          turf.point(userLocation),
          turf.point(nextManeuverCoords),
          { units: 'meters' }
        ) * 1000; // Convert km to meters
        
        setDistanceToNextManeuver(distance);
        
        // Check if we need to announce upcoming maneuver
        checkAnnouncementDistances(distance, steps[newStepIndex + 1]);
      } else {
        // We're on the last step, calculate distance to destination
        const destinationCoords = selectedRoute.geometry.coordinates[selectedRoute.geometry.coordinates.length - 1];
        const distance = turf.distance(
          turf.point(userLocation),
          turf.point(destinationCoords),
          { units: 'meters' }
        ) * 1000; // Convert km to meters
        
        setDistanceToNextManeuver(distance);
        
        // Check if we've arrived
        if (distance < 20) {
          speakInstruction("Vous êtes arrivé à destination");
          setIsNavigating(false);
        }
      }
    } catch (err) {
      console.error('Error checking route progress:', err);
    }
  };

  // Check if we should announce an upcoming maneuver
  const checkAnnouncementDistances = (distance: number, step: Step) => {
    // Find voice instructions for this step
    const voiceInstructions = step.voiceInstructions || [];
    
    // Check each announcement distance
    for (const threshold of ANNOUNCEMENT_DISTANCES) {
      // Only announce if we're within 5 meters of the threshold and haven't announced yet
      if (
        distance <= threshold + 5 && 
        distance >= threshold - 5 && 
        !announcementsMade.has(threshold)
      ) {
        // Find the appropriate voice instruction for this distance
        const instruction = findVoiceInstructionForDistance(voiceInstructions, distance);
        
        if (instruction) {
          speakInstruction(instruction.announcement);
          
          // Mark this announcement as made
          setAnnouncementsMade(prev => {
            const newSet = new Set(prev);
            newSet.add(threshold);
            return newSet;
          });
        }
      }
    }
  };

  // Find the appropriate voice instruction for a given distance
  const findVoiceInstructionForDistance = (
    instructions: VoiceInstruction[],
    currentDistance: number
  ): VoiceInstruction | undefined => {
    // Sort instructions by distance (descending)
    const sortedInstructions = [...instructions].sort(
      (a, b) => b.distanceAlongGeometry - a.distanceAlongGeometry
    );
    
    // Find the first instruction with a distance less than the current distance
    return sortedInstructions.find(
      instruction => instruction.distanceAlongGeometry <= currentDistance + 10
    );
  };

  // Speak an instruction using TTS
  const speakInstruction = (instruction: string) => {
    // Stop any currently speaking instruction
    Tts.stop();
    
    // Speak the new instruction
    Tts.speak(instruction);
  };

  // Check if we should recalculate the route
  const checkShouldRecalculate = (userLocation: [number, number]): boolean => {
    const now = Date.now();
    
    // If we're already rerouting, wait until it's done
    if (isRerouting) return false;
    
    // Check if enough time has passed since last reroute
    const timeSinceLastReroute = now - lastRerouteTime.current;
    if (timeSinceLastReroute < RECALCULATION_TIME_THRESHOLD) return false;
    
    // Check if we've moved enough since last reroute
    if (lastRerouteLocation.current) {
      const distanceSinceLastReroute = turf.distance(
        turf.point(userLocation),
        turf.point(lastRerouteLocation.current),
        { units: 'meters' }
      );
      
      if (distanceSinceLastReroute < RECALCULATION_DISTANCE_THRESHOLD) return false;
    }
    
    return true;
  };

  // Handle rerouting when user goes off course
  const handleReroute = async (userLocation: [number, number]) => {
    if (!destination || !isNavigating) return;
    
    setIsRerouting(true);
    lastRerouteLocation.current = userLocation;
    lastRerouteTime.current = Date.now();
    
    try {
      // Announce rerouting
      speakInstruction("Recalcul d'itinéraire en cours");
      
      // Construct the URL for the Mapbox Directions API
      let url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLocation[0]},${userLocation[1]};${destination[0]},${destination[1]}`;
      
      // Add query parameters
      const params = new URLSearchParams({
        access_token: MAPBOX_ACCESS_TOKEN,
        alternatives: 'false', // Only need main route for recalculation
        geometries: 'geojson',
        overview: 'full',
        steps: 'true',
        voice_instructions: 'true',
        voice_units: 'metric',
        language: 'fr',
        annotations: 'duration,distance,speed,congestion'
      });

      // Add exclude parameters if needed
      if (routeExcludes && routeExcludes.length > 0) {
        params.append('exclude', routeExcludes.join(','));
      }

      url += `?${params.toString()}`;
      
      const response = await axios.get<MapboxDirectionsResponse>(url);
      
      if (response.data.routes.length > 0) {
        const newRoute = response.data.routes[0];
        
        // Update the route
        setSelectedRoute(newRoute);
        setAlternateRoutes([]);
        
        // Reset navigation state
        setCurrentStepIndex(0);
        setTraveledCoords([userLocation]);
        setAnnouncementsMade(new Set());
        
        // Set initial instruction
        if (newRoute.legs[0]?.steps[0]) {
          const newInstruction = newRoute.legs[0].steps[0].maneuver.instruction;
          setCurrentInstruction(newInstruction);
          speakInstruction("Nouvel itinéraire. " + newInstruction);
        }
      }
    } catch (err) {
      console.error('Error during rerouting:', err);
      // Continue with existing route
    } finally {
      setIsRerouting(false);
    }
  };

  // Start navigation mode
  const startNavigation = async () => {
    if (!selectedRoute) return;
    
    try {
      // Set navigation mode
      setIsNavigating(true);
      
      // Reset navigation state
      setTraveledCoords([]);
      setCurrentStepIndex(0);
      setAnnouncementsMade(new Set());
      
      // Set initial instruction
      if (selectedRoute.legs[0]?.steps[0]) {
        const instruction = selectedRoute.legs[0].steps[0].maneuver.instruction;
        setCurrentInstruction(instruction);
        speakInstruction(instruction);
      }
      
      // Start location tracking
      await startLocationTracking();
    } catch (err) {
      console.error('Error starting navigation:', err);
      setIsNavigating(false);
    }
  };

  // Stop navigation mode
  const stopNavigation = () => {
    // Stop location tracking
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    
    // Stop TTS
    Tts.stop();
    
    // Reset navigation state
    setIsNavigating(false);
    setTraveledCoords([]);
    setCurrentStepIndex(0);
    setCurrentInstruction('');
    setDistanceToNextManeuver(null);
    setAnnouncementsMade(new Set());
  };

  // Change routes (e.g., user selects an alternate route)
  const chooseRoute = (route: Route, previousRoute: Route | null) => {
    // Don't do anything if the same route is selected
    if (previousRoute === route) return;
    
    // Update selected route
    setSelectedRoute(route);
    
    // Update alternate routes (filter out the newly selected route)
    if (previousRoute) {
      setAlternateRoutes(prev => 
        [...prev.filter(r => r !== route), previousRoute].sort(
          (a, b) => a.duration - b.duration
        )
      );
    } else {
      setAlternateRoutes(prev => prev.filter(r => r !== route));
    }
    
    // Reset navigation state
    setCurrentStepIndex(0);
    setTraveledCoords([]);
    setAnnouncementsMade(new Set());
    
    // Set initial instruction
    if (route.legs[0]?.steps[0]) {
      setCurrentInstruction(route.legs[0].steps[0].maneuver.instruction);
    }
  };

  // Clean up when the hook unmounts
  useEffect(() => {
    return () => {
      // Stop location tracking
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      
      // Stop TTS
      Tts.stop();
    };
  }, []);

  return {
    // Route state
    selectedRoute,
    setSelectedRoute,
    alternateRoutes,
    setAlternateRoutes,
    loading,
    error,
    
    // Navigation state
    isNavigating,
    setIsNavigating,
    liveUserLocation,
    traveledCoords,
    currentInstruction,
    distanceToNextManeuver,
    
    // Route filtering
    routeExcludes,
    setRouteExcludes,
    
    // Actions
    startNavigation,
    stopNavigation,
    chooseRoute
  };
}
