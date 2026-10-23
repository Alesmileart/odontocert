import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import { AppText, Card, Badge } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, fontSize, spacing, radius, shadow } from "@/src/theme";

const HERO =
  "https://images.unsplash.com/photo-1590424693420-634a0b0b782c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxkZW50YWwlMjBsYWJvcmF0b3J5JTIwbWFjcm8lMjBwcm9zdGhldGljfGVufDB8fHx8MTc4NTkyMjE3NXww&ixlib=rb-4.1.0&q=85";

type Stats = { total: number; this_year: number; this_month: number; clients: number };
type Decl = { id: string; number: string; codice_lavoro?: string; patient_name?: string; patient_ref?: string; device_type: string; issue_date: string; status: string };

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Decl[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api.get<Stats>("/dashboard/stats"), api.get<Decl[]>("/declarations")]);
      setStats(s);
      setRecent(d.slice(0, 5));
    } catch {
      /* handled by empty state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
        }
      >
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
          <View>
            <AppText size={fontSize.base} color={colors.muted}>
              Ciao,
            </AppText>
            <AppText variant="bold" size={fontSize.xl}>
              {user?.name || "Odontotecnico"}
            </AppText>
          </View>
          <Pressable style={styles.avatar} onPress={() => router.push("/(tabs)/profile")} testID="dashboard-avatar">
            <AppText variant="bold" size={fontSize.lg} color={colors.onBrandPrimary}>
              {(user?.name || "?").charAt(0).toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={["rgba(45,74,62,0.55)", "rgba(17,20,18,0.9)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroInner}>
            <AppText variant="medium" size={fontSize.sm} color="rgba(255,255,255,0.8)">
              DICHIARAZIONI QUESTO MESE
            </AppText>
            <AppText variant="bold" size={44} color={colors.onSurfaceInverse}>
              {loading ? "—" : stats?.this_month ?? 0}
            </AppText>
            <View style={styles.heroStats}>
              <View>
                <AppText variant="semibold" size={fontSize.lg} color={colors.onSurfaceInverse}>
                  {stats?.this_year ?? 0}
                </AppText>
                <AppText size={fontSize.sm} color="rgba(255,255,255,0.75)">
                  Quest'anno
                </AppText>
              </View>
              <View style={styles.heroDivider} />
              <View>
                <AppText variant="semibold" size={fontSize.lg} color={colors.onSurfaceInverse}>
                  {stats?.total ?? 0}
                </AppText>
                <AppText size={fontSize.sm} color="rgba(255,255,255,0.75)">
                  Totali
                </AppText>
              </View>
              <View style={styles.heroDivider} />
              <View>
                <AppText variant="semibold" size={fontSize.lg} color={colors.onSurfaceInverse}>
                  {stats?.clients ?? 0}
                </AppText>
                <AppText size={fontSize.sm} color="rgba(255,255,255,0.75)">
                  Clienti
                </AppText>
              </View>
            </View>
          </View>
        </View>

        {/* Recent section */}
        <View style={styles.sectionHeader}>
          <AppText variant="bold" size={fontSize.lg}>
            Recenti
          </AppText>
          {recent.length > 0 ? (
            <Pressable onPress={() => router.push("/(tabs)/archive")} testID="see-all-archive">
              <AppText variant="semibold" size={fontSize.base} color={colors.brandPrimary}>
                Vedi tutte
              </AppText>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing["2xl"] }} />
        ) : recent.length === 0 ? (
          <Card style={styles.emptyCard} testID="dashboard-empty">
            <View style={styles.emptyIcon}>
              <Ionicons name="document-text-outline" size={28} color={colors.brandPrimary} />
            </View>
            <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.md }}>
              Nessuna dichiarazione
            </AppText>
            <AppText size={fontSize.base} color={colors.muted} style={styles.emptyText}>
              Crea il tuo primo documento di conformità MDR.
            </AppText>
          </Card>
        ) : (
          <View style={styles.list}>
            {recent.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => router.push(`/declaration/${d.id}`)}
                testID={`declaration-card-${d.id}`}
              >
                <Card style={styles.declCard}>
                  <View style={styles.declTop}>
                    <AppText variant="monoBold" size={fontSize.sm} color={colors.brandPrimary}>
                      {d.codice_lavoro || d.number}
                    </AppText>
                    <Badge status={d.status} />
                  </View>
                  <AppText variant="semibold" size={fontSize.lg} style={{ marginTop: spacing.xs }}>
                    {d.device_type || "Dispositivo"}
                  </AppText>
                  <View style={styles.declMeta}>
                    <Ionicons name="person-outline" size={14} color={colors.muted} />
                    <AppText size={fontSize.sm} color={colors.muted}>
                      {d.patient_name || d.patient_ref || "—"}
                    </AppText>
                    <AppText size={fontSize.sm} color={colors.muted}>
                      · {fmtDate(d.issue_date)}
                    </AppText>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 80 }]}
        onPress={() => router.push("/declaration/new")}
        testID="new-declaration-fab"
      >
        <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        <AppText variant="semibold" size={fontSize.base} color={colors.onBrandPrimary}>
          Nuova dichiarazione
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    marginHorizontal: spacing.xl,
    height: 190,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  heroInner: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  heroStats: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
  heroDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.25)" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.xl, gap: spacing.md },
  declCard: { padding: spacing.lg },
  declTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  declMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
  emptyCard: { marginHorizontal: spacing.xl, alignItems: "center", paddingVertical: spacing["2xl"] },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { marginTop: spacing.xs, textAlign: "center" },
  fab: {
    position: "absolute",
    right: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    ...shadow.card,
  },
});
