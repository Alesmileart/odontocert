import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppText, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing } from "@/src/theme";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.show("Compila tutti i campi (password min. 6 caratteri)", "error");
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Registrazione non riuscita", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="signup-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.form}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.title}>
          Crea il tuo account
        </AppText>
        <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle}>
          Inizia a emettere dichiarazioni di conformità
        </AppText>

        <Field
          label="Nome e cognome"
          value={name}
          onChangeText={setName}
          placeholder="Mario Rossi"
          autoCapitalize="words"
          testID="signup-name-input"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="nome@laboratorio.it"
          keyboardType="email-address"
          autoCapitalize="none"
          testID="signup-email-input"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Almeno 6 caratteri"
          secureTextEntry={!showPw}
          autoCapitalize="none"
          testID="signup-password-input"
          rightSlot={
            <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} testID="toggle-password">
              <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.muted} />
            </Pressable>
          }
        />

        <Button title="Registrati" onPress={onSubmit} loading={loading} testID="signup-submit-button" />

        <Pressable style={styles.switchRow} onPress={() => router.back()} testID="go-to-login">
          <AppText size={fontSize.base} color={colors.muted}>
            Hai già un account?{" "}
          </AppText>
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Accedi
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing["3xl"] },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  switchRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.xl },
});
