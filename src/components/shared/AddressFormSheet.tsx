import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import PinIcon from '@/components/icons/PinIcon';
import { Button, InlineError, Input, Sheet } from '@/components/ui';
import type { Address } from '@/lib/api/types/catalog';
import { isApiError } from '@/lib/api/types/common';
import type { AddressDraft } from '@/lib/location/address';
import {
  ADDITIONAL_NUMBER_PATTERN,
  COUNTRIES,
  DEFAULT_COUNTRY,
  SHORT_ADDRESS_PATTERN,
  SUPPORTED_COUNTRIES,
  canonicalCity,
  cleanDistrict,
  composeStreetLine,
  countryRules,
  isSupportedCountry,
  normalizeBuilding,
  normalizeNumber,
  normalizeShortAddress,
  splitStreetLine,
} from '@/lib/location/countries';
import { useDeviceLocation } from '@/lib/location/useDeviceLocation';
import { useCreateAddress, useUpdateAddress } from '@/lib/query/hooks';
import { draftToPayload } from '@/lib/query/hooks/useLocation';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { CurrentPositionRow } from './CurrentPositionRow';

/**
 * One schema for every country: the fields are plain strings, and the rules —
 * required district and street, the shape of the building number and postal
 * code, the Saudi-only codes — are applied for the country the form is in.
 * All checks run together, so every problem shows at once.
 */
const schema = z
  .object({
    country: z.string(),
    label: z.string().max(60).optional(),
    city: z.string(),
    area: z.string().optional(),
    street: z.string().optional(),
    building_number: z.string().optional(),
    line2: z.string().max(190).optional(),
    postal_code: z.string().optional(),
    additional_number: z.string().optional(),
    short_address: z.string().optional(),
    instructions: z.string().max(500).optional(),
  })
  .superRefine((values, ctx) => {
    const rules = countryRules(values.country);
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const filled = (value?: string) => Boolean(value?.trim());

    if (!filled(values.city)) issue('city', 'City is required');
    if (!filled(values.area)) issue('area', rules.messages.area);
    if (!filled(values.street)) issue('street', rules.messages.street);
    if (
      filled(values.building_number) &&
      !rules.buildingPattern.test(normalizeBuilding(values.country, values.building_number))
    ) {
      issue('building_number', rules.messages.building);
    }
    if (filled(values.postal_code) && !rules.postalPattern.test(normalizeNumber(values.postal_code))) {
      issue('postal_code', rules.messages.postal);
    }
    if (rules.nationalAddress) {
      if (
        filled(values.additional_number) &&
        !ADDITIONAL_NUMBER_PATTERN.test(normalizeNumber(values.additional_number))
      ) {
        issue('additional_number', 'Additional number is 4 digits');
      }
      if (
        filled(values.short_address) &&
        !SHORT_ADDRESS_PATTERN.test(normalizeShortAddress(values.short_address))
      ) {
        issue('short_address', '4 letters and 4 digits, e.g. RRRD2929');
      }
    }
  });

type FormValues = z.infer<typeof schema>;

type Pin = { lat: number; lng: number };
type Source = Address | AddressDraft | null;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Editing an existing address, or undefined to create a new one. */
  address?: Address | null;
  /** Fires with the saved address — used to select it straight after adding. */
  onSaved?: (address: Address) => void;
  /** Prefill for a new address — the place picked on the map, or a device-kept location. */
  initialDraft?: AddressDraft | null;
  /**
   * Replaces saving to the address book. The location flow decides what
   * "save" means — reuse a matching address, create one, or keep it on the
   * device for a signed-out visitor. Throw to keep the sheet open; the caller
   * closes it on success.
   */
  onSubmitDraft?: (draft: AddressDraft) => Promise<void>;
  title?: string;
  description?: string;
  submitLabel?: string;
  /** A note above the fields, e.g. "we couldn't look up the street". */
  notice?: string | null;
}

const BLANK: FormValues = {
  country: DEFAULT_COUNTRY,
  label: '',
  city: '',
  area: '',
  street: '',
  building_number: '',
  line2: '',
  postal_code: '',
  additional_number: '',
  short_address: '',
  instructions: '',
};

const LABEL_PRESETS = ['Home', 'Work', 'Family'] as const;

function toValues(source: Source): FormValues {
  if (!source) return BLANK;
  const country = isSupportedCountry(source.country) ? source.country.toUpperCase() : DEFAULT_COUNTRY;
  const { building_number, street } = splitStreetLine(country, source.line1, source.building_number);
  return {
    country,
    label: source.label ?? '',
    city: source.city ?? '',
    area: source.area ?? '',
    street,
    building_number,
    line2: source.line2 ?? '',
    postal_code: source.postal_code ?? '',
    additional_number: source.additional_number ?? '',
    short_address: source.short_address ?? '',
    instructions: source.instructions ?? '',
  };
}

/** Typed values → a clean draft: Latin digits, one city spelling, the country's own street line. */
function toDraft(values: FormValues, opened: Source, pin: Pin | null): AddressDraft {
  const text = (value?: string) => value?.trim() || null;
  const country = values.country;
  const rules = countryRules(country);
  const building = normalizeBuilding(country, values.building_number) || null;

  return {
    label: text(values.label),
    line1: composeStreetLine(country, building, values.street),
    line2: text(values.line2),
    area: cleanDistrict(values.area),
    city: canonicalCity(values.city),
    region: opened?.region ?? null,
    postal_code: normalizeNumber(values.postal_code) || null,
    country,
    building_number: building,
    additional_number: rules.nationalAddress ? normalizeNumber(values.additional_number) || null : null,
    short_address: rules.nationalAddress ? normalizeShortAddress(values.short_address) || null : null,
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
    location_source: opened?.location_source ?? (pin ? 'map' : 'manual'),
    instructions: text(values.instructions),
  };
}

/**
 * An edit sends cleared optional fields as `null` so they actually clear —
 * `draftToPayload` omits them, which on a PATCH means "leave as it was". The
 * saved pin, and how it was chosen, are left alone.
 */
function toUpdatePayload(draft: AddressDraft) {
  const payload = draftToPayload(draft);
  delete payload.lat;
  delete payload.lng;
  delete payload.location_source;
  return {
    ...payload,
    label: draft.label,
    line2: draft.line2,
    postal_code: draft.postal_code,
    building_number: draft.building_number,
    additional_number: draft.additional_number,
    short_address: draft.short_address,
    instructions: draft.instructions,
  };
}

/** Create or edit a delivery address, written the way its country writes addresses. */
export function AddressFormSheet({
  open,
  onClose,
  address,
  onSaved,
  initialDraft,
  onSubmitDraft,
  title,
  description,
  submitLabel,
  notice,
}: Props) {
  const isEdit = Boolean(address);

  const create = useCreateAddress();
  const update = useUpdateAddress();
  // The location flow's own save, run as a mutation so its pending and error
  // state reset alongside the other two when the sheet reopens.
  const submitDraft = useMutation({
    mutationFn: (draft: AddressDraft) =>
      onSubmitDraft ? onSubmitDraft(draft) : Promise.resolve(),
  });

  // "Use my current location" pressed inside this sheet. Wins over the draft
  // the sheet was opened with, and is cleared whenever the sheet closes.
  const [located, setLocated] = useState<{ draft: AddressDraft; notice: string | null } | null>(
    null,
  );
  const device = useDeviceLocation();

  // Coordinates travel with the address but aren't typed, so they are read from
  // what the form was opened with (or just located) rather than held in it.
  const opened: Source = address ?? located?.draft ?? initialDraft ?? null;
  const pin: Pin | null =
    opened && opened.lat !== null && opened.lng !== null
      ? { lat: opened.lat, lng: opened.lng }
      : null;

  const pending = create.isPending || update.isPending || submitDraft.isPending;
  const error = submitDraft.error ?? create.error ?? update.error;

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: BLANK,
  });

  const country = useWatch({ control, name: 'country' }) ?? DEFAULT_COUNTRY;
  const rules = countryRules(country);

  // Seed on open rather than on mount: the sheet stays mounted between edits,
  // so a stale form would show the previously-edited address.
  useEffect(() => {
    if (!open) return;

    reset(toValues(address ?? initialDraft ?? null));
    create.reset();
    update.reset();
    submitDraft.reset();
    // Mutation `reset` fns are stable; depending on the objects would re-seed
    // the form on every mutation state change and wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, initialDraft, reset]);

  const close = () => {
    setLocated(null);
    device.reset();
    onClose();
  };

  // A full reset, not a merge: pressing the button says "this is where I am",
  // and half-replacing the fields would pair one place's street with another's city.
  const locateMe = async () => {
    const result = await device.locate();
    if (result?.status === 'resolved' && result.draft) {
      setLocated({ draft: result.draft, notice: result.message });
      reset(toValues(result.draft));
    }
  };

  const turnOnLocation = async () => {
    if (await device.enableServices()) await locateMe();
  };

  // Only a plain "add an address" offers GPS here. Editing keeps the saved
  // pin, and the location flow chose its place on the map already.
  const offerGps = !isEdit && !onSubmitDraft;
  const shownNotice = located?.notice ?? notice;

  const fail = (e: unknown) =>
    toast.error(isApiError(e) ? e.message : 'Could not save that address');

  const onSubmit = (values: FormValues) => {
    if (pending) return;

    if (onSubmitDraft) {
      submitDraft.mutate(toDraft(values, opened, pin), { onError: fail });
      return;
    }

    const done = (saved: Address) => {
      toast.success(isEdit ? 'Address updated' : 'Address saved');
      onSaved?.(saved);
      close();
    };

    if (address) {
      update.mutate(
        { id: address.id, payload: toUpdatePayload(toDraft(values, opened, null)) },
        { onSuccess: done, onError: fail },
      );
    } else {
      create.mutate(draftToPayload(toDraft(values, opened, pin)), {
        onSuccess: done,
        onError: fail,
      });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title ?? (isEdit ? 'Edit address' : 'Add an address')}
      description={description ?? 'Where should we deliver?'}
      footer={
        <Button
          label={submitLabel ?? (isEdit ? 'Save changes' : 'Save address')}
          size="lg"
          loading={pending}
          onPress={handleSubmit(onSubmit)}
        />
      }
    >
      {error ? <InlineError error={error} className="mb-4" /> : null}

      {offerGps ? (
        <View className="mb-4">
          <CurrentPositionRow
            device={device}
            onLocate={locateMe}
            onTurnOn={turnOnLocation}
            hint="Fill in the fields below automatically"
          />
        </View>
      ) : null}

      {pin && !isEdit ? (
        <View
          testID="address-pinned"
          className="mb-4 flex-row items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2.5"
        >
          <PinIcon color={colors.brand[500]} size={16} filled />
          <Text className="flex-1 text-xs text-brand-700">
            Pinned on the map — add the {rules.labels.building.toLowerCase()} and flat so the rider
            finds the door.
          </Text>
        </View>
      ) : null}

      {shownNotice ? (
        <View className="mb-4 rounded-2xl bg-warning-soft px-3 py-2.5">
          <Text className="text-xs text-text-primary">{shownNotice}</Text>
        </View>
      ) : null}

      <View className="gap-4 pb-2">
        {/* The country comes from the pin. Only an address typed without one
            asks, and only among the countries Ahaar serves. */}
        <Controller
          control={control}
          name="country"
          render={({ field: { onChange, value } }) => (
            <View className="gap-2">
              <Text className="text-sm font-semibold text-text-primary">Country</Text>
              {pin ? (
                <View
                  testID="address-country"
                  className="flex-row items-center gap-1.5 self-start rounded-xl bg-surface-muted px-3 py-1.5"
                >
                  <Text className="text-xs font-bold text-text-primary">
                    {countryRules(value).flag} {countryRules(value).name}
                  </Text>
                  <Text className="text-xs text-text-muted">· from the map pin</Text>
                </View>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {SUPPORTED_COUNTRIES.map((code) => {
                    const active = value === code;
                    return (
                      <Pressable
                        key={code}
                        accessibilityRole="radio"
                        accessibilityLabel={COUNTRIES[code].name}
                        accessibilityState={{ selected: active }}
                        onPress={() => onChange(code)}
                        className={cn(
                          'rounded-xl border px-3 py-1.5',
                          active ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
                        )}
                      >
                        <Text
                          className={cn(
                            'text-xs font-bold',
                            active ? 'text-brand-700' : 'text-text-secondary',
                          )}
                        >
                          {COUNTRIES[code].flag} {COUNTRIES[code].name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        />

        <Field control={control} name="city" label={rules.labels.city} hint={rules.labels.cityHint} />
        <Field control={control} name="area" label={rules.labels.area} hint={rules.labels.areaHint} />
        <Field
          control={control}
          name="street"
          label={rules.labels.street}
          hint={rules.labels.streetHint}
        />

        <View className="flex-row gap-3">
          <Field
            control={control}
            name="building_number"
            label={rules.labels.building}
            hint={rules.labels.buildingHint}
            keyboardType={rules.nationalAddress ? 'number-pad' : 'default'}
            maxLength={rules.nationalAddress ? 4 : 20}
            containerClassName="flex-1"
          />
          <Field
            control={control}
            name="line2"
            label={rules.labels.unit}
            hint="Optional"
            containerClassName="flex-1"
          />
        </View>

        {rules.nationalAddress ? (
          <View testID="national-address" className="rounded-2xl border border-border px-4 py-3">
            <Text className="text-sm font-bold text-text-primary">National Address</Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              Optional — from your Saudi Post (SPL) National Address, shown in the SPL app or
              Absher. It helps riders find you faster.
            </Text>

            <View className="mt-3 gap-4">
              <View className="flex-row gap-3">
                <Field
                  control={control}
                  name="postal_code"
                  label={rules.labels.postal}
                  hint={rules.labels.postalHint}
                  keyboardType="number-pad"
                  maxLength={5}
                  containerClassName="flex-1"
                />
                <Field
                  control={control}
                  name="additional_number"
                  label="Additional no."
                  hint="4 digits"
                  keyboardType="number-pad"
                  maxLength={4}
                  containerClassName="flex-1"
                />
              </View>
              <Field
                control={control}
                name="short_address"
                label="Short address"
                hint="e.g. RRRD2929"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={9}
              />
            </View>
          </View>
        ) : (
          <Field
            control={control}
            name="postal_code"
            label={rules.labels.postal}
            hint={`Optional — ${rules.labels.postalHint}`}
            keyboardType="number-pad"
            maxLength={4}
          />
        )}

        <Field
          control={control}
          name="instructions"
          label="Delivery notes"
          hint="Optional — gate, landmark, where to leave it"
          multiline
        />

        <LabelField control={control} />

        {onSubmitDraft ? null : (
          <Text className="text-xs text-text-muted">
            Your first saved address becomes your delivery location automatically.
          </Text>
        )}
      </View>
    </Sheet>
  );
}

type FormControl = ReturnType<typeof useForm<FormValues>>['control'];

/** Thin `Controller` + `Input` pairing — every text field on this form is the same. */
function Field({
  control,
  name,
  label,
  hint,
  containerClassName,
  ...inputProps
}: {
  control: FormControl;
  name: Exclude<keyof FormValues, 'country'>;
  label: string;
  hint?: string;
  containerClassName?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState }) => (
        <Input
          label={label}
          hint={hint}
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={fieldState.error?.message}
          containerClassName={containerClassName}
          {...inputProps}
        />
      )}
    />
  );
}

/** Home / Work / Family in one tap, or a label of the customer's own. */
function LabelField({ control }: { control: FormControl }) {
  return (
    <Controller
      control={control}
      name="label"
      render={({ field: { onChange, onBlur, value }, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">Save as</Text>
          <View className="flex-row flex-wrap gap-2">
            {LABEL_PRESETS.map((preset) => {
              const active = (value ?? '').trim().toLowerCase() === preset.toLowerCase();
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChange(active ? '' : preset)}
                  className={cn(
                    'rounded-xl border px-3 py-1.5',
                    active ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
                  )}
                >
                  <Text
                    className={cn(
                      'text-xs font-bold',
                      active ? 'text-brand-700' : 'text-text-secondary',
                    )}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            label="Label"
            hint="Optional — or type your own"
            value={value ?? ''}
            onChangeText={onChange}
            onBlur={onBlur}
            error={fieldState.error?.message}
          />
        </View>
      )}
    />
  );
}
