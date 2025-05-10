import Tts from 'react-native-tts';

/**
 * Class to manage Text-to-Speech functionality for navigation
 */
class TtsManager {
  private initialized: boolean = false;
  private defaultLanguage: string = 'fr-FR';
  private defaultRate: number = 0.5;
  private lastSpokenInstruction: string = '';

  /**
   * Initialize the TTS engine
   * @returns Promise that resolves when TTS is initialized
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Tts.getInitStatus();
      await Tts.setDefaultLanguage(this.defaultLanguage);
      await Tts.setDefaultRate(this.defaultRate);
      this.initialized = true;
      console.log('TTS initialized successfully');
    } catch (err) {
      console.error('Failed to initialize TTS:', err);
      throw err;
    }
  }

  /**
   * Speak an instruction
   * @param instruction - The text to speak
   * @param force - Whether to speak even if it's a duplicate of the last instruction
   */
  public speak(instruction: string, force: boolean = false): void {
    // Don't repeat the same instruction unless forced
    if (!force && instruction === this.lastSpokenInstruction) {
      return;
    }

    // Initialize TTS if not already done
    if (!this.initialized) {
      this.initialize().catch(() => {
        console.error('TTS could not be initialized');
      });
    }

    // Stop any current speech
    Tts.stop();

    // Speak the new instruction
    Tts.speak(instruction);
    this.lastSpokenInstruction = instruction;
  }

  /**
   * Stop any current speech
   */
  public stop(): void {
    Tts.stop();
  }

  /**
   * Change the speech rate
   * @param rate - The rate of speech (0.0 to 1.0)
   */
  public async setRate(rate: number): Promise<void> {
    this.defaultRate = rate;
    await Tts.setDefaultRate(rate);
  }

  /**
   * Change the speech language
   * @param language - The language code (e.g., 'fr-FR', 'en-US')
   */
  public async setLanguage(language: string): Promise<void> {
    this.defaultLanguage = language;
    await Tts.setDefaultLanguage(language);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    Tts.stop();
  }
}

// Create a singleton instance
const ttsManager = new TtsManager();
export default ttsManager;