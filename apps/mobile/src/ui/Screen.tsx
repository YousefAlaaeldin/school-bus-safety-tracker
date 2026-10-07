import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = false, testID, style }: Props) {
  return (
    <SafeAreaView testID={testID} style={{ flex: 1, backgroundColor: colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ paddingHorizontal: spacing[4], paddingVertical: spacing[4] }, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: spacing[4] }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
