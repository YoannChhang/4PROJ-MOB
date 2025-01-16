import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  "expo": {
    ...config.expo,
    "name": "4proj-mobile",
    "slug": "4proj-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "myapp",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "ios": {
      "supportsTablet": true
    },
    "android": {
       "package": "com.yoannchh.x4projmobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      }
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": `com.googleusercontent.apps.${process.env.EXPO_PUBLIC_REVERSED_IOS_GOOGLE_CLIENT_ID}`
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
);