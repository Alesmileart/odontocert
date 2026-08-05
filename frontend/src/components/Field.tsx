import React from "react";
import { View, TextInput, StyleSheet, TextInputProps } from "react-native";
import { AppText } from "@/src/components/ui";
import { colors, fonts, fontSize, radius, spacing } from "@/src/theme";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  mono,
  multiline,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  testID,
  rightSlot,
  ...rest
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  mono?: boolean;
  multiline?: boolean;
  testID?: string;
  rightSlot?: React.ReactNode;
} & TextInputProps) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="medium" size={fontSize.sm} color={colors.onSurfaceSecondary} style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.inputWrap, error ? styles.inputError : null, multiline ? styles.multiWrap : null]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          style={[
            styles.input,
            multiline ? styles.multiInput : null,
            { fontFamily: mono ? fonts.mono : fonts.regular },
          ]}
          {...rest}
        />
        {rightSlot}
      </View>
      {error ? (
        <AppText size={fontSize.sm} color={colors.error} style={styles.errorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  multiWrap: { alignItems: "flex-start" },
  inputError: { borderColor: colors.error },
  input: {
    flex: 1,
    height: 50,
    fontSize: fontSize.lg,
    color: colors.onSurface,
  },
  multiInput: { height: 100, textAlignVertical: "top", paddingTop: spacing.md },
  errorText: { marginTop: spacing.xs },
});
