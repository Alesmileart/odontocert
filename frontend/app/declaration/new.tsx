import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { SignaturePad, SignaturePadRef } from "@/src/components/SignaturePad";
import { ToothChart } from "@/src/components/ToothChart";
import { DateField } from "@/src/components/DateField";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Client = { id: string; name: string; clinic: string; address: string; vat: string; email: string; phone: string };
type Material = { id: string; name: string; manufacturer: string; ce_number: string; lot_default: string; category: string; track_stock?: boolean; unit?: string };
type DeclMaterial = { name: string; manufacturer: string; ce_number: string; lot: string; category: string; material_id: string; qty: number; unit: string };

const STEPS = ["Lavoro", "Arcata", "Prescrizione", "Etichetta", "Firma"];
const emptyMat: DeclMaterial = { name: "", manufacturer: "", ce_number: "", lot: "", category: "", material_id: "", qty: 0, unit: "" };

export default function NewDeclaration() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const sigRef = useRef<SignaturePadRef>(null);
  const { from } = useLocalSearchParams<{ from?: string }>();
  const prefilled = useRef(false);

  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [libMaterials, setLibMaterials] = useState<Material[]>([]);
  const [saving, setSaving] = useState(false);

  // Step 1 — Lavoro & paziente
  const [codiceLavoro, setCodiceLavoro] = useState("");
  const [patientName, setPatientName] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceDescription, setDeviceDescription] = useState("");
  // Step 2 — Arcata
  const [teeth, setTeeth] = useState<number[]>([]);
  // Step 3 — Prescrizione & materiali
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [prescriptionDate, setPrescriptionDate] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [materials, setMaterials] = useState<DeclMaterial[]>([]);
  // Step 4 — Etichetta & note
  const [deliveryDate, setDeliveryDate] = useState("");
  const [usageDays, setUsageDays] = useState("30");
  const [storage, setStorage] = useState({ no_flip: true, no_shake: true, proper_place: true, non_sterile: true });
  const [annotations, setAnnotations] = useState("");
  // Step 5 — Firma
  const [technicianName, setTechnicianName] = useState("");

  const [matSheet, setMatSheet] = useState(false);
  const [customMat, setCustomMat] = useState<DeclMaterial>(emptyMat);
  const [savePrompt, setSavePrompt] = useState<DeclMaterial | null>(null);
  const [savingLib, setSavingLib] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api.get<Client[]>("/clients"), api.get<Material[]>("/materials")]);
      setClients(c);
      setLibMaterials(m);
    } catch {
      /* empty */
    }
    // Precompila da una dichiarazione esistente (duplica)
    if (from && !prefilled.current) {
      prefilled.current = true;
      try {
        const src = await api.get<any>(`/declarations/${from}`);
        setPatientName(src.patient_name || src.patient_ref || "");
        setDeviceType(src.device_type || "");
        setDeviceDescription(src.device_description || "");
        setTeeth(Array.isArray(src.teeth) ? src.teeth : []);
        setPrescriptionCode(src.prescription_code || "");
        setPrescriber(src.prescriber || src.client_snapshot?.name || "");
        setMaterials(
          (src.materials || []).map((mm: any) => ({
            name: mm.name || "",
            manufacturer: mm.manufacturer || "",
            ce_number: mm.ce_number || "",
            lot: mm.lot || "",
            category: mm.category || "",
            material_id: mm.material_id || "",
            qty: mm.qty || 0,
            unit: mm.unit || "",
          }))
        );
        setUsageDays(src.usage_days || "30");
        setStorage({
          no_flip: src.storage_no_flip ?? true,
          no_shake: src.storage_no_shake ?? true,
          proper_place: src.storage_proper_place ?? true,
          non_sterile: src.non_sterile ?? true,
        });
        setAnnotations(src.annotations || "");
        setTechnicianName(src.technician_name || "");
        if (src.client_id || src.client_snapshot?.name) {
          setSelectedClient({
            id: src.client_id || "",
            name: src.client_snapshot?.name || "",
            clinic: src.client_snapshot?.clinic || "",
            address: src.client_snapshot?.address || "",
            vat: src.client_snapshot?.vat || "",
            email: src.client_snapshot?.email || "",
            phone: src.client_snapshot?.phone || "",
          });
        }
        toast.show("Dati copiati — modifica paziente e lotti", "info");
      } catch {
        /* ignore */
      }
    }
  }, [from, toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addLibMaterial = (m: Material) =>
    setMaterials((prev) => [
      ...prev,
      {
        name: m.name,
        manufacturer: m.manufacturer,
        ce_number: m.ce_number,
        lot: m.lot_default,
        category: m.category,
        material_id: m.id,
        qty: 0,
        unit: m.unit || "",
      },
    ]);

  const addCustomMaterial = () => {
    if (!customMat.name.trim()) {
      toast.show("Inserisci il nome del materiale", "error");
      return;
    }
    const mat = { ...customMat };
    setMaterials((prev) => [...prev, mat]);
    setCustomMat(emptyMat);
    setMatSheet(false);
    // Se il materiale non esiste in anagrafica, chiedi se salvarlo
    const exists = libMaterials.some((lm) => lm.name.trim().toLowerCase() === mat.name.trim().toLowerCase());
    if (!exists) {
      setSavePrompt(mat);
    }
  };

  const saveNewToLibrary = async () => {
    if (!savePrompt) return;
    setSavingLib(true);
    try {
      const created = await api.post<Material>("/materials", {
        name: savePrompt.name,
        manufacturer: savePrompt.manufacturer,
        ce_number: savePrompt.ce_number,
        lot_default: savePrompt.lot,
        category: savePrompt.category,
      });
      // Aggiorna la lista in memoria e collega l'id al materiale della dichiarazione
      setLibMaterials((prev) => [...prev, created]);
      setMaterials((prev) =>
        prev.map((m) =>
          !m.material_id && m.name === savePrompt.name && m.manufacturer === savePrompt.manufacturer
            ? { ...m, material_id: created.id }
            : m
        )
      );
      toast.show("Materiale salvato in anagrafica", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore salvataggio materiale", "error");
    } finally {
      setSavingLib(false);
      setSavePrompt(null);
    }
  };

  const removeMaterial = (idx: number) => setMaterials((prev) => prev.filter((_, i) => i !== idx));
  const updateLot = (idx: number, lot: string) =>
    setMaterials((prev) => prev.map((m, i) => (i === idx ? { ...m, lot } : m)));
  const updateQty = (idx: number, qtyText: string) =>
    setMaterials((prev) => prev.map((m, i) => (i === idx ? { ...m, qty: parseFloat(qtyText.replace(",", ".")) || 0 } : m)));

  const canNext = () => {
    if (step === 0) return !!patientName.trim() && !!deviceType.trim();
    return true;
  };

  const goNext = () => {
    if (!canNext()) {
      toast.show("Inserisci il paziente e l'identificazione del dispositivo", "error");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const buildPayload = (signature: string) => ({
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
      : { name: prescriber },
    codice_lavoro: codiceLavoro,
    patient_name: patientName,
    patient_ref: patientName,
    device_type: deviceType,
    device_description: deviceDescription,
    teeth,
    prescription_code: prescriptionCode,
    prescription_date: prescriptionDate,
    prescriber,
    materials,
    annotations,
    delivery_date: deliveryDate,
    usage_days: usageDays,
    storage_no_flip: storage.no_flip,
    storage_no_shake: storage.no_shake,
    storage_proper_place: storage.proper_place,
    non_sterile: storage.non_sterile,
    technician_name: technicianName,
    signature_base64: signature,
  });

  const submit = async (signature: string) => {
    setSaving(true);
    try {
      const created = await api.post<{ id: string }>("/declarations", buildPayload(signature));
      toast.show(signature ? "Dichiarazione emessa" : "Bozza salvata", "success");
      router.replace(`/declaration/${created.id}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore nel salvataggio", "error");
      setSaving(false);
    }
  };

  const issue = () => sigRef.current?.read();
  const progress = (step + 1) / STEPS.length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={10} testID="wizard-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <AppText variant="semibold" size={fontSize.base}>
              {from ? "Duplica dichiarazione" : "Nuova dichiarazione"}
            </AppText>
            <AppText size={fontSize.sm} color={colors.muted}>
              {step + 1}/{STEPS.length} · {STEPS[step]}
            </AppText>
          </View>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {step === 4 ? (
        <View style={styles.signStep}>
          <AppText variant="bold" size={fontSize.xl}>
            Firma del legale rappresentante
          </AppText>
          <AppText size={fontSize.base} color={colors.muted} style={{ marginBottom: spacing.md }}>
            Firma nell'area sottostante per emettere la dichiarazione.
          </AppText>
          <Field
            label="Nome firmatario"
            value={technicianName}
            onChangeText={setTechnicianName}
            placeholder="Es. Dettori Alessandro"
            testID="technician-name-input"
          />
          <SignaturePad
            ref={sigRef}
            onOK={(b64) => submit(b64)}
            onEmpty={() => toast.show("Aggiungi una firma o salva come bozza", "error")}
          />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.body}
          bottomOffset={90}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Lavoro e paziente
              </AppText>
              <Field label="Codice lavoro" value={codiceLavoro} onChangeText={setCodiceLavoro} placeholder="Automatico (es. 0023/2026)" mono autoCapitalize="characters" testID="decl-codice-lavoro" />
              <Field label="Paziente (nome e cognome) *" value={patientName} onChangeText={setPatientName} placeholder="Es. Livesu Anna" autoCapitalize="words" testID="decl-patient-name" />
              <Field label="Dispositivo identificato come *" value={deviceType} onChangeText={setDeviceType} placeholder="Es. PROTESI PROVVISORIA" autoCapitalize="characters" testID="decl-device-type" />
              <Field label="Dettaglio dispositivo" value={deviceDescription} onChangeText={setDeviceDescription} placeholder="Es. PROVVISORIO AVVITATO" autoCapitalize="characters" testID="decl-device-description" />
            </>
          )}

          {step === 1 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Elementi dentali
              </AppText>
              <AppText size={fontSize.base} color={colors.muted} style={{ marginBottom: spacing.md }}>
                Tocca i denti interessati dal dispositivo (numerazione FDI).
              </AppText>
              <ToothChart selected={teeth} onChange={setTeeth} />
              {teeth.length > 0 ? (
                <AppText size={fontSize.sm} color={colors.brandPrimary} style={{ marginTop: spacing.md }}>
                  Selezionati: {[...teeth].sort((a, b) => a - b).join(", ")}
                </AppText>
              ) : null}
            </>
          )}

          {step === 2 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Prescrizione
              </AppText>
              <Field label="Codice prescrizione" value={prescriptionCode} onChangeText={setPrescriptionCode} placeholder="Es. 13LIO2AN23" mono autoCapitalize="characters" testID="decl-prescription-code" />
              <DateField label="Data prescrizione" value={prescriptionDate} onChange={setPrescriptionDate} testID="decl-prescription-date" />
              <Field label="Prescrivente (odontoiatra)" value={prescriber} onChangeText={setPrescriber} placeholder="Es. Dott. Bianchi" testID="decl-prescriber" />

              {clients.length > 0 && (
                <>
                  <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
                    PRESCRIVENTE DALL'ANAGRAFICA
                  </AppText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libRow}>
                    {clients.map((c) => {
                      const active = selectedClient?.id === c.id;
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.libPill, active && styles.libPillActive]}
                          onPress={() => {
                            setSelectedClient(c);
                            setPrescriber(c.name);
                          }}
                          testID={`pick-prescriber-${c.id}`}
                        >
                          <Ionicons name="person" size={14} color={active ? colors.onBrandPrimary : colors.brandPrimary} />
                          <AppText variant="medium" size={fontSize.base} color={active ? colors.onBrandPrimary : colors.brandPrimary}>
                            {c.name}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              <AppText variant="bold" size={fontSize.lg} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                Materiali impiegati
              </AppText>
              {libMaterials.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libRow}>
                  {libMaterials.map((m) => (
                    <Pressable key={m.id} style={styles.libPill} onPress={() => addLibMaterial(m)} testID={`add-lib-material-${m.id}`}>
                      <Ionicons name="add" size={16} color={colors.brandPrimary} />
                      <AppText variant="medium" size={fontSize.base} color={colors.brandPrimary}>
                        {m.name}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {materials.length === 0 ? (
                <Card style={styles.matEmpty}>
                  <Ionicons name="cube-outline" size={26} color={colors.muted} />
                  <AppText size={fontSize.base} color={colors.muted} style={{ marginTop: spacing.sm, textAlign: "center" }}>
                    Nessun materiale aggiunto.
                  </AppText>
                </Card>
              ) : (
                <View style={styles.matList}>
                  {materials.map((m, idx) => (
                    <Card key={`${m.name}-${idx}`} style={styles.matCard}>
                      <View style={styles.matCardTop}>
                        <View style={{ flex: 1 }}>
                          <AppText variant="semibold" size={fontSize.base}>
                            {m.name}
                          </AppText>
                          <AppText variant="mono" size={fontSize.sm} color={colors.muted}>
                            {m.manufacturer || "—"}{m.ce_number ? ` · CE ${m.ce_number}` : ""}
                          </AppText>
                        </View>
                        <Pressable onPress={() => removeMaterial(idx)} hitSlop={10} testID={`remove-material-${idx}`}>
                          <Ionicons name="close-circle" size={22} color={colors.error} />
                        </Pressable>
                      </View>
                      <Field label="Numero di lotto" value={m.lot} onChangeText={(t) => updateLot(idx, t)} placeholder="LOT-…" mono autoCapitalize="characters" testID={`material-lot-${idx}`} />
                      {m.material_id && m.unit ? (
                        <Field
                          label={`Quantità utilizzata (${m.unit}) — scarico magazzino`}
                          value={m.qty ? String(m.qty) : ""}
                          onChangeText={(t) => updateQty(idx, t)}
                          placeholder="0"
                          keyboardType="decimal-pad"
                          testID={`material-qty-${idx}`}
                        />
                      ) : null}
                    </Card>
                  ))}
                </View>
              )}

              <Pressable style={styles.addManual} onPress={() => setMatSheet(true)} testID="add-custom-material">
                <Ionicons name="add-circle-outline" size={20} color={colors.brandPrimary} />
                <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
                  Aggiungi materiale manualmente
                </AppText>
              </Pressable>
            </>
          )}

          {step === 3 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Etichetta e note
              </AppText>
              <DateField label="Data di consegna" value={deliveryDate} onChange={setDeliveryDate} placeholder="GG/MM/AAAA (default: oggi)" testID="decl-delivery-date" />
              <Field label="Termini per l'utilizzo (giorni)" value={usageDays} onChangeText={setUsageDays} placeholder="30" keyboardType="number-pad" testID="decl-usage-days" />

              <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
                CONDIZIONI DI CONSERVAZIONE
              </AppText>
              <ToggleRow label="Non capovolgere la confezione" value={storage.no_flip} onToggle={(v) => setStorage({ ...storage, no_flip: v })} testID="toggle-no-flip" />
              <ToggleRow label="Non sbattere l'involucro" value={storage.no_shake} onToggle={(v) => setStorage({ ...storage, no_shake: v })} testID="toggle-no-shake" />
              <ToggleRow label="Conservare in luogo adeguato" value={storage.proper_place} onToggle={(v) => setStorage({ ...storage, proper_place: v })} testID="toggle-proper-place" />
              <ToggleRow label="NON STERILE (non sterilizzare a caldo)" value={storage.non_sterile} onToggle={(v) => setStorage({ ...storage, non_sterile: v })} testID="toggle-non-sterile" />

              <View style={{ height: spacing.md }} />
              <Field label="Annotazioni / eccezioni" value={annotations} onChangeText={setAnnotations} placeholder="Lascia vuoto per «Nessuna»" multiline testID="decl-annotations" />
            </>
          )}
        </KeyboardAwareScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step === STEPS.length - 1 ? (
          <View style={{ gap: spacing.sm }}>
            <Button title="Firma ed emetti" onPress={issue} loading={saving} testID="issue-declaration-button" />
            <Button title="Salva come bozza" kind="secondary" onPress={() => submit("")} disabled={saving} testID="save-draft-button" />
          </View>
        ) : (
          <Button title="Continua" onPress={goNext} testID="wizard-next-button" />
        )}
      </View>

      <FormSheet
        visible={matSheet}
        title="Materiale personalizzato"
        onClose={() => setMatSheet(false)}
        footer={<Button title="Aggiungi" onPress={addCustomMaterial} testID="confirm-custom-material" />}
      >
        <Field label="Nome materiale *" value={customMat.name} onChangeText={(t) => setCustomMat({ ...customMat, name: t })} placeholder="Zirconia" testID="custom-mat-name" />
        <Field label="Produttore" value={customMat.manufacturer} onChangeText={(t) => setCustomMat({ ...customMat, manufacturer: t })} placeholder="Ivoclar" testID="custom-mat-manufacturer" />
        <Field label="Marcatura CE" value={customMat.ce_number} onChangeText={(t) => setCustomMat({ ...customMat, ce_number: t })} placeholder="CE 0123" mono autoCapitalize="characters" testID="custom-mat-ce" />
        <Field label="Numero di lotto" value={customMat.lot} onChangeText={(t) => setCustomMat({ ...customMat, lot: t })} placeholder="LOT-…" mono autoCapitalize="characters" testID="custom-mat-lot" />
      </FormSheet>

      <FormSheet
        visible={!!savePrompt}
        title="Salvare in anagrafica?"
        onClose={() => setSavePrompt(null)}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button title="Sì, salva in anagrafica" onPress={saveNewToLibrary} loading={savingLib} testID="save-new-material-yes" />
            <Button title="No, usa solo qui" kind="secondary" onPress={() => setSavePrompt(null)} disabled={savingLib} testID="save-new-material-no" />
          </View>
        }
      >
        <AppText size={fontSize.base} color={colors.onSurfaceSecondary}>
          «{savePrompt?.name}» non è presente nella tua anagrafica materiali. Vuoi aggiungerlo per
          riutilizzarlo nelle prossime dichiarazioni?
        </AppText>
      </FormSheet>
    </View>
  );
}

function ToggleRow({ label, value, onToggle, testID }: { label: string; value: boolean; onToggle: (v: boolean) => void; testID?: string }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onToggle(!value)} testID={testID}>
      <View style={[styles.checkbox, value && styles.checkboxOn]}>
        {value ? <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} /> : null}
      </View>
      <AppText size={fontSize.base} style={{ flex: 1 }}>
        {label}
      </AppText>
    </Pressable>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  progressTrack: { height: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  body: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  signStep: { flex: 1, padding: spacing.xl },
  stepTitle: { marginBottom: spacing.lg },
  miniLabel: { letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  libRow: { gap: spacing.sm, paddingBottom: spacing.lg },
  libPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandSecondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexShrink: 0,
  },
  libPillActive: { backgroundColor: colors.brandPrimary },
  matEmpty: { alignItems: "center", paddingVertical: spacing.xl },
  matList: { gap: spacing.md },
  matCard: { padding: spacing.lg },
  matCardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.sm },
  addManual: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.lg },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
});
