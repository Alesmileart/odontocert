import React from "react";
import { Modal, View, StyleSheet, Pressable, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/src/components/ui";
import { colors, fontSize, spacing } from "@/src/theme";

const VIEWPORT_META = '<meta name="viewport" content="width=800, initial-scale=1, maximum-scale=3">';

export function PdfPreview({
  visible,
  title,
  html,
  onClose,
  onShare,
  sharing,
}: {
  visible: boolean;
  title: string;
  html: string;
  onClose: () => void;
  onShare: () => void;
  sharing?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const source = { html: html.replace("<head>", `<head>${VIEWPORT_META}`) };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={onClose} hitSlop={10} testID="preview-close">
            <Ionicons name="close" size={26} color={colors.onSurface} />
          </Pressable>
          <AppText variant="semibold" size={fontSize.base}>
            {title}
          </AppText>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.webWrap}>
          {Platform.OS === "web" ? (
            // @ts-expect-error iframe is web-only DOM element
            <iframe title={title} srcDoc={source.html} style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#FFFFFF" }} />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={source}
              style={styles.web}
              backgroundColor="#FFFFFF"
              testID="preview-webview"
              showsVerticalScrollIndicator
            />
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Condividi / Esporta PDF"
            onPress={onShare}
            loading={sharing}
            icon={<Ionicons name="share-outline" size={20} color={colors.onBrandPrimary} />}
            testID="preview-share-button"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
  webWrap: { flex: 1, backgroundColor: "#FFFFFF" },
  web: { flex: 1, backgroundColor: "#FFFFFF" },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
});
