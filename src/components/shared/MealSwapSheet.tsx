import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';

import {
  Badge,
  EmptyState,
  ErrorState,
  InlineError,
  Sheet,
  SkeletonText,
} from '@/components/ui';
import {
  swapError,
  useApplyMealSwap,
  useSwapOptions,
} from '@/lib/query/hooks';
import type { SwapPosition, SwapTarget } from '@/lib/api/types/swap';
import { cn, formatShortDate } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  deliveryId: number;
  subscriptionId: number;
}

/**
 * Swapping a dish on one meal.
 *
 * A swap is an **exchange**, not a replacement — and that is the one thing this
 * sheet has to get across. Choosing "Beef Curry, Tuesday dinner" as the partner
 * for today's salmon does not add beef to today: the two trade places, so
 * Tuesday's dinner gets the salmon. The prompt and the confirmation both say so
 * in as many words, because a customer who reads it as "replace" will be
 * surprised by their Tuesday.
 *
 * Everything offered comes from the customer's own week. The server decides what
 * is eligible and why; this renders those decisions, ineligible targets
 * included, so "already swapped" is visible rather than mysterious.
 */
export function MealSwapSheet({ open, onClose, deliveryId, subscriptionId }: Props) {
  const { data: options, isLoading, isError, error, refetch } = useSwapOptions(
    open ? deliveryId : undefined,
  );
  const applySwap = useApplyMealSwap(subscriptionId);

  /** The dish currently being given a partner. */
  const [openItemId, setOpenItemId] = useState<number | null>(null);

  const handleClose = () => {
    setOpenItemId(null);
    applySwap.reset();
    onClose();
  };

  const swap = (from: SwapPosition, to: SwapTarget) => {
    applySwap.mutate(
      { from_item_id: from.item_id, to_item_id: to.item_id },
      {
        onSuccess: () => {
          setOpenItemId(null);
          onClose();
          toast.success(
            `Swapped — ${to.name} today, and ${from.name} on ${formatShortDate(to.delivery_date)}.`,
          );
        },
        onError: (e) => toast.error(swapError(e).message),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Swap a dish"
      description="Trade a dish with another meal in the same week of your plan. Both meals change."
    >
      {isLoading ? (
        <SkeletonText lines={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !options ? null : !options.before_cutoff ? (
        <View className="rounded-2xl bg-surface-muted px-4 py-3">
          <Text className="text-xs text-text-secondary">
            This meal is past its cutoff, so it can no longer be changed.
          </Text>
        </View>
      ) : options.positions.length === 0 ? (
        <EmptyState
          title="Nothing to swap"
          description="No dish on this meal can be traded."
        />
      ) : (
        <View className="gap-4 pb-2">
          {applySwap.isError ? <InlineError error={applySwap.error} /> : null}

          {options.positions.map((position) => (
            <PositionRow
              key={position.item_id}
              position={position}
              expanded={openItemId === position.item_id}
              busy={applySwap.isPending}
              onToggle={() =>
                setOpenItemId((current) =>
                  current === position.item_id ? null : position.item_id,
                )
              }
              onPick={(target) => swap(position, target)}
            />
          ))}
        </View>
      )}
    </Sheet>
  );
}

function PositionRow({
  position,
  expanded,
  busy,
  onToggle,
  onPick,
}: {
  position: SwapPosition;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onPick: (target: SwapTarget) => void;
}) {
  const eligible = position.targets.filter((t) => t.eligible);
  const blocked = position.targets.filter((t) => !t.eligible);

  // A dish with nowhere to go is not an error — the rest of the week may simply
  // serve the same thing. Say which it is rather than showing a dead row.
  const nothingToTrade = position.can_swap && eligible.length === 0;
  const selectable = position.can_swap && !nothingToTrade;

  return (
    <View className="rounded-2xl border border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Swap ${position.name ?? 'this dish'}`}
        accessibilityState={{ expanded, disabled: !selectable }}
        disabled={!selectable}
        onPress={onToggle}
        className={cn(
          'flex-row items-center justify-between gap-3 px-4 py-3',
          selectable && 'active:opacity-70',
        )}
      >
        <View className="flex-1">
          <Text className="text-[11px] uppercase tracking-wide text-text-muted">
            {position.category_name}
          </Text>
          <Text className="text-sm font-bold text-text-primary">
            {position.quantity > 1 ? `${position.quantity} × ` : ''}
            {position.name}
          </Text>
        </View>

        {selectable ? (
          <Text className="text-xs font-semibold text-brand-500">
            {expanded ? 'Cancel' : 'Swap'}
          </Text>
        ) : (
          <Badge
            label={nothingToTrade ? 'Nothing to trade' : (position.blocked_message ?? 'Locked')}
            variant="muted"
          />
        )}
      </Pressable>

      {expanded ? (
        <View className="gap-2 border-t border-border px-4 py-3">
          <Text className="text-xs text-text-muted">
            Pick the meal to trade with. {position.name} moves there, and its dish
            comes here.
          </Text>

          {eligible.map((target) => (
            <Pressable
              key={target.item_id}
              accessibilityRole="button"
              accessibilityLabel={`Trade for ${target.name} on ${formatShortDate(target.delivery_date)}`}
              disabled={busy}
              onPress={() => onPick(target)}
              className={cn(
                'rounded-xl border border-border px-3 py-2.5 active:opacity-70',
                busy && 'opacity-50',
              )}
            >
              <Text className="text-sm font-semibold text-text-primary">
                {target.quantity > 1 ? `${target.quantity} × ` : ''}
                {target.name}
              </Text>
              <Text className="mt-0.5 text-xs text-text-muted">
                {formatShortDate(target.delivery_date)} · {target.slot_name}
              </Text>
            </Pressable>
          ))}

          {blocked.length > 0 ? (
            <View className="mt-1 gap-1">
              <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Can&apos;t trade with
              </Text>
              {blocked.map((target) => (
                <Text key={target.item_id} className="text-[11px] text-text-muted">
                  {target.name} · {formatShortDate(target.delivery_date)}{' '}
                  {target.slot_name} — {target.message}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
