import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Settings = {
  signature_provider: string;
  signature_reference: string;
  signature_enabled: boolean;
  pec_provider: string;
  pec_address: string;
  pec_enabled: boolean;
  conservation_provider: string;
  conservation_reference: string;
  conservation_enabled: boolean;
  notes: string;
};

const empty: Settings = {
  signature_provider: "",
  signature_reference: "",
  signature_enabled: false,
  pec_provider: "",
  pec_address: "",
  pec_enabled: false,
  conservation_provider: "",
  conservation_reference: "",
  conservation_enabled: false,
  notes: "",
};

export default function ProviderSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState<Settings>(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Settings>("/provider-settings");
      setS({ ...empty, ...data });
    } catch {
      /* empty */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const up = (k: keyof Settings) => (t: string) => setS((p) => ({ ...p, [k]: t }));
  const toggle = (k: keyof Settings) => setS((p) => ({ ...p, [k]: !p[k] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/provider-settings", s);
      toast.show("Impostazioni provider salvate", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="provider-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" size={fontSize.lg}>
          Impostazioni provider
        </AppText>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.body}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.brandPrimary} />
          <AppText size={fontSize.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
            Sezione di predisposizione. Firma digitale, PEC e conservazione a norma non sono ancora
            operative: qui puoi solo salvare i riferimenti dei provider per l'attivazione futura.
          </AppText>
        </Card>

        <Section
          icon="create-outline"
          title="Firma digitale"
          enabled={s.signature_enabled}
          onToggle={() => toggle("signature_enabled")}
          testID="section-signature"
        >
          <Field label="Provider" value={s.signature_provider} onChangeText={up("signature_provider")} placeholder="Es. Aruba, InfoCert, Namirial" testID="signature-provider-input" />
          <Field label="Riferimento account" value={s.signature_reference} onChangeText={up("signature_reference")} placeholder="Es. ID contratto (no credenziali)" testID="signature-reference-input" />
        </Section>

        <Section
          icon="mail-outline"
          title="PEC"
          enabled={s.pec_enabled}
          onToggle={() => toggle("pec_enabled")}
          testID="section-pec"
        >
          <Field label="Provider" value={s.pec_provider} onChangeText={up("pec_provider")} placeholder="Es. Aruba PEC, Legalmail" testID="pec-provider-input" />
          <Field label="Indirizzo PEC" value={s.pec_address} onChangeText={up("pec_address")} placeholder="laboratorio@pec.it" keyboardType="email-address" autoCapitalize="none" testID="pec-address-input" />
        </Section>

        <Section
          icon="archive-outline"
          title="Conservazione a norma"
          enabled={s.conservation_enabled}
          onToggle={() => toggle("conservation_enabled")}
          testID="section-conservation"
        >
          <Field label="Conservatore accreditato" value={s.conservation_provider} onChangeText={up("conservation_provider")} placeholder="Es. Namirial, Aruba" testID="conservation-provider-input" />
          <Field label="Riferimento servizio" value={s.conservation_reference} onChangeText={up("conservation_reference")} placeholder="Es. codice servizio (no credenziali)" testID="conservation-reference-input" />
        </Section>

        <Field label="Note" value={s.notes} onChangeText={up("notes")} placeholder="Annotazioni sui provider" multiline testID="provider-notes-input" />

        <Button title="Salva impostazioni" onPress={save} loading={saving} testID="save-provider-button" />
      </KeyboardAwareScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  enabled,
  onToggle,
  children,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={18} color={colors.brandPrimary} />
        </View>
        <AppText variant="bold" size={fontSize.lg} style={{ flex: 1 }}>
          {title}
        </AppText>
        <Pressable
          style={[styles.pill, enabled && styles.pillOn]}
          onPress={onToggle}
          testID={`${testID}-toggle`}
        >
          <AppText variant="semibold" size={fontSize.sm} color={enabled ? colors.onBrandPrimary : colors.muted}>
            {enabled ? "Predisposto" : "Non attivo"}
          </AppText>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  body: { padding: spacing.xl, paddingBottom: 60, gap: spacing.lg },
  notice: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: colors.brandSecondary, borderColor: colors.brandSecondary },
  section: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  pillOn: { backgroundColor: colors.brandPrimary },
});
