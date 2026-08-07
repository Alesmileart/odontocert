import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, Linking } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
  reg_imprese: string;
  authorized_label: string;
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
  reg_imprese: "",
  authorized_label: "Laboratorio Odontotecnico Autorizzato",
  phone: "",
  email: "",
  logo_base64: "",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const toast = useToast();
  const router = useRouter();
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

  const [permBlocked, setPermBlocked] = useState(false);

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPermBlocked(!perm.canAskAgain);
      toast.show("Permesso galleria negato", "error");
      return;
    }
    setPermBlocked(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      base64: true,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || "image/jpeg";
    setProfile((p) => ({ ...p, logo_base64: `data:${mime};base64,${asset.base64}` }));
    toast.show("Logo aggiornato — ricorda di salvare", "info");
  };

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

        <Pressable style={styles.navRow} onPress={() => router.push("/fascicolo")} testID="open-fascicolo">
          <View style={styles.navIcon}>
            <Ionicons name="folder-open-outline" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" size={fontSize.base}>
              Fascicolo protocolli di fabbricazione
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              Protocolli per tipologia · archivio e stampa
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.navRow} onPress={() => router.push("/work-types")} testID="open-work-types">
          <View style={styles.navIcon}>
            <Ionicons name="construct-outline" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" size={fontSize.base}>
              Tipi di lavorazione
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              Categorie e sottotipi per le dichiarazioni
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.navRow} onPress={() => router.push("/billing")} testID="open-billing">
          <View style={styles.navIcon}>
            <Ionicons name="receipt-outline" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" size={fontSize.base}>
              Fatturazione
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              Fatture ai clienti · listino · cedolino pre-fattura
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.navRow} onPress={() => router.push("/provider-settings")} testID="open-provider-settings">
          <View style={styles.navIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.brandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" size={fontSize.base}>
              Impostazioni provider
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              Firma digitale · PEC · conservazione (predisposizione)
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <AppText size={fontSize.sm} color={colors.muted} style={styles.sectionHint}>
          Questi dati vengono inseriti automaticamente in ogni dichiarazione.
        </AppText>

        <AppText variant="medium" size={fontSize.sm} color={colors.onSurfaceSecondary} style={styles.logoLabel}>
          Logo del laboratorio
        </AppText>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            {profile.logo_base64 ? (
              <Image source={{ uri: profile.logo_base64 }} style={styles.logoImg} contentFit="contain" />
            ) : (
              <Ionicons name="image-outline" size={28} color={colors.muted} />
            )}
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Button
              title={profile.logo_base64 ? "Cambia logo" : "Carica logo"}
              kind="secondary"
              onPress={pickLogo}
              icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.brandPrimary} />}
              testID="pick-logo-button"
            />
            {profile.logo_base64 ? (
              <Pressable onPress={() => setProfile((p) => ({ ...p, logo_base64: "" }))} testID="remove-logo-button">
                <AppText variant="semibold" size={fontSize.base} color={colors.error} style={{ textAlign: "center" }}>
                  Rimuovi logo
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
        {permBlocked ? (
          <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()} testID="open-settings-button">
            <Ionicons name="settings-outline" size={16} color={colors.brandPrimary} />
            <AppText variant="semibold" size={fontSize.sm} color={colors.brandPrimary}>
              Apri impostazioni per abilitare la galleria
            </AppText>
          </Pressable>
        ) : null}

        <Field label="Nome laboratorio" value={profile.lab_name} onChangeText={up("lab_name")} placeholder="Laboratorio Odontotecnico Rossi" testID="lab-name-input" />
        <Field label="Dicitura autorizzazione" value={profile.authorized_label} onChangeText={up("authorized_label")} placeholder="Laboratorio Odontotecnico Autorizzato" testID="lab-authorized-input" />
        <Field label="Responsabile / Legale rappr." value={profile.responsible_person} onChangeText={up("responsible_person")} placeholder="Mario Rossi" testID="lab-responsible-input" />
        <Field label="Indirizzo" value={profile.address} onChangeText={up("address")} placeholder="Via Roma 1" testID="lab-address-input" />
        <Field label="Città" value={profile.city} onChangeText={up("city")} placeholder="Milano" testID="lab-city-input" />
        <Field label="Partita IVA" value={profile.vat} onChangeText={up("vat")} placeholder="IT01234567890" mono autoCapitalize="characters" testID="lab-vat-input" />
        <Field label="Reg. Min. Salute" value={profile.registration_number} onChangeText={up("registration_number")} placeholder="Es. ITCA01036549" mono autoCapitalize="characters" testID="lab-registration-input" />
        <Field label="Reg. Imprese" value={profile.reg_imprese} onChangeText={up("reg_imprese")} placeholder="Es. SS-195555" mono autoCapitalize="characters" testID="lab-regimprese-input" />
        <Field label="Telefono / Cellulare" value={profile.phone} onChangeText={up("phone")} placeholder="+39 348 4039419" keyboardType="phone-pad" testID="lab-phone-input" />
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
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHint: { marginBottom: spacing.lg },
  logoLabel: { marginBottom: spacing.sm },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.md },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImg: { width: "100%", height: "100%" },
  settingsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginBottom: spacing.lg },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.md },
});
