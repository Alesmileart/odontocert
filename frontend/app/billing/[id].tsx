import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { AppText, Button, Card } from "@/src/components/ui";
import { FormSheet } from "@/src/components/FormSheet";
import { PdfPreview } from "@/src/components/PdfPreview";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { buildInvoiceHtml, buildCedolinoHtml, exportInvoicePdf, InvoiceData, LabProfile } from "@/src/utils/pdf";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Line = { description: string; qty: number; unit_price: number; mode: string; declaration_id?: string; teeth?: number[]; patient_name?: string; codice_lavoro?: string };
type Invoice = InvoiceData & { id: string; number: string; date: string; total: number; lines: Line[]; bollo?: boolean; notes?: string };

function fmtEur(n?: number) {
  return "€ " + Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso?: string) {
  if (!iso) return "";
  if (iso.includes("/")) return iso;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function InvoiceDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lab, setLab] = useState<LabProfile>({});
  const [loading, setLoading] = useState(true);
  const [previewKind, setPreviewKind] = useState<"invoice" | "cedolino" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, prof] = await Promise.all([api.get<Invoice>(`/invoices/${id}`), api.get<LabProfile>("/profile")]);
      // Backfill per fatture create prima del campo denti: recupera elementi/paziente/codice
      // dalle dichiarazioni collegate.
      const missingIds = Array.from(
        new Set(
          (inv.lines || [])
            .filter((l) => l.declaration_id && (!l.teeth || l.teeth.length === 0))
            .map((l) => l.declaration_id as string)
        )
      );
      if (missingIds.length > 0) {
        const decls = await Promise.all(
          missingIds.map((did) => api.get<any>(`/declarations/${did}`).catch(() => null))
        );
        const map: Record<string, any> = {};
        missingIds.forEach((did, i) => {
          if (decls[i]) map[did] = decls[i];
        });
        inv.lines = (inv.lines || []).map((l) => {
          if (!l.declaration_id || (l.teeth && l.teeth.length > 0)) return l;
          const d = map[l.declaration_id];
          if (!d) return l;
          const works: any[] = Array.isArray(d.works) ? d.works : [];
          const work =
            works.find((w) => `${w.category || ""}${w.subtype ? " — " + w.subtype : ""}` === l.description) ||
            works.find((w) => l.description && w.subtype && l.description.includes(w.subtype));
          const teeth = work ? work.teeth || [] : d.teeth || [];
          return {
            ...l,
            teeth: [...teeth].sort((a: number, b: number) => a - b),
            patient_name: l.patient_name || d.patient_name || d.patient_ref || "",
            codice_lavoro: l.codice_lavoro || d.codice_lavoro || d.number || "",
          };
        });
      }
      setInvoice(inv);
      setLab(prof);
    } catch {
      toast.show("Fattura non trovata", "error");
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const share = async () => {
    if (!invoice || !previewKind) return;
    setSharing(true);
    try {
      await exportInvoicePdf(invoice, lab, previewKind);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore esportazione", "error");
    } finally {
      setSharing(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/invoices/${id}`);
      toast.show("Fattura eliminata", "success");
      router.back();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!invoice) return <View style={styles.container} />;

  const previewHtml = invoice
    ? previewKind === "cedolino"
      ? buildCedolinoHtml(invoice, lab)
      : buildInvoiceHtml(invoice, lab)
    : "";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="invoice-detail-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" size={fontSize.base}>
          {invoice.number}
        </AppText>
        <Pressable onPress={() => setConfirmDelete(true)} hitSlop={10} testID="invoice-delete-header">
          <Ionicons name="trash-outline" size={22} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card style={styles.summary}>
          <View style={styles.summaryTop}>
            <View>
              <AppText size={fontSize.sm} color={colors.muted}>
                Cliente
              </AppText>
              <AppText variant="semibold" size={fontSize.lg}>
                {invoice.client_snapshot?.name || "—"}
              </AppText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <AppText size={fontSize.sm} color={colors.muted}>
                {fmtDate(invoice.date)}
              </AppText>
              <AppText variant="bold" size={fontSize["2xl"]} style={{ marginTop: 2 }}>
                {fmtEur(invoice.total)}
              </AppText>
            </View>
          </View>
        </Card>

        <AppText variant="bold" size={fontSize.lg} style={styles.sectionTitle}>
          Righe
        </AppText>
        {(invoice.lines || []).map((l, i) => (
          <Card key={i} style={styles.lineCard}>
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" size={fontSize.base}>
                {l.description || "—"}
              </AppText>
              <AppText size={fontSize.sm} color={colors.muted}>
                {Number(l.qty || 0)} × {fmtEur(l.unit_price)} · {l.mode === "per_element" ? "per elemento" : "forfait"}
              </AppText>
            </View>
            <AppText variant="semibold" size={fontSize.base}>
              {fmtEur(Number(l.qty || 0) * Number(l.unit_price || 0))}
            </AppText>
          </Card>
        ))}

        {invoice.bollo ? (
          <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: spacing.sm }}>
            Include marca da bollo € 2,00
          </AppText>
        ) : null}
        <AppText size={fontSize.sm} color={colors.muted} style={{ marginTop: spacing.sm }}>
          Operazione esente IVA ai sensi dell'art. 10, n. 18, D.P.R. 633/1972.
        </AppText>

        <View style={styles.actions}>
          <Button
            title="Anteprima Fattura"
            onPress={() => setPreviewKind("invoice")}
            icon={<Ionicons name="document-text-outline" size={20} color={colors.onBrandPrimary} />}
            testID="preview-invoice-button"
          />
          <Button
            title="Anteprima Cedolino pre-fattura"
            kind="secondary"
            onPress={() => setPreviewKind("cedolino")}
            icon={<Ionicons name="receipt-outline" size={20} color={colors.brandPrimary} />}
            testID="preview-cedolino-button"
          />
        </View>
      </ScrollView>

      <PdfPreview
        visible={!!previewKind}
        title={previewKind === "cedolino" ? "Cedolino pre-fattura" : "Fattura"}
        html={previewHtml}
        onClose={() => setPreviewKind(null)}
        onShare={share}
        sharing={sharing}
      />

      <FormSheet
        visible={confirmDelete}
        title="Eliminare la fattura?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button title="Elimina" kind="danger" onPress={remove} testID="confirm-delete-invoice" />
            <Button title="Annulla" kind="secondary" onPress={() => setConfirmDelete(false)} testID="cancel-delete-invoice" />
          </View>
        }
      >
        <AppText size={fontSize.base} color={colors.onSurfaceSecondary}>
          La fattura {invoice.number} verrà eliminata definitivamente.
        </AppText>
      </FormSheet>
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
  body: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  summary: { padding: spacing.lg },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  lineCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
