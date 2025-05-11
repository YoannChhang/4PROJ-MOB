export default ({ config }) => ({
  expo: {
    name: "4NEW",
    slug: "4NEW",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    platforms: ["ios", "android"],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.yoannchh.x4NEW",
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      ["expo-barcode-scanner"],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: process.env.REVERSED_IOS_GOOGLE_CLIENT_ID,
        },
      ],
      [
        // highlight-start
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_SK,
          RNMapboxMapsVersion: "11.0.0",
        },
        // highlight-end
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Autoriser l'accès à votre localisation même lorsque l'application est fermée.",
          locationAlwaysPermission:
            "Autoriser cette application à accéder à votre localisation à tout moment.",
          isAndroidForegroundServiceEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
});
