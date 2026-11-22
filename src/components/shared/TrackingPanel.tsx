import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { toast } from 'sonner-native';

import { Badge, Button, Card, Skeleton } from '@/components/ui';
import type { Tracking, TrackingTimelineStep } from '@/lib/api/types/tracking';
import { formatDate, formatTime } from '@/lib/i18n/format';
import {
  etaLabel,
  hasMap,
  trackingStatusHint,
  trackingStatusLabel,
  trackingStatusTone,
} from '@/lib/tracking/status';
import { cn } from '@/lib/utils';

import { TrackingMap } from './TrackingMap';

interface Props {
  tracking: Tracking | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Shown in the hero while a background refetch is in flight. */
  isFetching?: boolean;
  className?: string;
}

/**
 * Everything the customer wants to know about where their food is, top to
 * bottom: status hero (with ETA and stops ahead), the map, the rider, and the
 * timeline. Each piece renders only when the payload has it, so the same
 * panel serves a bike order and a car route, live or finished.
 *
 * Tracking is an addition to the order screen, not its subject — when it
 * fails it collapses to one quiet line instead of an error page.
 */
export function TrackingPanel({ tracking, isLoading, isError, isFetching, className }: Props) {
  const { t } = useTranslation();

  if (isLoading && !tracking) {
    return (
      <View className={cn('gap-3', className)} testID="tracking-loading">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </View>
    );
  }

  if (!tracking) {
    return isError ? (
      <View className={cn('rounded-2xl bg-surface-muted px-4 py-3', className)}>
        <Text className="text-xs text-text-secondary">{t('tracking.unavailable')}</Text>
      </View>
    ) : null;
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} className={cn('gap-4', className)}>
      <StatusHero tracking={tracking} refreshing={Boolean(isFetching)} />
      {hasMap(tracking) && !tracking.is_final ? <TrackingMap tracking={tracking} /> : null}
      {tracking.rider ? <RiderCard tracking={tracking} /> : null}
      {tracking.timeline.length > 0 ? <Timeline steps={tracking.timeline} /> : null}
    </Animated.View>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

/** Re-render once a minute so "in 7 min" counts down between polls. */
function useMinuteTick(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

export function StatusHero({ tracking, refreshing }: { tracking: Tracking; refreshing: boolean }) {
  const { t } = useTranslation();
  const now = useMinuteTick(Boolean(tracking.route) && !tracking.is_final);
  const label = trackingStatusLabel(tracking.status);
  const hint = trackingStatusHint(tracking.status);
  const eta = tracking.is_final ? null : etaLabel(tracking.route, now);
  const arrival = tracking.route?.eta && !tracking.is_final ? formatTime(tracking.route.eta) : null;
  const km =
    tracking.route?.distance_m != null && !tracking.is_final
      ? (tracking.route.distance_m / 1000).toFixed(1)
      : null;
  const stops = tracking.stops_before;

  return (
    <Card>
      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-bold uppercase tracking-wider text-text-muted">
              {t('tracking.title')}
            </Text>
            <Text accessibilityRole="header" className="mt-1 text-xl font-bold text-text-primary">
              {label}
            </Text>
          </View>
          {tracking.is_live ? (
            <LivePill />
          ) : (
            <Badge label={label} variant={trackingStatusTone(tracking.status)} />
          )}
        </View>

        {hint ? <Text className="mt-1.5 text-sm text-text-secondary">{hint}</Text> : null}

        {eta ? (
          <View className="mt-4 rounded-2xl bg-brand-50 px-4 py-3">
            <Text className="text-base font-bold text-brand-700">{eta}</Text>
            <Text className="mt-0.5 text-xs text-brand-700">
              {[
                arrival ? t('tracking.eta.around', { time: arrival }) : null,
                km ? t('tracking.eta.distance', { km }) : null,
                tracking.route?.source === 'estimate' ? t('tracking.eta.estimated') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}

        {stops !== null && !tracking.is_final ? (
          <View className="mt-3 rounded-2xl bg-surface-muted px-4 py-3">
            <Text className="text-sm font-semibold text-text-primary">
              {stops === 0 ? t('tracking.stops.next') : t('tracking.stops.before', { count: stops })}
            </Text>
          </View>
        ) : null}

        {tracking.failed_reason ? (
          <View className="mt-3 rounded-2xl bg-danger-soft px-4 py-3">
            <Text className="text-xs text-danger">
              {t('tracking.failedReason', { reason: tracking.failed_reason })}
            </Text>
          </View>
        ) : null}

        {refreshing ? (
          <Text className="mt-2 text-[11px] text-text-muted">{t('tracking.updating')}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function LivePill() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1.5 rounded-xl bg-success-soft px-2.5 py-1">
      <View className="h-2 w-2 rounded-full bg-success" />
      <Text className="text-xs font-bold text-success">{t('tracking.live')}</Text>
    </View>
  );
}

// ── Rider ────────────────────────────────────────────────────────────────────

export function RiderCard({ tracking }: { tracking: Tracking }) {
  const { t } = useTranslation();
  const rider = tracking.rider;
  if (!rider) return null;

  const isCar = rider.vehicle_type === 'car';
  const name = rider.name ?? t('tracking.rider.fallbackName');
  const vehicle = [
    rider.vehicle_type ? t(isCar ? 'tracking.rider.car' : 'tracking.rider.bike') : null,
    rider.vehicle_model,
  ]
    .filter(Boolean)
    .join(' · ');

  const call = async () => {
    if (!rider.phone) return;
    const url = `tel:${rider.phone.replace(/[^\d+]/g, '')}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(t('tracking.rider.callFailed'));
    }
  };

  return (
    <Card>
      <View className="flex-row items-center gap-3 p-4">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
          <Text style={{ fontSize: 22 }}>{isCar ? '🚗' : '🛵'}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {t(isCar ? 'tracking.rider.driverTitle' : 'tracking.rider.title')}
          </Text>
          <Text numberOfLines={1} className="text-base font-bold text-text-primary">
            {name}
          </Text>
          {vehicle || rider.plate ? (
            <Text numberOfLines={1} className="mt-0.5 text-xs text-text-secondary">
              {[vehicle || null, rider.plate ? t('tracking.rider.plate', { plate: rider.plate }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
        </View>
        {rider.phone ? (
          <Button
            label={t('tracking.rider.call')}
            accessibilityLabel={t('tracking.rider.callA11y', { name })}
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={call}
          />
        ) : null}
      </View>
    </Card>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function stepTime(at: string | null): string | null {
  if (!at) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? formatTime(date)
    : formatDate(date, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function Timeline({ steps }: { steps: TrackingTimelineStep[] }) {
  const { t } = useTranslation();
  const lastIndex = steps.length - 1;

  return (
    <Card>
      <View className="p-5">
        <Text className="mb-3 text-sm font-bold text-text-primary">{t('tracking.timeline.title')}</Text>
        {steps.map((step, index) => {
          const current = index === lastIndex;
          const tone = trackingStatusTone(step.status);
          const bad = tone === 'danger';
          const time = stepTime(step.at);
          return (
            <View key={`${step.status}-${step.at ?? index}`} className="flex-row gap-3">
              <View className="w-4 items-center">
                <View
                  className={cn(
                    'mt-1 h-3 w-3 rounded-full',
                    bad ? 'bg-danger' : current ? 'bg-brand-500' : 'bg-brand-200',
                  )}
                />
                {index < lastIndex ? <View className="w-0.5 flex-1 bg-brand-100" /> : null}
              </View>
              <View className={cn('flex-1 flex-row justify-between gap-3', index < lastIndex && 'pb-4')}>
                <Text
                  className={cn(
                    'flex-1 text-sm',
                    current ? 'font-bold text-text-primary' : 'text-text-secondary',
                    bad && 'text-danger',
                  )}
                >
                  {trackingStatusLabel(step.status)}
                </Text>
                {time ? <Text className="text-xs text-text-muted">{time}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
