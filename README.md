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

2. **Environment Variables**:

Create a `.env` file in the root directory.

```
# LOW SENSITIVITY KEYS
API_URL=api_url
IOS_GOOGLE_CLIENT_ID=web_client_id
REVERSED_IOS_GOOGLE_CLIENT_ID=reversed_ios_client_id
ANDROID_GOOGLE_CLIENT_ID=web_client_id
MAPBOX_PK=public_mapbox

# HIGH SENSITIVITY KEYS
MAPBOX_SK=secret_mapbox
```

Create a `.env.rnconfig` file in the root directory.

```
   # LOW SENSITIVITY KEYS
   API_URL=api_url
   IOS_GOOGLE_CLIENT_ID=web_client_id
   REVERSED_IOS_GOOGLE_CLIENT_ID=reversed_ios_client_id
   ANDROID_GOOGLE_CLIENT_ID=web_client_id
   MAPBOX_PK=public_mapbox
```

The difference between the two .env is that one is kept hidden from the builder when generating the APK and the other is not. This prevents sensible keys to be coded into the production APK, preventing users from reverse engineering sensible keys.

## Installation

1. Install dependencies

   ```bash
   npm install
   ```

2. Generate native code for Android/iOS

   ```bash
   npx expo prebuild --clean
   ```

3. Link .env.rnconfig variable to native Android

   ```bash
   npx react-native-integrate react-native-config
   ```

   and add this line near the top of `.\android\app\build.gradle`

   ```bash
   apply from: project(':react-native-config').projectDir.getPath() + "/dotenv.gradle"
   ```

4. Start the development build
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
  1. Verify your `.env` and `.env.rnconfig` files exist
  2. Check that the Mapbox tokens are valid. Make sure to not confuse between secret and public keys.
  3. Rebuild the app

## Development

The app uses Expo for development. Key directories:

- `/app`: Main application code
- `/components`: Reusable React components
- `/hooks`: Custom React hooks
- `/types`: TypeScript type definitions

## License

This project is MIT licensed.
