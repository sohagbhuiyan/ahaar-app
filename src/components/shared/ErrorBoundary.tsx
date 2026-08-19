import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { captureError } from '@/lib/monitoring/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence for render-time crashes.
 *
 * Only catches errors thrown while rendering, in lifecycle methods, or in
 * constructors below it — NOT errors in event handlers, async callbacks or
 * promise rejections. Those are handled where they happen: TanStack Query
 * surfaces them as `isError`, and mutations report through `toast`.
 *
 * Must remain a class: there is still no hook equivalent of
 * `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, { componentStack: info.componentStack });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Text className="text-2xl font-bold text-text-primary">
            Something went wrong
          </Text>
          <Text className="mt-2 text-sm text-text-secondary">
            The app hit an unexpected problem. Reporting it helps us fix it.
          </Text>

          {/* The message is only useful to a developer, so it stays behind the
              dev flag rather than showing a stack trace to a customer. */}
          {__DEV__ ? (
            <View className="mt-4 rounded-2xl bg-danger-soft p-4">
              <Text className="text-xs text-danger">{error.message}</Text>
            </View>
          ) : null}

          <Button label="Try again" className="mt-6" onPress={this.reset} />
        </ScrollView>
      </SafeAreaView>
    );
  }
}
