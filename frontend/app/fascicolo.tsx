import React, { useCallback, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { exportProtocolsFascicoloPdf, exportSingleProtocolPdf, LabProfile, ProtocolItem } from "@/src/utils/pdf";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Protocol = { id: string; title: string; body: string; order: number };
const empty: Protocol = { id: "", title: "", body: "", order: 0 };

const DEFAULT_TEMPLATES: { title: string; body: string }[] = [
  {
    title: "Protesi fissa (corone, ponti, faccette)",
    body:
      "- Ricezione della prescrizione e delle impronte/scansioni dal professionista sanitario\n" +
      "- Sviluppo dei modelli e messa in articolatore\n" +
      "- Progettazione (analogica o CAD) della struttura\n" +
      "- Realizzazione della struttura (fusione, fresaggio CAD/CAM, pressatura)\n" +
      "- Applicazione della ceramica / rifinitura estetica\n" +
      "- Controllo occlusale, di adattamento e finitura\n" +
      "- Lucidatura, igienizzazione e controllo qualità finale\n" +
      "- Registrazione dei materiali e dei lotti utilizzati nel fascicolo tecnico",
  },
  {
    title: "Protesi mobile totale",
    body:
      "- Ricezione prescrizione e impronte\n" +
      "- Sviluppo modelli e realizzazione basi con valli in cera\n" +
      "- Montaggio dei denti e prova estetico-funzionale\n" +
      "- Messa in muffola e sostituzione della cera con resina\n" +
      "- Polimerizzazione della resina\n" +
      "- Rifinitura, molaggio selettivo e lucidatura\n" +
      "- Igienizzazione e controllo qualità finale\n" +
      "- Registrazione materiali e lotti nel fascicolo tecnico",
  },
  {
    title: "Protesi parziale rimovibile / scheletrato",
    body:
      "- Ricezione prescrizione, modelli e progetto degli appoggi\n" +
      "- Duplicazione del modello e fusione della struttura in lega\n" +
      "- Sabbiatura, rifinitura e prova della struttura\n" +
      "- Montaggio denti e finalizzazione in resina\n" +
      "- Rifinitura e lucidatura\n" +
      "- Controllo qualità e igienizzazione\n" +
      "- Registrazione materiali e lotti nel fascicolo tecnico",
  },
  {
    title: "Provvisori",
    body:
      "- Ricezione prescrizione e modelli/scansioni\n" +
      "- Realizzazione del provvisorio (diretto, fresato o stampato)\n" +
      "- Rifinitura e lucidatura\n" +
      "- Controllo adattamento e occlusione\n" +
      "- Igienizzazione e controllo qualità finale",
  },
  {
    title: "Dispositivi ortodontici / bite",
    body:
      "- Ricezione prescrizione e modelli/scansioni\n" +
      "- Progettazione del dispositivo\n" +
      "- Piegatura elementi / termoformatura / stampa\n" +
      "- Rifinitura e lucidatura\n" +
      "- Controllo adattamento e qualità finale\n" +
      "- Registrazione materiali e lotti nel fascicolo tecnico",
  },
];

export default function Fascicolo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Protocol[]>([]);
  const [lab, setLab] = useState<LabProfile>({});
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [edit, setEdit] = useState<Protocol>(empty);

  const load = useCallback(async () => {
    try {
      const [p, prof] = await Promise.all([api.get<Protocol[]>("/protocols"), api.get<LabProfile>("/profile")]);
      setItems(p);
      setLab(prof);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openNew = () => {
    setEdit({ ...empty, order: items.length + 1 });
    setSheetOpen(true);
  };
  const openEdit = (p: Protocol) => {
    setEdit(p);
    setSheetOpen(true);
  };

  const save = async () => {
    if (!edit.title.trim()) {
      toast.show("Inserisci la tipologia di lavorazione", "error");
      return;
    }
    setSaving(true);
    try {
      if (edit.id) await api.put(`/protocols/${edit.id}`, { title: edit.title, body: edit.body, order: edit.order });
      else await api.post("/protocols", { title: edit.title, body: edit.body, order: edit.order });
      setSheetOpen(false);
      toast.show("Protocollo salvato", "success");
      load();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Protocol) => {
    try {
      await api.del(`/protocols/${p.id}`);
      toast.show("Protocollo eliminato", "success");
      load();
    } catch {
      toast.show("Errore eliminazione", "error");
    }
  };

  const addDefaults = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
        const t = DEFAULT_TEMPLATES[i];
        await api.post("/protocols", { title: t.title, body: t.body, order: i + 1 });
      }
      toast.show("Modelli predefiniti aggiunti", "success");
      load();
    } catch {
      toast.show("Errore nell'aggiunta dei modelli", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportFascicolo = async () => {
    if (items.length === 0) {
      toast.show("Aggiungi almeno un protocollo", "error");
      return;
    }
    setExporting(true);
    try {
      await exportProtocolsFascicoloPdf(items as ProtocolItem[], lab);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore esportazione", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSingle = async (p: Protocol) => {
    try {
      await exportSingleProtocolPdf(p as ProtocolItem, lab);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore esportazione", "error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="fascicolo-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <AppText variant="semibold" size={fontSize.base}>
            Fascicolo protocolli
          </AppText>
          <Pressable onPress={openNew} hitSlop={10} testID="fascicolo-add-header">
            <Ionicons name="add" size={26} color={colors.brandPrimary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <AppText size={fontSize.sm} color={colors.muted} style={styles.intro}>
              Protocolli generali di fabbricazione suddivisi per tipologia di lavorazione. Conservati in
              archivio e stampabili su richiesta (fascicolo completo o singolo protocollo).
            </AppText>
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="fascicolo-empty">
              <View style={styles.emptyIcon}>
                <Ionicons name="folder-open-outline" size={28} color={colors.brandPrimary} />
              </View>
              <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.md }}>
                Nessun protocollo
              </AppText>
              <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
                Crea i tuoi protocolli oppure parti dai modelli predefiniti per tipologia di lavorazione.
              </AppText>
              <Button title="Aggiungi modelli predefiniti" kind="secondary" onPress={addDefaults} loading={saving} style={{ marginTop: spacing.lg }} testID="add-default-templates" />
            </View>
          }
          renderItem={({ item, index }) => (
            <Pressable onPress={() => openEdit(item)} testID={`protocol-item-${item.id}`}>
              <Card style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.numBadge}>
                    <AppText variant="bold" size={fontSize.sm} color={colors.onBrandPrimary}>
                      {index + 1}
                    </AppText>
                  </View>
                  <AppText variant="semibold" size={fontSize.lg} style={{ flex: 1 }}>
                    {item.title}
                  </AppText>
                </View>
                <AppText size={fontSize.sm} color={colors.muted} numberOfLines={2} style={{ marginTop: spacing.sm }}>
                  {item.body || "Nessun contenuto"}
                </AppText>
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionBtn} onPress={() => exportSingle(item)} testID={`print-protocol-${item.id}`}>
                    <Ionicons name="print-outline" size={18} color={colors.brandPrimary} />
                    <AppText variant="semibold" size={fontSize.sm} color={colors.brandPrimary}>
                      Stampa
                    </AppText>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => remove(item)} testID={`delete-protocol-${item.id}`}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <AppText variant="semibold" size={fontSize.sm} color={colors.error}>
                      Elimina
                    </AppText>
                  </Pressable>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      {items.length > 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Esporta fascicolo completo (PDF)"
            onPress={exportFascicolo}
            loading={exporting}
            icon={<Ionicons name="document-text-outline" size={20} color={colors.onBrandPrimary} />}
            testID="export-fascicolo-button"
          />
        </View>
      ) : null}

      <FormSheet
        visible={sheetOpen}
        title={edit.id ? "Modifica protocollo" : "Nuovo protocollo"}
        onClose={() => setSheetOpen(false)}
        footer={<Button title="Salva" onPress={save} loading={saving} testID="protocol-save-button" />}
      >
        <Field
          label="Tipologia di lavorazione *"
          value={edit.title}
          onChangeText={(t) => setEdit({ ...edit, title: t })}
          placeholder="Es. Protesi fissa (corone, ponti)"
          testID="protocol-title-input"
        />
        <Field
          label="Descrizione del protocollo"
          value={edit.body}
          onChangeText={(t) => setEdit({ ...edit, body: t })}
          placeholder={"Descrivi le fasi di lavorazione.\nUsa '-' a inizio riga per un elenco puntato."}
          multiline
          testID="protocol-body-input"
        />
        <AppText size={fontSize.sm} color={colors.muted}>
          Suggerimento: inizia le righe con “-” per creare un elenco delle fasi.
        </AppText>
        <View style={{ height: spacing.lg }} />
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  intro: { marginBottom: spacing.md },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { padding: spacing.lg },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  numBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  empty: { alignItems: "center", paddingTop: spacing["2xl"] },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.xl },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
});
