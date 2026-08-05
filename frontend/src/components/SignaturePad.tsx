import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import SignatureScreen, { SignatureViewRef } from "react-native-signature-canvas";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/src/components/ui";
import { colors, fontSize, spacing, radius } from "@/src/theme";

export type SignaturePadRef = { read: () => void; clear: () => void };

export const SignaturePad = forwardRef<
  SignaturePadRef,
  { onOK: (base64: string) => void; onEmpty: () => void }
>(({ onOK, onEmpty }, ref) => {
  const sigRef = useRef<SignatureViewRef>(null);

  useImperativeHandle(ref, () => ({
    read: () => sigRef.current?.readSignature(),
    clear: () => sigRef.current?.clearSignature(),
  }));

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; margin: 0; }
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body,html { width: 100%; height: 100%; margin: 0; }
    canvas { background-color: #FFFFFF; }
  `;

  return (
    <View style={styles.wrap}>
      <View style={styles.canvasBox}>
        <SignatureScreen
          ref={sigRef}
          onOK={onOK}
          onEmpty={onEmpty}
          webStyle={webStyle}
          backgroundColor="#FFFFFF"
          penColor="#111412"
          autoClear={false}
          descriptionText=""
        />
      </View>
      <Pressable style={styles.clearBtn} onPress={() => sigRef.current?.clearSignature()} testID="signature-clear">
        <Ionicons name="refresh" size={16} color={colors.muted} />
        <AppText variant="medium" size={fontSize.base} color={colors.muted}>
          Cancella firma
        </AppText>
      </Pressable>
    </View>
  );
});

SignaturePad.displayName = "SignaturePad";

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  canvasBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
});
