import {
    MD3LightTheme as DefaultLightTheme,
    MD3DarkTheme as DefaultDarkTheme,
    useTheme,
  } from "react-native-paper";
  
  // Customize react-native-paper theme here. Follow instructions on :
  // https://callstack.github.io/react-native-paper/docs/guides/theming/#theme-properties
  
  const tintColorLight = "#1f69e7";
  const tintColorDark = "#fff";
  
  export const CustomLightTheme = {
    ...DefaultLightTheme,
    colors: {
      ...DefaultLightTheme.colors,
      text: "#11181C",
      tint: tintColorLight,
      icon: "#687076",
      tabIconDefault: "#687076",
      tabIconSelected: tintColorLight,
      white: "#FFFFFF",
      black: "#000000",
    },
  };
  
  export const CustomDarkTheme = {
    ...DefaultDarkTheme,
    colors: {
      ...DefaultDarkTheme.colors,
      text: "#ECEDEE",
      tint: tintColorDark,
      icon: "#9BA1A6",
      tabIconDefault: "#9BA1A6",
      tabIconSelected: tintColorDark,
      white: "#FFFFFF",
      black: "#000000",
    },
  };
  
  export type AppTheme = typeof CustomLightTheme & typeof CustomDarkTheme;
  
  export const useAppTheme = () => useTheme<AppTheme>();
  