import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { AppText, Button } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, fontSize, spacing, radius } from "@/src/theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goLogin = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

  const onSubmit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.show("Inserisci un indirizzo email valido", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ message: string }>("/auth/forgot-password", { email: email.trim() });
      setMessage(res.message);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Richiesta non riuscita", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={goLogin} hitSlop={10} testID="forgot-back" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.form} bottomOffset={20} keyboardShouldPersistTaps="handled">
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.title}>
          Password dimenticata?
        </AppText>
        <AppText size={fontSize.base} color={colors.muted} style={styles.subtitle}>
          Inserisci l’email del tuo account: ti invieremo un link per scegliere una nuova password.
        </AppText>

        {message ? (
          <View style={styles.notice} testID="forgot-success-message">
            <Ionicons name="mail-outline" size={22} color={colors.brandPrimary} />
            <AppText size={fontSize.base} style={styles.noticeText}>
              {message} Il link scade dopo un’ora.
            </AppText>
          </View>
        ) : (
          <>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nome@laboratorio.it"
              keyboardType="email-address"
              autoCapitalize="none"
              testID="forgot-email-input"
            />
            <Button title="Invia link" onPress={onSubmit} loading={loading} testID="forgot-submit-button" />
          </>
        )}

        <Pressable style={styles.switchRow} onPress={goLogin} testID="forgot-go-to-login">
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Torna all’accesso
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 44, height: 44, justifyContent: "center" },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing["3xl"] },
  title: { marginBottom: spacing.xs },
  subtitle: { marginBottom: spacing.xl },
  notice: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1 },
  switchRow: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: spacing.xl },
});
