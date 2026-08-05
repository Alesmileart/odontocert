import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Badge, Button, Divider } from "@/src/components/ui";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { exportDeclarationPdf, DeclarationData, LabProfile } from "@/src/utils/pdf";
import { colors, fontSize, spacing, radius } from "@/src/theme";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  if (iso.includes("/")) return iso;
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function DeclarationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [decl, setDecl] = useState<(DeclarationData & { id: string; status: string }) | null>(null);
  const [lab, setLab] = useState<LabProfile>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api.get<DeclarationData & { id: string; status: string }>(`/declarations/${id}`),
        api.get<LabProfile>("/profile"),
      ]);
      setDecl(d);
      setLab(p);
    } catch {
      toast.show("Dichiarazione non trovata", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onExport = async () => {
    if (!decl) return;
    setExporting(true);
    try {
      await exportDeclarationPdf(decl, lab);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore esportazione PDF", "error");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    try {
      await api.del(`/declarations/${id}`);
      setConfirmDelete(false);
      toast.show("Dichiarazione eliminata", "success");
      router.back();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (!decl) {
    return (
      <View style={styles.center}>
        <AppText color={colors.muted}>Dichiarazione non disponibile</AppText>
      </View>
    );
  }

  const deviceLine = [decl.device_type, decl.device_description].filter(Boolean).join(" >> ");
  const teeth = [...(decl.teeth || [])].sort((a, b) => a - b);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="detail-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" size={fontSize.base}>
          Dichiarazione CE
        </AppText>
        <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} testID="detail-delete">
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <AppText variant="monoBold" size={fontSize.lg} color={colors.brandPrimary}>
            Cod. {decl.codice_lavoro || decl.number}
          </AppText>
          <Badge status={decl.status} />
        </View>
        <AppText size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.lg }}>
          Emessa il {fmtDate(decl.issue_date)}
        </AppText>

        <Card style={styles.section}>
          <SectionTitle icon="medkit-outline" title="Dispositivo" />
          <Row k="Identificato come" v={deviceLine} />
          <Row k="Paziente" v={decl.patient_name || decl.patient_ref} />
          {teeth.length > 0 ? <Row k="Elementi" v={teeth.join(", ")} mono /> : null}
        </Card>

        <Card style={styles.section}>
          <SectionTitle icon="document-text-outline" title="Prescrizione" />
          <Row k="Codice" v={decl.prescription_code} mono />
          <Row k="Data" v={fmtDate(decl.prescription_date)} />
          <Row k="Prescrivente" v={decl.prescriber} />
        </Card>

        <Card style={styles.section}>
          <SectionTitle icon="cube-outline" title="Materiali" />
          {(decl.materials || []).length === 0 ? (
            <AppText size={fontSize.base} color={colors.muted}>
              Nessun materiale indicato
            </AppText>
          ) : (
            (decl.materials || []).map((m, i) => (
              <View key={i} style={styles.matItem}>
                <AppText variant="semibold" size={fontSize.base}>
                  {m.name}
                </AppText>
                <AppText variant="mono" size={fontSize.sm} color={colors.muted}>
                  {m.manufacturer || "—"}{m.ce_number ? ` · CE ${m.ce_number}` : ""}{m.lot ? ` · Lotto ${m.lot}` : ""}
                </AppText>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.section}>
          <SectionTitle icon="pricetag-outline" title="Etichetta" />
          <Row k="Consegna" v={fmtDate(decl.delivery_date) !== "—" ? fmtDate(decl.delivery_date) : fmtDate(decl.issue_date)} />
          <Row k="Utilizzo" v={decl.usage_days ? `${decl.usage_days} giorni` : "—"} />
          <Divider style={{ marginVertical: spacing.sm }} />
          {decl.storage_no_flip ? <ConfLine label="Non capovolgere la confezione" /> : null}
          {decl.storage_no_shake ? <ConfLine label="Non sbattere l'involucro" /> : null}
          {decl.storage_proper_place ? <ConfLine label="Conservare in luogo adeguato" /> : null}
          {decl.non_sterile ? <ConfLine label="NON STERILE (non sterilizzare a caldo)" /> : null}
          {decl.annotations ? (
            <>
              <Divider style={{ marginVertical: spacing.sm }} />
              <AppText size={fontSize.sm} color={colors.muted}>
                Annotazioni: {decl.annotations}
              </AppText>
            </>
          ) : null}
        </Card>

        {decl.signature_base64 && decl.signature_base64.startsWith("data:") ? (
          <Card style={styles.section}>
            <SectionTitle icon="create-outline" title="Firma" />
            <View style={styles.sigBox}>
              <SignatureImage uri={decl.signature_base64} />
            </View>
            <AppText size={fontSize.sm} color={colors.muted} style={{ textAlign: "center" }}>
              Il legale rappresentante · {decl.technician_name || lab.responsible_person || ""}
            </AppText>
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Esporta / Condividi PDF"
          onPress={onExport}
          loading={exporting}
          icon={<Ionicons name="share-outline" size={20} color={colors.onBrandPrimary} />}
          testID="export-pdf-button"
        />
      </View>

      <FormSheet
        visible={confirmDelete}
        title="Elimina dichiarazione"
        onClose={() => setConfirmDelete(false)}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button title="Elimina definitivamente" kind="danger" onPress={onDelete} testID="confirm-delete-button" />
            <Button title="Annulla" kind="secondary" onPress={() => setConfirmDelete(false)} testID="cancel-delete-button" />
          </View>
        }
      >
        <AppText size={fontSize.base} color={colors.onSurfaceSecondary}>
          Sei sicuro di voler eliminare questa dichiarazione? L'operazione non è reversibile.
        </AppText>
      </FormSheet>
    </View>
  );
}

function SignatureImage({ uri }: { uri: string }) {
  const { Image } = require("expo-image");
  return <Image source={{ uri }} style={{ width: "100%", height: 90 }} contentFit="contain" />;
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <AppText variant="bold" size={fontSize.base} color={colors.brandPrimary}>
        {title}
      </AppText>
    </View>
  );
}

function ConfLine({ label }: { label: string }) {
  return (
    <View style={styles.confRow}>
      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
      <AppText size={fontSize.base} style={{ flex: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

function Row({ k, v, mono }: { k: string; v?: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText size={fontSize.sm} color={colors.muted} style={{ width: 120 }}>
        {k}
      </AppText>
      <AppText variant={mono ? "mono" : "regular"} size={fontSize.base} style={{ flex: 1 }}>
        {v || "—"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { marginBottom: spacing.lg, padding: spacing.lg },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  matItem: { marginBottom: spacing.md },
  confRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  sigBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: "#FFFFFF",
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
});
