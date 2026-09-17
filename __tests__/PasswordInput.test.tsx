import { fireEvent, render, screen } from '@testing-library/react-native';

import { PasswordInput } from '@/components/ui';

describe('PasswordInput', () => {
  it('hides the password until "Show password" is pressed, and hides it again', async () => {
    await render(<PasswordInput label="Password" value="secret" onChangeText={() => {}} />);

    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
  });
});
