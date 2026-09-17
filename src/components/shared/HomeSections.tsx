import { useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import type {
  CtaContent,
  FaqContent,
  HeadingContent,
  TestimonialsContent,
} from '@/lib/api/types/home';
import {
  cmsHeading,
  cmsText,
  openCmsLink,
  resolveCmsImage,
  resolveCmsLink,
} from '@/lib/cms';
import {
  DELIVERY_CITIES,
  FAQS,
  HOW_IT_WORKS,
  TESTIMONIALS,
  WHY_AHAAR,
} from '@/lib/constants/marketing';
import { cn } from '@/lib/utils';

/**
 * The evergreen half of Home, one component per CMS section.
 *
 * Each takes its section's `content` from `GET /home?platform=app` and falls
 * back field by field to the copy this app shipped with, so a section renders
 * complete whether the CMS is filled in, half-empty or unreachable. The steps
 * and feature tiles are part of the layout and stay shipped; the headings, the
 * testimonials and the FAQ are the admin's.
 *
 * Home decides which of these appear, and in what order, from the admin's app
 * layout.
 */

// ── How it works ─────────────────────────────────────────────────────────────

export function HowItWorksSection({
  content,
  className,
}: {
  content?: HeadingContent | null;
  className?: string;
}) {
  const copy = cmsHeading(content, {
    eyebrow: 'How it works',
    title: 'Great meals in four simple steps',
    subtitle: 'From subscription to your table — no planning, no shopping, no cleanup.',
  });

  return (
    <View className={className}>
      <SectionHeading {...copy} />

      <View className="gap-3 px-5">
        {HOW_IT_WORKS.map((step, index) => (
          <View key={step.n} className="flex-row gap-3">
            {/* A rail rather than four disconnected cards: the steps are a
                sequence, and the line is what says so. */}
            <View className="items-center">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
                <Text className="text-xs font-bold text-text-inverse">{step.n}</Text>
              </View>
              {index < HOW_IT_WORKS.length - 1 ? (
                <View className="w-px flex-1 bg-border" />
              ) : null}
            </View>

            <View className="flex-1 pb-4">
              <Text className="text-sm font-bold text-text-primary">{step.title}</Text>
              <Text className="mt-1 text-xs leading-5 text-text-secondary">{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Why Ahaar ────────────────────────────────────────────────────────────────

export function WhyAhaarSection({
  content,
  className,
}: {
  content?: HeadingContent | null;
  className?: string;
}) {
  const copy = cmsHeading(content, {
    eyebrow: 'Why AHAAR',
    title: 'Food you look forward to, every day',
    subtitle:
      "We obsess over the details so you don't have to — from sourcing to the moment it lands at your door.",
  });

  return (
    <View className={className}>
      <SectionHeading {...copy} />

      <View className="flex-row flex-wrap gap-3 px-5">
        {WHY_AHAAR.map((feature) => (
          <Card
            key={feature.title}
            // Two per row: 47% rather than a half, so the 12px gap can't push
            // the second tile onto its own line. Width goes through
            // `className` — `Card` spreads its rest props after its own
            // `style`, so a `style` prop here would silently drop the shadow.
            className="w-[47%]"
          >
            <View className="p-4">
              <Text className="text-2xl">{feature.glyph}</Text>
              <Text className="mt-2 text-xs font-bold text-text-primary">{feature.title}</Text>
              <Text className="mt-1 text-[11px] leading-4 text-text-secondary">
                {feature.body}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────

export function TestimonialsSection({
  content,
  className,
}: {
  content?: TestimonialsContent | null;
  className?: string;
}) {
  const copy = cmsHeading(content, {
    eyebrow: 'Loved by subscribers',
    title: 'What our customers say',
  });

  // An admin removing every testimonial hides the section (the panel says so);
  // no `items` key at all means "use the shipped ones".
  const items = Array.isArray(content?.items)
    ? content.items.map((item, index) => ({
        id: `${item.name}-${index}`,
        name: item.name,
        city: item.role ?? '',
        rating: item.rating,
        quote: item.quote,
        avatar: resolveCmsImage(item.avatar_url, item.avatar_path),
      }))
    : TESTIMONIALS.map((t) => ({ ...t, id: String(t.id), avatar: null as string | null }));

  if (items.length === 0) return null;

  return (
    <View className={className}>
      <SectionHeading {...copy} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
        style={{ flexGrow: 0 }}
      >
        {items.map((testimonial) => (
          <Card key={testimonial.id} className="w-72">
            <View className="p-5">
              <Text className="text-sm text-warning">
                {'★'.repeat(Math.max(0, Math.min(5, Math.round(testimonial.rating))))}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-text-primary">
                “{testimonial.quote}”
              </Text>
              <View className="mt-4 flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-50">
                  {testimonial.avatar ? (
                    <Image
                      source={{ uri: testimonial.avatar }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Text className="text-xs font-bold text-brand-700">
                      {testimonial.name.charAt(0)}
                    </Text>
                  )}
                </View>
                <View>
                  <Text className="text-xs font-bold text-text-primary">{testimonial.name}</Text>
                  {testimonial.city ? (
                    <Text className="text-[11px] text-text-muted">{testimonial.city}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Delivery coverage ────────────────────────────────────────────────────────

/** Not a CMS section: Home pins it after the testimonials. */
export function DeliveryCoverage({ className }: { className?: string }) {
  return (
    <View className={cn('px-5', className)}>
      <Card>
        <View className="p-5">
          <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
            Where we deliver
          </Text>
          <Text className="mt-1 text-base font-bold text-text-primary">
            Fresh food, across the Kingdom
          </Text>
          <Text className="mt-1 text-xs text-text-secondary">
            Daily delivery in these cities and the areas around them — with more added every
            month.
          </Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            {DELIVERY_CITIES.map((city) => (
              <Badge key={city} label={city} variant="muted" />
            ))}
          </View>
        </View>
      </Card>
    </View>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

export function FaqSection({
  content,
  className,
}: {
  content?: FaqContent | null;
  className?: string;
}) {
  // One open at a time: an accordion that lets every panel stand open turns
  // into a wall of text and loses the scannable list of questions.
  const [open, setOpen] = useState<number | null>(0);

  const copy = cmsHeading(content, {
    eyebrow: 'Good to know',
    title: 'Frequently asked questions',
  });

  const items = Array.isArray(content?.items)
    ? content.items.map((item) => ({ q: item.question, a: item.answer }))
    : FAQS;

  if (items.length === 0) return null;

  return (
    <View className={className}>
      <SectionHeading {...copy} />

      <View className="gap-2 px-5">
        {items.map((faq, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={`${faq.q}-${index}`}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              className="rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
            >
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm font-bold text-text-primary">{faq.q}</Text>
                <Text className="text-base text-text-muted">{expanded ? '−' : '+'}</Text>
              </View>

              {expanded ? (
                <Text className="mt-2 text-xs leading-5 text-text-secondary">{faq.a}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Closing call to action ──────────────────────────────────────────────────

export function ClosingCta({
  content,
  className,
}: {
  content?: CtaContent | null;
  className?: string;
}) {
  const router = useRouter();

  const heading = cmsText(content?.heading, 'Ready to stop thinking about dinner?');
  const subheading = cmsText(
    content?.subheading,
    content?.heading
      ? ''
      : 'Pick a plan, choose your start date, and we take it from there. Pause, swap or skip whenever you need to.',
  );
  const label = cmsText(content?.cta_label, 'Browse plans');
  const url = cmsText(content?.cta_url, '/plans');
  const actionable = resolveCmsLink(url) !== null;

  const card = (
    <View className="items-center rounded-3xl bg-brand-500 px-6 py-8">
      <Text className="text-center text-lg font-bold text-text-inverse">{heading}</Text>
      {subheading ? (
        <Text className="mt-1.5 text-center text-xs leading-5 text-brand-50">{subheading}</Text>
      ) : null}
      {actionable ? (
        <View className="mt-5 rounded-2xl bg-surface px-6 py-3">
          <Text className="text-sm font-bold text-brand-500">{label}</Text>
        </View>
      ) : null}
    </View>
  );

  return actionable ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => openCmsLink(url, router)}
      className={cn('px-5 active:opacity-90', className)}
    >
      {card}
    </Pressable>
  ) : (
    <View className={cn('px-5', className)}>{card}</View>
  );
}

// ── Shared heading ───────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View className="mb-4 px-5">
      {eyebrow ? (
        <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">{eyebrow}</Text>
      ) : null}
      <Text className="mt-1 text-lg font-bold text-text-primary">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-xs leading-5 text-text-secondary">{subtitle}</Text>
      ) : null}
    </View>
  );
}
