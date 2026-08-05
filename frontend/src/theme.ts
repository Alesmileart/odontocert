// Central design tokens for OdontoCert — derived from design_guidelines.json.
// Personality: iOS-Native Clean. Brand: Deep Sage Green. No blues/purples.

export const colors = {
  surface: "#FCFDFD",
  onSurface: "#111412",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#3A423D",
  surfaceTertiary: "#F0F3F1",
  onSurfaceTertiary: "#2D332F",
  surfaceInverse: "#111412",
  onSurfaceInverse: "#FFFFFF",
  brand: "#2D4A3E",
  brandPrimary: "#2D4A3E",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E9EFEA",
  onBrandSecondary: "#2D4A3E",
  brandTertiary: "#F3F7F4",
  onBrandTertiary: "#2D4A3E",
  success: "#246B44",
  onSuccess: "#FFFFFF",
  warning: "#9C6A14",
  onWarning: "#FFFFFF",
  error: "#A63535",
  onError: "#FFFFFF",
  info: "#425C54",
  onInfo: "#FFFFFF",
  border: "#E3E8E5",
  borderStrong: "#C4CCC7",
  divider: "#EBF0EC",
  muted: "#7A857F",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fonts = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  mono: "SpaceMono-Regular",
  monoBold: "SpaceMono-Bold",
};

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
};

export const shadow = {
  card: {
    shadowColor: "#111412",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  soft: {
    shadowColor: "#111412",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
};
