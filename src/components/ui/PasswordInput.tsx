import { forwardRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';

import EyeIcon from '@/components/icons/EyeIcon';
import { colors } from '@/lib/theme';

import { Input } from './Input';

type Props = Omit<React.ComponentProps<typeof Input>, 'secureTextEntry' | 'right'>;

/**
 * `Input` for a password, with a show/hide toggle.
 *
 * Hidden by default. The toggle is a real button with a state-bearing label
 * ("Show password" / "Hide password"), so a screen reader announces what a tap
 * will do rather than a bare "eye". Works inside a `Sheet` too — it is still
 * `Input` underneath, which picks the sheet-aware field itself.
 */
export const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      ref={ref}
      {...props}
      secureTextEntry={!visible}
      // Autocorrect on a revealed password would "fix" it into a different one.
      autoCorrect={false}
      autoCapitalize="none"
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          className="-mr-1 h-9 w-9 items-center justify-center rounded-full active:bg-surface-muted"
        >
          <EyeIcon color={visible ? colors.brand[500] : colors.text.muted} off={visible} />
        </Pressable>
      }
    />
  );
});
