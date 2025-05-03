import * as Location from 'expo-location';
import { EventEmitter } from 'events';

// Define event types
type LocationEvents = {
  'locationUpdate': (location: [number, number]) => void;
  'locationError': (error: Error) => void;
  'headingUpdate': (heading: number) => void;
};

/**
 * Class to handle location tracking with event-based updates
 */
class LocationTracker extends EventEmitter {
  private subscriptions: {
    location?: Location.LocationSubscription;
    heading?: Location.LocationSubscription;
  } = {};
  
  private tracking: boolean = false;
  private lastLocation: [number, number] | null = null;
  private lastHeading: number | null = null;
  private trackingOptions: Location.LocationOptions = {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5, // Update every 5 meters
    timeInterval: 1000, // Or at least every 1 second
  };

  constructor() {
    super();
  }

  /**
   * Start tracking the user's location
   */
  public async startTracking(options?: Partial<Location.LocationOptions>): Promise<boolean> {
    // Check if we're already tracking
    if (this.tracking) return true;

    // Check and request permissions if needed
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      this.emit('locationError', new Error('Location permission not granted'));
      return false;
    }

    // Update options if provided
    if (options) {
      this.trackingOptions = { ...this.trackingOptions, ...options };
    }

    try {
      // Start location tracking
      this.subscriptions.location = await Location.watchPositionAsync(
        this.trackingOptions,
        (location) => {
          const coords: [number, number] = [
            location.coords.longitude,
            location.coords.latitude,
          ];
          
          this.lastLocation = coords;
          this.emit('locationUpdate', coords);
        }
      );

      // Start heading tracking
      this.subscriptions.heading = await Location.watchHeadingAsync(
        (headingData) => {
          const heading = headingData.trueHeading || headingData.magHeading;
          this.lastHeading = heading;
          this.emit('headingUpdate', heading);
        }
      );

      this.tracking = true;
      return true;
    } catch (error) {
      this.emit('locationError', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Stop tracking the user's location
   */
  public stopTracking(): void {
    if (this.subscriptions.location) {
      this.subscriptions.location.remove();
      this.subscriptions.location = undefined;
    }

    if (this.subscriptions.heading) {
      this.subscriptions.heading.remove();
      this.subscriptions.heading = undefined;
    }

    this.tracking = false;
  }

  /**
   * Get the user's last known location
   */
  public async getLastKnownLocation(): Promise<[number, number] | null> {
    // Return cached location if available
    if (this.lastLocation) {
      return this.lastLocation;
    }

    // Otherwise, get the last known location from the device
    try {
      const location = await Location.getLastKnownPositionAsync();
      if (location) {
        const coords: [number, number] = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        this.lastLocation = coords;
        return coords;
      }
      return null;
    } catch (error) {
      this.emit('locationError', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Get the current heading (direction)
   */
  public getHeading(): number | null {
    return this.lastHeading;
  }

  /**
   * Check if location tracking is active
   */
  public isTracking(): boolean {
    return this.tracking;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.stopTracking();
    this.removeAllListeners();
  }

  /**
   * Add typed event listener
   */
  public on<E extends keyof LocationEvents>(
    event: E, 
    listener: LocationEvents[E]
  ): this {
    return super.on(event, listener);
  }

  /**
   * Remove typed event listener
   */
  public off<E extends keyof LocationEvents>(
    event: E,
    listener: LocationEvents[E]
  ): this {
    return super.off(event, listener);
  }
}

// Create a singleton instance
const locationTracker = new LocationTracker();
export default locationTracker;