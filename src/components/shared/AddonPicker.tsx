import { Pressable, Text, View } from 'react-native';

import { Badge, Button, Separator } from '@/components/ui';
import type { MenuItem } from '@/lib/api/types/catalog';
import type { DeliveryItem } from '@/lib/api/types/subscription';
import { cn, formatMoney } from '@/lib/utils';

import { FoodImage } from './FoodImage';

export interface AddonSelection {
  menu_item_id: number;
  quantity: number;
}

interface Props {
  /** Opt-in add-ons the customer may add — the catalogue's `is_addon` items. */
  available: MenuItem[];
  /** What is already on this delivery, for the "Included" sections. */
  deliveryItems: DeliveryItem[];
  selected: AddonSelection[];
  onAdd: (item: MenuItem) => void;
  onRemove: (menuItemId: number) => void;
  /** Removing a default add-on needs an endpoint that doesn't exist yet. */
  canRemoveDefaults?: boolean;
  /** Past cutoff — everything becomes read-only. */
  locked?: boolean;
  className?: string;
}

/**
 * The three things that can be on a delivery, kept visually distinct.
 *
 *   1. Default menu items  → "Included"                — the plan's meal
 *   2. Default add-ons     → "Included — tap to remove" — auto-added, opt-out
 *   3. Opt-in add-ons      → "Add · Free" / "Add · {price}"
 *
 * Customers get confused when automatic and optional look alike, so each
 * section is labelled and the price treatment differs. Free vs paid is driven
 * by `MenuItem.is_free` and never inferred from a zero price — until the
 * backend ships that flag it is `undefined`, and an item is treated as paid.
 */
export function AddonPicker({
  available,
  deliveryItems,
  selected,
  onAdd,
  onRemove,
  canRemoveDefaults = false,
  locked = false,
  className,
}: Props) {
  const defaultMeals = deliveryItems.filter((i) => !i.is_addon);
  const defaultAddons = deliveryItems.filter((i) => i.is_addon && i.is_default);

  const quantityFor = (id: number) =>
    selected.find((s) => s.menu_item_id === id)?.quantity ?? 0;

  return (
    <View className={cn('gap-6', className)}>
      {/* 1 — the plan's meal for this day */}
      {defaultMeals.length > 0 ? (
        <View className="gap-2">
          <SectionLabel title="Included" caption="Your plan's meal for this day" />
          {defaultMeals.map((item) => (
            <RowShell key={item.id}>
              <Thumb uri={item.menu_item?.image_url} />
              <Text className="flex-1 text-sm font-semibold text-text-primary">
                {item.menu_item?.name ?? `Item #${item.id}`}
              </Text>
              <Badge label="Included" variant="muted" />
            </RowShell>
          ))}
        </View>
      ) : null}

      {/* 2 — add-ons that come automatically but may be dropped */}
      {defaultAddons.length > 0 ? (
        <View className="gap-2">
          <SectionLabel
            title="Included extras"
            caption={
              canRemoveDefaults
                ? 'Added automatically — tap to remove'
                : 'Added automatically with your plan'
            }
          />
          {defaultAddons.map((item) => (
            <RowShell key={item.id}>
              <Thumb uri={item.menu_item?.image_url} />
              <Text className="flex-1 text-sm font-semibold text-text-primary">
                {item.menu_item?.name ?? `Item #${item.id}`}
              </Text>

              {canRemoveDefaults && !locked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.menu_item?.name ?? 'item'}`}
                  onPress={() => onRemove(item.menu_item?.id ?? 0)}
                  className="rounded-xl bg-surface-muted px-3 py-1.5 active:opacity-70"
                >
                  <Text className="text-xs font-bold text-text-secondary">Remove</Text>
                </Pressable>
              ) : (
                <Badge label="Included" variant="free" />
              )}
            </RowShell>
          ))}
        </View>
      ) : null}

      {/* 3 — opt-in */}
      {available.length > 0 ? (
        <View className="gap-2">
          <SectionLabel title="Add extras" caption="Optional — not included by default" />

          {available.map((item, index) => {
            const quantity = quantityFor(item.id);
            const isFree = item.is_free === true;

            return (
              <View key={item.id}>
                {index > 0 ? <Separator className="my-1" /> : null}

                <RowShell>
                  <Thumb uri={item.image_url} />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-primary">
                      {item.name}
                    </Text>
                    <Text
                      className={cn(
                        'mt-0.5 text-xs font-bold',
                        isFree ? 'text-success' : 'text-brand-500',
                      )}
                    >
                      {isFree ? 'Free' : formatMoney(item.base_price)}
                    </Text>
                  </View>

                  {quantity > 0 ? (
                    <Button
                      label={`Added (${quantity})`}
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      disabled={locked}
                      onPress={() => onRemove(item.id)}
                    />
                  ) : (
                    <Button
                      label={isFree ? 'Add · Free' : 'Add'}
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      disabled={locked}
                      onPress={() => onAdd(item)}
                    />
                  )}
                </RowShell>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function SectionLabel({ title, caption }: { title: string; caption: string }) {
  return (
    <View className="mb-1">
      <Text className="text-sm font-bold text-text-primary">{title}</Text>
      <Text className="text-xs text-text-muted">{caption}</Text>
    </View>
  );
}

function RowShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-muted py-2 pl-2 pr-4">
      {children}
    </View>
  );
}

/** The dish's picture at row size — the same one it has on the menu. */
function Thumb({ uri }: { uri: string | null | undefined }) {
  return <FoodImage uri={uri} glyphSize="sm" className="h-10 w-10 rounded-xl" />;
}
