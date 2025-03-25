# Navigation App with Mapbox 🗺️

A React Native navigation app using Mapbox for real-time routing and navigation.

## Prerequisites

- Node.js (v18 or higher)
- Java Development Kit (JDK) 17
- Android Studio
- Android SDK
- A Mapbox account and access token

## Important Setup Notes

1. **Project Path Length**: Ensure your project path is relatively short to avoid Windows path length issues

   ```
   ❌ C:\Users\Username\Documents\Projects\React Native\Navigation\MyApp
   ✅ C:\Dev\NavApp
   ```

2. **Environment Variables**: Create a `.env` file in the root directory.

   ```
   EXPO_PUBLIC_API_URL=api_url
   EXPO_PUBLIC_IOS_GOOGLE_CLIENT_ID=web_client_id
   EXPO_PUBLIC_REVERSED_IOS_GOOGLE_CLIENT_ID=reversed_ios_client_id
   EXPO_PUBLIC_ANDROID_GOOGLE_CLIENT_ID=web_client_id
   EXPO_PUBLIC_MAPBOX_SK=secret_mapbox
   ```

## Installation

1. Install dependencies

   ```bash
   npm install
   ```

2. Generate native code for Android/iOS

   ```bash
   npx expo prebuild --clean
   ```

3. Start the development build
   ```bash
   npm run android
   ```

## Troubleshooting

### Common Issues

- **Build Failures**: If you encounter build failures, try:

  ```bash
  cd android
  ./gradlew clean
  cd ..
  npm run android
  ```

- **Path Length Issues**: If you see CMake errors during build, it is most likely due to the path length:

  1. Move the project to a shorter path
  2. Clean and rebuild

- **Environment Variables**: If Mapbox features aren't working:
  1. Verify your `.env` file exists
  2. Check that the Mapbox token is valid
  3. Rebuild the app

## Development

The app uses Expo for development. Key directories:

- `/app`: Main application code
- `/components`: Reusable React components
- `/hooks`: Custom React hooks
- `/types`: TypeScript type definitions

## License

This project is MIT licensed.
