// app/_layout.tsx
// root layout - wraps entire app with providers
import "../src/polyfills";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* stack navigator at root level */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* (tabs) is a group - renders the tab navigator */}
        <Stack.Screen name="(tabs)" />
        {/* token detail screen stacks on top of tabs */}
        <Stack.Screen name="token/[mint]" />
        {/* send sol modal screen */}
        <Stack.Screen
          name="send"
          options={{
            presentation: "modal",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
