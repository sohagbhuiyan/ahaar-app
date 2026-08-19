import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';

import { Button, InlineError, Input, Sheet } from '@/components/ui';
import type { Address } from '@/lib/api/types/catalog';
import { isApiError } from '@/lib/api/types/common';
import { useCreateAddress, useUpdateAddress } from '@/lib/query/hooks';

/**
 * Mirrors `StoreAddressRequest`. `postal_code` and `city` are `required` there
 * even though `label`, `line2` and `country` are not — validating that here
 * turns a 422 into an inline message before the request is ever sent.
 */
const schema = z.object({
  label: z.string().max(60).optional().or(z.literal('')),
  line1: z.string().min(1, 'Street and number are required').max(190),
  line2: z.string().max(190).optional().or(z.literal('')),
  postal_code: z.string().min(1, 'Postcode is required').max(16),
  city: z.string().min(1, 'City is required').max(120),
  // `size:2` server-side — an ISO-3166 alpha-2 code, not a country name.
  country: z
    .string()
    .length(2, 'Use a 2-letter country code')
    .optional()
    .or(z.literal('')),
  instructions: z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Editing an existing address, or undefined to create a new one. */
  address?: Address | null;
  /** Fires with the saved address — used to select it straight after adding. */
  onSaved?: (address: Address) => void;
}

const BLANK: FormValues = {
  label: '',
  line1: '',
  line2: '',
  postal_code: '',
  city: '',
  country: '',
  instructions: '',
};

/** Empty optional strings become `undefined` so Laravel's `nullable` applies. */
function toPayload(values: FormValues) {
  return {
    label: values.label || undefined,
    line1: values.line1,
    line2: values.line2 || undefined,
    postal_code: values.postal_code,
    city: values.city,
    country: values.country ? values.country.toUpperCase() : undefined,
    instructions: values.instructions || undefined,
  };
}

/** Create or edit a delivery address, without leaving the screen that needs it. */
export function AddressFormSheet({ open, onClose, address, onSaved }: Props) {
  const isEdit = Boolean(address);

  const create = useCreateAddress();
  const update = useUpdateAddress();
  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: BLANK,
  });

  // Seed on open rather than on mount: the sheet stays mounted between edits,
  // so a stale form would show the previously-edited address.
  useEffect(() => {
    if (!open) return;

    reset(
      address
        ? {
            label: address.label ?? '',
            line1: address.line1 ?? '',
            line2: address.line2 ?? '',
            postal_code: address.postal_code ?? '',
            city: address.city ?? '',
            country: address.country ?? '',
            instructions: address.instructions ?? '',
          }
        : BLANK,
    );
    create.reset();
    update.reset();
    // Mutation `reset` fns are stable; depending on the objects would re-seed
    // the form on every mutation state change and wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address, reset]);

  const onSubmit = (values: FormValues) => {
    if (pending) return;
    const payload = toPayload(values);

    const done = (saved: Address) => {
      toast.success(isEdit ? 'Address updated' : 'Address saved');
      onSaved?.(saved);
      onClose();
    };
    const fail = (e: unknown) =>
      toast.error(isApiError(e) ? e.message : 'Could not save that address');

    if (address) {
      update.mutate({ id: address.id, payload }, { onSuccess: done, onError: fail });
    } else {
      create.mutate(payload, { onSuccess: done, onError: fail });
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit address' : 'Add an address'}
      description="Where should we deliver?"
      footer={
        <Button
          label={isEdit ? 'Save changes' : 'Save address'}
          size="lg"
          loading={pending}
          onPress={handleSubmit(onSubmit)}
        />
      }
    >
      {error ? <InlineError error={error} className="mb-4" /> : null}

      <View className="gap-4 pb-2">
        <Field
          control={control}
          name="label"
          label="Label"
          hint="Optional — “Home”, “Office”"
        />
        <Field control={control} name="line1" label="Street and number" />
        <Field control={control} name="line2" label="Apartment, floor" hint="Optional" />

        <View className="flex-row gap-3">
          <Field
            control={control}
            name="postal_code"
            label="Postcode"
            containerClassName="flex-1"
          />
          <Field
            control={control}
            name="city"
            label="City"
            containerClassName="flex-[2]"
          />
        </View>

        <Field
          control={control}
          name="country"
          label="Country code"
          hint="Two letters, e.g. NL"
          autoCapitalize="characters"
          maxLength={2}
        />
        <Field
          control={control}
          name="instructions"
          label="Delivery notes"
          hint="Optional — gate code, where to leave it"
          multiline
        />

        <Text className="text-xs text-text-muted">
          Your first saved address becomes the default automatically.
        </Text>
      </View>
    </Sheet>
  );
}

/** Thin `Controller` + `Input` pairing — every field on this form is the same. */
function Field({
  control,
  name,
  label,
  hint,
  containerClassName,
  ...inputProps
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: keyof FormValues;
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
