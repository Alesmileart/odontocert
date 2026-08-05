import React, { useCallback, useRef, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button, Card } from "@/src/components/ui";
import { Field } from "@/src/components/Field";
import { FormSheet } from "@/src/components/FormSheet";
import { SignaturePad, SignaturePadRef } from "@/src/components/SignaturePad";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { colors, fontSize, spacing, radius } from "@/src/theme";

type Client = { id: string; name: string; clinic: string; address: string; vat: string; email: string; phone: string };
type Material = { id: string; name: string; manufacturer: string; ce_number: string; lot_default: string; category: string };
type DeclMaterial = { name: string; manufacturer: string; ce_number: string; lot: string; category: string };

const STEPS = ["Cliente", "Dispositivo", "Materiali", "Conformità", "Firma"];
const emptyMat: DeclMaterial = { name: "", manufacturer: "", ce_number: "", lot: "", category: "" };

const NORM_DEFAULT = "Regolamento (UE) 2017/745 (MDR) - Allegato XIII";

export default function NewDeclaration() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const sigRef = useRef<SignaturePadRef>(null);

  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  const [libMaterials, setLibMaterials] = useState<Material[]>([]);
  const [saving, setSaving] = useState(false);

  // form data
  const [clientId, setClientId] = useState<string | null>(null);
  const [client, setClient] = useState<Client>({ id: "", name: "", clinic: "", address: "", vat: "", email: "", phone: "" });
  const [patientRef, setPatientRef] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceDescription, setDeviceDescription] = useState("");
  const [materials, setMaterials] = useState<DeclMaterial[]>([]);
  const [conformity, setConformity] = useState({
    mdr_2017_745: true,
    made_to_prescription: true,
    single_patient: true,
    biocompatible: true,
    notes: "",
  });
  const [normRef, setNormRef] = useState(NORM_DEFAULT);
  const [technicianName, setTechnicianName] = useState("");

  const [matSheet, setMatSheet] = useState(false);
  const [customMat, setCustomMat] = useState<DeclMaterial>(emptyMat);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api.get<Client[]>("/clients"), api.get<Material[]>("/materials")]);
      setClients(c);
      setLibMaterials(m);
    } catch {
      /* empty */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const selectClient = (c: Client) => {
    setClientId(c.id);
    setClient(c);
  };

  const addLibMaterial = (m: Material) => {
    setMaterials((prev) => [
      ...prev,
      { name: m.name, manufacturer: m.manufacturer, ce_number: m.ce_number, lot: m.lot_default, category: m.category },
    ]);
  };

  const addCustomMaterial = () => {
    if (!customMat.name.trim()) {
      toast.show("Inserisci il nome del materiale", "error");
      return;
    }
    setMaterials((prev) => [...prev, customMat]);
    setCustomMat(emptyMat);
    setMatSheet(false);
  };

  const removeMaterial = (idx: number) => setMaterials((prev) => prev.filter((_, i) => i !== idx));
  const updateLot = (idx: number, lot: string) =>
    setMaterials((prev) => prev.map((m, i) => (i === idx ? { ...m, lot } : m)));

  const canNext = () => {
    if (step === 0) return !!client.name.trim();
    if (step === 1) return !!deviceType.trim();
    return true;
  };

  const goNext = () => {
    if (!canNext()) {
      toast.show(step === 0 ? "Seleziona o inserisci un cliente" : "Indica il tipo di dispositivo", "error");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const buildPayload = (signature: string) => ({
    client_id: clientId,
    client_snapshot: {
      name: client.name,
      clinic: client.clinic,
      address: client.address,
      vat: client.vat,
      email: client.email,
      phone: client.phone,
    },
    patient_ref: patientRef,
    device_type: deviceType,
    device_description: deviceDescription,
    materials,
    conformity,
    norm_reference: normRef,
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

  const issue = () => {
    // triggers signature read -> onOK/onEmpty
    sigRef.current?.read();
  };

  const progress = (step + 1) / STEPS.length;

  return (
    <View style={styles.container}>
      {/* Header + progress */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={10} testID="wizard-back">
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <AppText variant="semibold" size={fontSize.base}>
              Nuova dichiarazione
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

      {/* Content */}
      {step === 4 ? (
        <View style={styles.signStep}>
          <AppText variant="bold" size={fontSize.xl}>
            Firma del tecnico
          </AppText>
          <AppText size={fontSize.base} color={colors.muted} style={{ marginBottom: spacing.md }}>
            Firma nell'area sottostante per emettere la dichiarazione.
          </AppText>
          <Field
            label="Nome firmatario"
            value={technicianName}
            onChangeText={setTechnicianName}
            placeholder="Nome dell'odontotecnico"
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
                Committente
              </AppText>
              {clients.length > 0 && (
                <>
                  <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
                    DALL'ANAGRAFICA
                  </AppText>
                  <View style={styles.clientList}>
                    {clients.map((c) => {
                      const active = clientId === c.id;
                      return (
                        <Pressable key={c.id} onPress={() => selectClient(c)} testID={`select-client-${c.id}`}>
                          <Card style={[styles.clientCard, active && styles.clientCardActive]}>
                            <View style={{ flex: 1 }}>
                              <AppText variant="semibold" size={fontSize.base}>
                                {c.name}
                              </AppText>
                              <AppText size={fontSize.sm} color={colors.muted}>
                                {c.clinic || "—"}
                              </AppText>
                            </View>
                            {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} /> : null}
                          </Card>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
                DATI COMMITTENTE
              </AppText>
              <Field label="Nome / Odontoiatra *" value={client.name} onChangeText={(t) => { setClient({ ...client, name: t }); setClientId(null); }} placeholder="Dott. Bianchi" testID="decl-client-name" />
              <Field label="Studio / Clinica" value={client.clinic} onChangeText={(t) => setClient({ ...client, clinic: t })} placeholder="Studio Dentistico" testID="decl-client-clinic" />
              <Field label="Indirizzo" value={client.address} onChangeText={(t) => setClient({ ...client, address: t })} placeholder="Via Roma 1, Milano" testID="decl-client-address" />
              <Field label="Partita IVA" value={client.vat} onChangeText={(t) => setClient({ ...client, vat: t })} placeholder="IT01234567890" mono autoCapitalize="characters" testID="decl-client-vat" />
            </>
          )}

          {step === 1 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Dispositivo protesico
              </AppText>
              <Field label="Riferimento paziente" value={patientRef} onChangeText={setPatientRef} placeholder="Es. iniziali o codice (privacy)" testID="decl-patient-ref" />
              <Field label="Tipo di dispositivo *" value={deviceType} onChangeText={setDeviceType} placeholder="Es. Corona in zirconia" testID="decl-device-type" />
              <Field label="Descrizione dettagliata" value={deviceDescription} onChangeText={setDeviceDescription} placeholder="Elementi, materiali, colore, note tecniche…" multiline testID="decl-device-description" />
            </>
          )}

          {step === 2 && (
            <>
              <AppText variant="bold" size={fontSize.xl} style={styles.stepTitle}>
                Materiali impiegati
              </AppText>
              {libMaterials.length > 0 && (
                <>
                  <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.miniLabel}>
                    AGGIUNGI DALL'ANAGRAFICA
                  </AppText>
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
                </>
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
                Dichiarazioni di conformità
              </AppText>
              <ToggleRow label="Conforme al Reg. (UE) 2017/745 (MDR)" value={conformity.mdr_2017_745} onToggle={(v) => setConformity({ ...conformity, mdr_2017_745: v })} testID="toggle-mdr" />
              <ToggleRow label="Fabbricato su misura secondo prescrizione" value={conformity.made_to_prescription} onToggle={(v) => setConformity({ ...conformity, made_to_prescription: v })} testID="toggle-prescription" />
              <ToggleRow label="Destinato al singolo paziente indicato" value={conformity.single_patient} onToggle={(v) => setConformity({ ...conformity, single_patient: v })} testID="toggle-single-patient" />
              <ToggleRow label="Materiali biocompatibili e marcati CE" value={conformity.biocompatible} onToggle={(v) => setConformity({ ...conformity, biocompatible: v })} testID="toggle-biocompatible" />
              <View style={{ height: spacing.md }} />
              <Field label="Riferimento normativo" value={normRef} onChangeText={setNormRef} placeholder={NORM_DEFAULT} multiline testID="decl-norm-ref" />
              <Field label="Note aggiuntive" value={conformity.notes} onChangeText={(t) => setConformity({ ...conformity, notes: t })} placeholder="Eventuali note o avvertenze" multiline testID="decl-notes" />
            </>
          )}
        </KeyboardAwareScrollView>
      )}

      {/* Bottom actions */}
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
  miniLabel: { letterSpacing: 0.5, marginBottom: spacing.sm },
  clientList: { gap: spacing.sm, marginBottom: spacing.xl },
  clientCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  clientCardActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
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
