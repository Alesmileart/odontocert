import { Stack } from "expo-router";

export default function DeclarationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="new" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
