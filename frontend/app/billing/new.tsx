import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { DateField } from "@/src/components/DateField";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Client = { id: string; name: string; clinic: string; address: string; vat: string; email: string; phone: string };
type PriceItem = { id: string; name: string; price: number; mode: "flat" | "per_element"; category?: string; subtype?: string };
type Work = { category?: string; subtype?: string; teeth?: number[] };
type Declaration = { id: string; number?: string; codice_lavoro?: string; patient_name?: string; device_type?: string; teeth?: number[]; works?: Work[]; status?: string; client_id?: string; client_snapshot?: { name?: string } };
type Line = { description: string; qty: number; unit_price: number; mode: string; declaration_id: string; patient_name?: string; codice_lavoro?: string };

function fmtEur(n: number) {
  return "€ " + Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewInvoice() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [manualName, setManualName] = useState("");
  const [date, setDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [bollo, setBollo] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p, d] = await Promise.all([
        api.get<Client[]>("/clients"),
        api.get<PriceItem[]>("/price-items"),
        api.get<Declaration[]>("/declarations"),
      ]);
      setClients(c);
      setPrices(p);
      setDeclarations(d);
    } catch {
      /* empty */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const clientDeclarations = useMemo(() => {
    if (!selectedClient) return [];
    return declarations.filter(
      (d) =>
        d.status === "issued" &&
        (d.client_id === selectedClient.id || d.client_snapshot?.name === selectedClient.name)
    );
  }, [declarations, selectedClient]);

  const subtotal = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);
  const total = subtotal + (bollo ? 2 : 0);

  const addPriceLine = (p: PriceItem) =>
    setLines((prev) => [...prev, { description: p.name, qty: 1, unit_price: p.price, mode: p.mode, declaration_id: "" }]);

  const addEmptyLine = () =>
    setLines((prev) => [...prev, { description: "", qty: 1, unit_price: 0, mode: "flat", declaration_id: "" }]);

  const toggleDeclarationLine = (d: Declaration) => {
    setLines((prev) => {
      const linked = prev.some((l) => l.declaration_id === d.id);
      if (linked) return prev.filter((l) => l.declaration_id !== d.id);
      const works: Work[] =
        d.works && d.works.length ? d.works : [{ category: d.device_type || "", subtype: "", teeth: d.teeth || [] }];
      const newLines: Line[] = works.map((w) => {
        const match =
          prices.find((p) => p.subtype && p.subtype.toLowerCase() === (w.subtype || "").toLowerCase()) ||
          prices.find((p) => p.category && p.category.toLowerCase() === (w.category || "").toLowerCase() && !p.subtype);
        const count = (w.teeth || []).length;
        const mode = match?.mode || "per_element";
        const qty = mode === "per_element" ? (count > 0 ? count : 1) : 1;
        const desc =
          `${w.category || ""}${w.subtype ? " — " + w.subtype : ""}`.trim() || d.device_type || "Dispositivo";
        return {
          description: desc,
          qty,
          unit_price: match?.price || 0,
          mode,
          declaration_id: d.id,
          patient_name: d.patient_name || "",
          codice_lavoro: d.codice_lavoro || d.number || "",
        };
      });
      return [...prev, ...newLines];
    });
  };

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    const clientName = selectedClient?.name || manualName.trim();
    if (!clientName) {
      toast.show("Seleziona o inserisci il cliente", "error");
      return;
    }
    if (lines.length === 0) {
      toast.show("Aggiungi almeno una riga", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: selectedClient?.id ?? null,
        client_snapshot: selectedClient
          ? {
              name: selectedClient.name,
              clinic: selectedClient.clinic,
              address: selectedClient.address,
              vat: selectedClient.vat,
              email: selectedClient.email,
              phone: selectedClient.phone,
            }
          : { name: manualName },
        date,
        lines,
        declaration_ids: lines.filter((l) => l.declaration_id).map((l) => l.declaration_id),
        bollo,
        notes,
      };
      const created = await api.post<{ id: string }>("/invoices", payload);
      toast.show("Fattura creata", "success");
      router.replace(`/billing/${created.id}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore nel salvataggio", "error");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} testID="new-invoice-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" size={fontSize.base}>
          Nuova fattura
        </AppText>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAwareScrollView contentContainerStyle={styles.body} bottomOffset={90} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <AppText variant="bold" size={fontSize.lg} style={styles.sectionTitle}>
          Cliente
        </AppText>
        {clients.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {clients.map((c) => {
              const active = selectedClient?.id === c.id;
              return (
                <Pressable key={c.id} style={[styles.pill, active && styles.pillActive]} onPress={() => setSelectedClient(active ? null : c)} testID={`pick-client-${c.id}`}>
                  <Ionicons name="person" size={14} color={active ? colors.onBrandPrimary : colors.brandPrimary} />
                  <AppText variant="medium" size={fontSize.base} color={active ? colors.onBrandPrimary : colors.brandPrimary}>
                    {c.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {!selectedClient && (
          <Field label="Oppure nome cliente" value={manualName} onChangeText={setManualName} placeholder="Es. Studio Dentistico Bianchi" testID="invoice-manual-client" />
        )}
        <DateField label="Data fattura" value={date} onChange={setDate} placeholder="GG/MM/AAAA (default: oggi)" testID="invoice-date" />

        {selectedClient && clientDeclarations.length > 0 && (
          <>
            <AppText variant="bold" size={fontSize.lg} style={styles.sectionTitle}>
              Collega dichiarazioni
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted} style={{ marginBottom: spacing.sm }}>
              Tocca per aggiungere una riga collegata alla dichiarazione (imposta poi il prezzo).
            </AppText>
            {clientDeclarations.map((d) => {
              const linked = lines.some((l) => l.declaration_id === d.id);
              return (
                <Pressable key={d.id} style={styles.declRow} onPress={() => toggleDeclarationLine(d)} testID={`link-decl-${d.id}`}>
                  <View style={[styles.checkbox, linked && styles.checkboxOn]}>{linked ? <Ionicons name="checkmark" size={15} color={colors.onBrandPrimary} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="semibold" size={fontSize.base}>
                      {d.device_type || "Dispositivo"}
                    </AppText>
                    <AppText size={fontSize.sm} color={colors.muted}>
                      {d.patient_name || "—"} · {(d.teeth || []).length} elementi
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}

        <AppText variant="bold" size={fontSize.lg} style={styles.sectionTitle}>
          Righe fattura
        </AppText>
        {prices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {prices.map((p) => (
              <Pressable key={p.id} style={styles.pill} onPress={() => addPriceLine(p)} testID={`add-price-${p.id}`}>
                <Ionicons name="add" size={16} color={colors.brandPrimary} />
                <AppText variant="medium" size={fontSize.base} color={colors.brandPrimary}>
                  {p.name} · {fmtEur(p.price)}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {lines.length === 0 ? (
          <Card style={styles.emptyLines}>
            <Ionicons name="list-outline" size={24} color={colors.muted} />
            <AppText size={fontSize.base} color={colors.muted} style={{ marginTop: spacing.sm, textAlign: "center" }}>
              Nessuna riga. Aggiungi dal listino o manualmente.
            </AppText>
          </Card>
        ) : (
          lines.map((l, idx) => (
            <Card key={idx} style={styles.lineCard}>
              <View style={styles.lineTop}>
                <AppText variant="semibold" size={fontSize.base} style={{ flex: 1 }}>
                  Riga {idx + 1}
                  {l.declaration_id ? "  · collegata" : ""}
                </AppText>
                <Pressable onPress={() => removeLine(idx)} hitSlop={10} testID={`remove-line-${idx}`}>
                  <Ionicons name="close-circle" size={22} color={colors.error} />
                </Pressable>
              </View>
              <Field label="Descrizione" value={l.description} onChangeText={(t) => updateLine(idx, { description: t })} placeholder="Es. Corona in zirconia" testID={`line-desc-${idx}`} />
              <View style={styles.lineRow}>
                <View style={{ flex: 1 }}>
                  <Field label={l.mode === "per_element" ? "Q.tà (elementi)" : "Q.tà"} value={l.qty ? String(l.qty) : ""} onChangeText={(t) => updateLine(idx, { qty: parseFloat(t.replace(",", ".")) || 0 })} placeholder="1" keyboardType="decimal-pad" testID={`line-qty-${idx}`} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Prezzo unit. (€)" value={l.unit_price ? String(l.unit_price) : ""} onChangeText={(t) => updateLine(idx, { unit_price: parseFloat(t.replace(",", ".")) || 0 })} placeholder="0,00" keyboardType="decimal-pad" testID={`line-price-${idx}`} />
                </View>
              </View>
              <AppText size={fontSize.sm} color={colors.muted} style={{ textAlign: "right" }}>
                Importo: {fmtEur(Number(l.qty || 0) * Number(l.unit_price || 0))}
              </AppText>
            </Card>
          ))
        )}

        <Pressable style={styles.addLine} onPress={addEmptyLine} testID="add-empty-line">
          <Ionicons name="add-circle-outline" size={20} color={colors.brandPrimary} />
          <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
            Aggiungi riga manuale
          </AppText>
        </Pressable>

        <Pressable style={styles.bolloRow} onPress={() => setBollo(!bollo)} testID="invoice-bollo-toggle">
          <View style={[styles.checkbox, bollo && styles.checkboxOn]}>{bollo ? <Ionicons name="checkmark" size={15} color={colors.onBrandPrimary} /> : null}</View>
          <AppText size={fontSize.base} style={{ flex: 1 }}>
            Applica marca da bollo € 2,00 (fatture esenti &gt; € 77,47)
          </AppText>
        </Pressable>

        <Field label="Note" value={notes} onChangeText={setNotes} placeholder="Note opzionali in fattura" multiline testID="invoice-notes" />

        <View style={styles.exemptBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.brandPrimary} />
          <AppText size={fontSize.sm} color={colors.onSurfaceSecondary} style={{ flex: 1 }}>
            Operazione esente IVA ai sensi dell'art. 10, n. 18, D.P.R. 633/1972 (dicitura inclusa in fattura).
          </AppText>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <AppText size={fontSize.base} color={colors.muted}>
            Totale
          </AppText>
          <AppText variant="bold" size={fontSize.xl}>
            {fmtEur(total)}
          </AppText>
        </View>
        <Button title="Crea fattura" onPress={submit} loading={saving} testID="create-invoice-button" />
      </View>
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
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm },
  pillRow: { gap: spacing.sm, paddingBottom: spacing.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexShrink: 0,
  },
  pillActive: { backgroundColor: colors.brandPrimary },
  declRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  emptyLines: { alignItems: "center", paddingVertical: spacing.xl },
  lineCard: { padding: spacing.lg, marginBottom: spacing.md },
  lineTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs },
  lineRow: { flexDirection: "row", gap: spacing.md },
  addLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.md },
  bolloRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  exemptBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
});
