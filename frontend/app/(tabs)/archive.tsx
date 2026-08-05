import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Card, Badge } from "@/src/components/ui";
import { api } from "@/src/api/client";
import { colors, fontSize, spacing, radius } from "@/src/theme";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1651760680066-db9d32bd0357?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxlbXB0eSUyMGNsaXBib2FyZCUyMGNsZWFuJTIwbWluaW1hbHxlbnwwfHx8fDE3ODU5MjIxNzV8MA&ixlib=rb-4.1.0&q=85";

type Decl = {
  id: string;
  number: string;
  codice_lavoro?: string;
  patient_name?: string;
  patient_ref?: string;
  device_type: string;
  issue_date: string;
  status: string;
};

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
  const [items, setItems] = useState<Decl[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const data = await api.get<Decl[]>("/declarations");
      setItems(data);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        (d.codice_lavoro || "").toLowerCase().includes(q) ||
        (d.device_type || "").toLowerCase().includes(q) ||
        (d.patient_name || d.patient_ref || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <AppText variant="bold" size={fontSize["2xl"]} style={styles.headerTitle}>
          Archivio
        </AppText>
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
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/declaration/${item.id}`)}
              testID={`archive-item-${item.id}`}
            >
              <Card style={styles.card}>
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
              </Card>
            </Pressable>
          )}
        />
      )}
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
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
