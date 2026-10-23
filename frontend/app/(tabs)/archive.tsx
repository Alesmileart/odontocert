import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { AppText, Card, Badge, Button } from "@/src/components/ui";
import { FormSheet } from "@/src/components/FormSheet";
import { DateField } from "@/src/components/DateField";
import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { exportDeclarationsBatchPdf, LabProfile, DeclarationData } from "@/src/utils/pdf";
import { colors, fontSize, spacing, radius } from "@/src/theme";

dayjs.extend(customParseFormat);

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1651760680066-db9d32bd0357?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxlbXB0eSUyMGNsaXBib2FyZCUyMGNsZWFuJTIwbWluaW1hbHxlbnwwfHx8fDE3ODU5MjIxNzV8MA&ixlib=rb-4.1.0&q=85";

type Decl = {
  id: string;
  number: string;
  codice_lavoro?: string;
  patient_name?: string;
  patient_ref?: string;
  prescriber?: string;
  client_snapshot?: { name?: string };
  device_type: string;
  issue_date: string;
  status: string;
};

function prescriberOf(d: Decl) {
  return (d.client_snapshot?.name || d.prescriber || "").trim();
}

const FILTERS = [
  { key: "all", label: "Tutte" },
  { key: "issued", label: "Emesse" },
  { key: "draft", label: "Bozze" },
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Archive() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<Decl[]>([]);
  const [lab, setLab] = useState<LabProfile>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [filterSheet, setFilterSheet] = useState(false);
  const [prescriberFilter, setPrescriberFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Selezione multipla
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, prof] = await Promise.all([api.get<Decl[]>("/declarations"), api.get<LabProfile>("/profile")]);
      setItems(data);
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

  const prescriberOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((d) => {
      const p = prescriberOf(d);
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const activeFilterCount =
    (prescriberFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const resetFilters = () => {
    setPrescriberFilter(null);
    setDateFrom("");
    setDateTo("");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? dayjs(dateFrom, "DD/MM/YYYY", true) : null;
    const to = dateTo ? dayjs(dateTo, "DD/MM/YYYY", true) : null;
    return items.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (prescriberFilter && prescriberOf(d) !== prescriberFilter) return false;
      if (from && from.isValid()) {
        const iss = dayjs(d.issue_date);
        if (iss.isValid() && iss.isBefore(from.startOf("day"))) return false;
      }
      if (to && to.isValid()) {
        const iss = dayjs(d.issue_date);
        if (iss.isValid() && iss.isAfter(to.endOf("day"))) return false;
      }
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        (d.codice_lavoro || "").toLowerCase().includes(q) ||
        (d.device_type || "").toLowerCase().includes(q) ||
        (d.patient_name || d.patient_ref || "").toLowerCase().includes(q) ||
        prescriberOf(d).toLowerCase().includes(q)
      );
    });
  }, [items, query, filter, prescriberFilter, dateFrom, dateTo]);

  const selectableFiltered = useMemo(() => filtered.filter((d) => d.status === "issued"), [filtered]);

  const enterSelect = () => {
    setSelectMode(true);
    setSelectedIds([]);
  };
  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds([]);
  };
  const toggleSelect = (d: Decl) => {
    if (d.status !== "issued") {
      toast.show("Solo le dichiarazioni emesse sono selezionabili", "info");
      return;
    }
    setSelectedIds((prev) => (prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]));
  };
  const allSelected = selectableFiltered.length > 0 && selectedIds.length === selectableFiltered.length;
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : selectableFiltered.map((d) => d.id));
  };

  const onItemPress = (d: Decl) => {
    if (selectMode) toggleSelect(d);
    else router.push(`/declaration/${d.id}`);
  };

  const printSelected = async () => {
    if (selectedIds.length === 0) {
      toast.show("Seleziona almeno una dichiarazione", "error");
      return;
    }
    setBatchBusy(true);
    try {
      const list = items.filter((d) => selectedIds.includes(d.id)) as unknown as DeclarationData[];
      await exportDeclarationsBatchPdf(list, lab);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Errore stampa", "error");
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <AppText variant="bold" size={fontSize["2xl"]}>
            Archivio
          </AppText>
          {selectMode ? (
            <View style={styles.selHeaderActions}>
              <Pressable onPress={toggleSelectAll} hitSlop={8} testID="select-all">
                <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
                  {allSelected ? "Deseleziona" : "Tutte"}
                </AppText>
              </Pressable>
              <Pressable onPress={exitSelect} hitSlop={8} testID="exit-select">
                <AppText variant="semibold" size={fontSize.base} color={colors.muted}>
                  Annulla
                </AppText>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={enterSelect} hitSlop={8} style={styles.selectBtn} testID="enter-select">
              <Ionicons name="checkmark-done-outline" size={18} color={colors.brandPrimary} />
              <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
                Seleziona
              </AppText>
            </Pressable>
          )}
        </View>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Cerca per numero, cliente, dispositivo…"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              testID="archive-search-input"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8} testID="clear-search">
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable style={styles.filterBtn} onPress={() => setFilterSheet(true)} testID="open-filters">
            <Ionicons name="options-outline" size={20} color={activeFilterCount ? colors.onBrandPrimary : colors.brandPrimary} />
            {activeFilterCount ? (
              <View style={styles.filterBadge}>
                <AppText variant="bold" size={10} color={colors.onBrandPrimary}>
                  {activeFilterCount}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active ? styles.chipActive : null]}
                testID={`filter-chip-${f.key}`}
              >
                <AppText
                  variant={active ? "semibold" : "medium"}
                  size={fontSize.base}
                  color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}
                >
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty} testID="archive-empty">
              <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} contentFit="cover" />
              <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.lg }}>
                Nessuna dichiarazione
              </AppText>
              <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
                {query || filter !== "all"
                  ? "Nessun risultato per i filtri attivi."
                  : "Le dichiarazioni emesse appariranno qui."}
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const checked = selectedIds.includes(item.id);
            const selectable = item.status === "issued";
            return (
              <Pressable onPress={() => onItemPress(item)} testID={`archive-item-${item.id}`}>
                <Card style={[styles.card, selectMode && checked ? styles.cardChecked : null]}>
                  <View style={styles.cardRow}>
                    {selectMode ? (
                      <View
                        style={[
                          styles.checkCircle,
                          checked && styles.checkCircleOn,
                          !selectable && styles.checkCircleDisabled,
                        ]}
                        testID={`select-checkbox-${item.id}`}
                      >
                        {checked ? <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} /> : null}
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardTop}>
                        <AppText variant="monoBold" size={fontSize.sm} color={colors.brandPrimary}>
                          {item.codice_lavoro || item.number}
                        </AppText>
                        <Badge status={item.status} />
                      </View>
                      <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.xs }}>
                        {item.device_type || "Dispositivo"}
                      </AppText>
                      <View style={styles.meta}>
                        <Ionicons name="person-outline" size={14} color={colors.muted} />
                        <AppText size={fontSize.sm} color={colors.muted}>
                          {item.patient_name || item.patient_ref || "—"} · {fmtDate(item.issue_date)}
                        </AppText>
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}

      {selectMode ? (
        <View style={[styles.batchBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppText variant="semibold" size={fontSize.base} color={colors.onSurfaceSecondary}>
            {selectedIds.length} selezionate
          </AppText>
          <View style={{ flex: 1 }}>
            <Button
              title="Stampa / Invia selezionate"
              onPress={printSelected}
              loading={batchBusy}
              disabled={selectedIds.length === 0}
              icon={<Ionicons name="print-outline" size={18} color={colors.onBrandPrimary} />}
              testID="print-selected"
            />
          </View>
        </View>
      ) : null}

      <FormSheet
        visible={filterSheet}
        title="Filtri"
        onClose={() => setFilterSheet(false)}
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button title="Applica" onPress={() => setFilterSheet(false)} testID="apply-filters" />
            {activeFilterCount ? (
              <Button title="Azzera filtri" kind="secondary" onPress={resetFilters} testID="reset-filters" />
            ) : null}
          </View>
        }
      >
        <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.filterLabel}>
          PRESCRIVENTE
        </AppText>
        <View style={styles.prescriberWrap}>
          <Pressable
            style={[styles.presChip, !prescriberFilter && styles.presChipActive]}
            onPress={() => setPrescriberFilter(null)}
            testID="prescriber-all"
          >
            <AppText variant={!prescriberFilter ? "semibold" : "medium"} size={fontSize.base} color={!prescriberFilter ? colors.onBrandPrimary : colors.onSurfaceSecondary}>
              Tutti
            </AppText>
          </Pressable>
          {prescriberOptions.map((p) => {
            const active = prescriberFilter === p;
            return (
              <Pressable
                key={p}
                style={[styles.presChip, active && styles.presChipActive]}
                onPress={() => setPrescriberFilter(active ? null : p)}
                testID={`prescriber-${p}`}
              >
                <AppText variant={active ? "semibold" : "medium"} size={fontSize.base} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary}>
                  {p}
                </AppText>
              </Pressable>
            );
          })}
          {prescriberOptions.length === 0 ? (
            <AppText size={fontSize.sm} color={colors.muted}>
              Nessun prescrivente disponibile
            </AppText>
          ) : null}
        </View>

        <AppText variant="medium" size={fontSize.sm} color={colors.muted} style={styles.filterLabel}>
          PERIODO (DATA DI EMISSIONE)
        </AppText>
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <DateField label="Dal" value={dateFrom} onChange={setDateFrom} testID="filter-date-from" />
          </View>
          <View style={{ flex: 1 }}>
            <DateField label="Al" value={dateTo} onChange={setDateTo} testID="filter-date-to" />
          </View>
        </View>
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
    paddingBottom: spacing.md,
  },
  headerTitle: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  selectBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  selHeaderActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  cardChecked: { borderColor: colors.brandPrimary, borderWidth: 1.5 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  checkCircleDisabled: { opacity: 0.35 },
  batchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.xl },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: { letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm },
  prescriberWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  presChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  dateRow: { flexDirection: "row", gap: spacing.md },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.onSurface, fontFamily: "PlusJakartaSans-Regular" },
  chipsRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingTop: spacing.md },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  card: { padding: spacing.lg },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  empty: { alignItems: "center", paddingTop: spacing["3xl"] },
  emptyImg: { width: 140, height: 140, borderRadius: radius.lg },
  emptyText: { marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.xl },
});
