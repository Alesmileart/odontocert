import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { AppText, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1590424693420-634a0b0b782c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxkZW50YWwlMjBsYWJvcmF0b3J5JTIwbWFjcm8lMjBwcm9zdGhldGljfGVufDB8fHx8MTc4NTkyMjE3NXww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      toast.show("Inserisci email e password", "error");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Accesso non riuscito", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(17,20,18,0.2)", "rgba(17,20,18,0.85)", colors.surface]}
          locations={[0, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroContent, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logoBadge}>
            <Ionicons name="shield-checkmark" size={22} color={colors.onBrandPrimary} />
          </View>
          <AppText variant="bold" size={fontSize["3xl"]} color={colors.onSurfaceInverse}>
            OdontoCert
          </AppText>
          <AppText variant="medium" size={fontSize.base} color="rgba(255,255,255,0.85)" style={styles.tagline}>
            Dichiarazioni di conformità MDR per odontotecnici
          </AppText>
        </View>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.form}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.title}>
          Bentornato
        </AppText>
        <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle}>
          Accedi al tuo laboratorio
        </AppText>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="nome@laboratorio.it"
          keyboardType="email-address"
          autoCapitalize="none"
          testID="login-email-input"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry={!showPw}
          autoCapitalize="none"
          testID="login-password-input"
          rightSlot={
            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} testID="toggle-password">
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          }
        />

        <Button title="Accedi" onPress={onSubmit} loading={loading} testID="login-submit-button" />

        <Pressable
          style={styles.switchRow}
          onPress={() => router.push("/(auth)/signup")}
          testID="go-to-signup"
        >
          <AppText size={fontSize.base} color={colors.muted}>
            Non hai un account?{" "}
          </AppText>
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Registrati
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 280 },
  heroContent: { flex: 1, justifyContent: "flex-end", paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  tagline: { marginTop: spacing.xs },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing["3xl"] },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
