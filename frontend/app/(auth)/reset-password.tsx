import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppText, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, fontSize, spacing } from "@/src/theme";

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const onSubmit = async () => {
    if (password.length < 6) {
      toast.show("La password deve avere almeno 6 caratteri", "error");
      return;
    }
    if (password !== confirm) {
      toast.show("Le password non coincidono", "error");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Aggiornamento non riuscito", "error");
    } finally {
      setLoading(false);
    }
  };

  const eye = (
    <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} testID="reset-toggle-password">
      <Ionicons name={showPw ? "eye-off" : "eye"} size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.form} bottomOffset={20} keyboardShouldPersistTaps="handled">
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.title}>
          {done ? "Password aggiornata" : "Scegli una nuova password"}
        </AppText>

        {!token ? (
          <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle} testID="reset-missing-token">
            Link non valido o scaduto. Richiedi un nuovo link dalla schermata di accesso.
          </AppText>
        ) : done ? (
          <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle} testID="reset-success-message">
            Ora puoi accedere con la nuova password.
          </AppText>
        ) : (
          <>
            <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle}>
              Il link è valido per un’ora e si può usare una sola volta.
            </AppText>
            <Field
              label="Nuova password"
              value={password}
              onChangeText={setPassword}
              placeholder="Almeno 6 caratteri"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              testID="reset-password-input"
              rightSlot={eye}
            />
            <Field
              label="Conferma password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Ripeti la password"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              testID="reset-confirm-input"
            />
            <Button title="Salva nuova password" onPress={onSubmit} loading={loading} testID="reset-submit-button" />
          </>
        )}

        <Pressable style={styles.switchRow} onPress={() => router.replace("/(auth)/login")} testID="reset-go-to-login">
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Vai all’accesso
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing["3xl"] },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  switchRow: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: spacing.xl },
});
