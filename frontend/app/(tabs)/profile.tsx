import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card, Divider } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Profile = {
  lab_name: string;
  responsible_person: string;
  address: string;
  city: string;
  vat: string;
  registration_number: string;
  phone: string;
  email: string;
  logo_base64: string;
};

const empty: Profile = {
  lab_name: "",
  responsible_person: "",
  address: "",
  city: "",
  vat: "",
  registration_number: "",
  phone: "",
  email: "",
  logo_base64: "",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await api.get<Profile>("/profile");
      setProfile({ ...empty, ...p });
    } catch {
      /* empty */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/profile", profile);
      toast.show("Profilo laboratorio salvato", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  const up = (k: keyof Profile) => (t: string) => setProfile((p) => ({ ...p, [k]: t }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="bold" size={fontSize["2xl"]}>
          Profilo
        </AppText>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <AppText variant="bold" size={fontSize["2xl"]} color={colors.onBrandPrimary}>
              {(user?.name || "?").charAt(0).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" size={fontSize.lg}>
              {user?.name}
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              {user?.email}
            </AppText>
          </View>
        </Card>

        <AppText variant="bold" size={fontSize.lg} style={styles.sectionTitle}>
          Dati del laboratorio
        </AppText>
        <AppText size={fontSize.sm} color={colors.muted} style={styles.sectionHint}>
          Questi dati vengono inseriti automaticamente in ogni dichiarazione.
        </AppText>

        <Field label="Nome laboratorio" value={profile.lab_name} onChangeText={up("lab_name")} placeholder="Laboratorio Odontotecnico Rossi" testID="lab-name-input" />
        <Field label="Responsabile" value={profile.responsible_person} onChangeText={up("responsible_person")} placeholder="Mario Rossi" testID="lab-responsible-input" />
        <Field label="Indirizzo" value={profile.address} onChangeText={up("address")} placeholder="Via Roma 1" testID="lab-address-input" />
        <Field label="Città" value={profile.city} onChangeText={up("city")} placeholder="Milano" testID="lab-city-input" />
        <Field label="Partita IVA" value={profile.vat} onChangeText={up("vat")} placeholder="IT01234567890" mono autoCapitalize="characters" testID="lab-vat-input" />
        <Field label="N. iscrizione / registrazione" value={profile.registration_number} onChangeText={up("registration_number")} placeholder="Es. registrazione dispositivi" mono autoCapitalize="characters" testID="lab-registration-input" />
        <Field label="Telefono" value={profile.phone} onChangeText={up("phone")} placeholder="+39 02 1234567" keyboardType="phone-pad" testID="lab-phone-input" />
        <Field label="Email" value={profile.email} onChangeText={up("email")} placeholder="info@laboratorio.it" keyboardType="email-address" autoCapitalize="none" testID="lab-email-input" />

        <Button title="Salva dati laboratorio" onPress={save} loading={saving} testID="save-profile-button" />

        <Divider style={{ marginVertical: spacing.xl }} />

        <Pressable style={styles.logout} onPress={logout} testID="logout-button">
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <AppText variant="semibold" size={fontSize.base} color={colors.error}>
            Esci
          </AppText>
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  body: { padding: spacing.xl, paddingBottom: 120 },
  userCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { marginBottom: spacing.xs },
  sectionHint: { marginBottom: spacing.lg },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
});
