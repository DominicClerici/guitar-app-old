import { useColors } from "@/lib/theme/ThemeContext"
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native"

type ThemeColors = ReturnType<typeof useColors>

const variantStyles = {
  default: (colors: ThemeColors) => ({
    button: {
      backgroundColor: colors.primary,
    } as ViewStyle,
    text: {
      color: colors.primaryForeground,
    } as TextStyle,
    pressed: {
      backgroundColor: colors.secondary,
    } as ViewStyle,
  }),
  destructive: (colors: ThemeColors) => ({
    button: {
      backgroundColor: colors.destructiveBackground,
    } as ViewStyle,
    text: {
      color: colors.destructiveForeground,
    } as TextStyle,
    pressed: {
      backgroundColor: colors.destructiveBorder,
    } as ViewStyle,
  }),
  outline: (colors: ThemeColors) => ({
    button: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.border,
    } as ViewStyle,
    text: {
      color: colors.foreground,
    } as TextStyle,
    pressed: {
      backgroundColor: colors.accent,
    } as ViewStyle,
  }),
  secondary: (colors: ThemeColors) => ({
    button: {
      backgroundColor: colors.accent,
    } as ViewStyle,
    text: {
      color: colors.foreground,
    } as TextStyle,
    pressed: {
      backgroundColor: colors.accent,
    } as ViewStyle,
  }),
  ghost: (colors: ThemeColors) => ({
    button: {
      backgroundColor: "transparent",
    } as ViewStyle,
    text: {
      color: colors.foreground,
    } as TextStyle,
    pressed: {
      backgroundColor: colors.accent,
    } as ViewStyle,
  }),
  link: (colors: ThemeColors) => ({
    button: {
      backgroundColor: "transparent",
    } as ViewStyle,
    text: {
      color: colors.foreground,
      textDecorationLine: "underline",
    } as TextStyle,
    pressed: {
      backgroundColor: "transparent",
    } as ViewStyle,
  }),
}

const sizeStyles = {
  default: {
    button: {
      height: 40,
      paddingHorizontal: 16,
      paddingVertical: 8,
    } as ViewStyle,
    text: {
      fontSize: 14,
    } as TextStyle,
  },
  sm: {
    button: {
      height: 36,
      paddingHorizontal: 12,
      paddingVertical: 6,
    } as ViewStyle,
    text: {
      fontSize: 13,
    } as TextStyle,
  },
  lg: {
    button: {
      height: 48,
      paddingHorizontal: 24,
      paddingVertical: 12,
    } as ViewStyle,
    text: {
      fontSize: 16,
    } as TextStyle,
  },
  icon: {
    button: {
      height: 40,
      width: 40,
      paddingHorizontal: 0,
      paddingVertical: 0,
    } as ViewStyle,
    text: {
      fontSize: 14,
    } as TextStyle,
  },
  "icon-sm": {
    button: {
      height: 36,
      width: 36,
      paddingHorizontal: 0,
      paddingVertical: 0,
    } as ViewStyle,
    text: {
      fontSize: 13,
    } as TextStyle,
  },
  "icon-lg": {
    button: {
      height: 48,
      width: 48,
      paddingHorizontal: 0,
      paddingVertical: 0,
    } as ViewStyle,
    text: {
      fontSize: 16,
    } as TextStyle,
  },
}

const baseStyles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    gap: 8,
  },
  text: {
    fontWeight: "500",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
})

type ButtonVariant = keyof typeof variantStyles
type ButtonSize = keyof typeof sizeStyles

interface ButtonVariantOptions {
  variant?: ButtonVariant
  size?: ButtonSize
}

interface ButtonVariantStyles {
  button: ViewStyle
  text: TextStyle
  pressed: ViewStyle
}

function buttonVariants(
  colors: ThemeColors,
  options: ButtonVariantOptions = {},
): ButtonVariantStyles {
  const { variant = "default", size = "default" } = options
  const variantStyle = variantStyles[variant](colors)
  const sizeStyle = sizeStyles[size]

  return {
    button: StyleSheet.flatten([baseStyles.button, variantStyle.button, sizeStyle.button]),
    text: StyleSheet.flatten([baseStyles.text, variantStyle.text, sizeStyle.text]),
    pressed: variantStyle.pressed,
  }
}

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  children: React.ReactNode
}

function Button({
  variant = "default",
  size = "default",
  isLoading = false,
  disabled,
  style,
  textStyle,
  children,
  ...props
}: ButtonProps) {
  const colors = useColors()
  const styles = buttonVariants(colors, { variant, size })
  const isDisabled = isLoading || disabled

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        isDisabled && baseStyles.disabled,
        style,
      ]}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={styles.text.color} size="small" />
      ) : typeof children === "string" ? (
        <Text style={[styles.text, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

export { buttonVariants, Button as default }
export type { ButtonSize, ButtonVariant, ButtonVariantOptions, ButtonVariantStyles }
