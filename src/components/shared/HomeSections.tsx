import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card } from '@/components/ui';
import {
  AHAAR_STATS,
  DELIVERY_CITIES,
  FAQS,
  HOW_IT_WORKS,
  TESTIMONIALS,
  WHY_AHAAR,
} from '@/lib/constants/marketing';
import { cn } from '@/lib/utils';

/**
 * The evergreen half of Home.
 *
 * Everything above these sections is either this customer's own state (today's
 * meals, their subscription) or CMS-driven marketing, so Home used to end
 * roughly a screen and a half in — and a signed-out visitor, who has none of
 * the personal parts, reached the bottom almost immediately with no answer to
 * "why would I subscribe?".
 *
 * These sections are static and render identically signed in or out. They come
 * *below* the catalogue rails on purpose: a returning subscriber should never
 * have to scroll past the pitch to reach their own food.
 */
export function HomeSections({ onBrowsePlans }: { onBrowsePlans: () => void }) {
  return (
    <>
      <StatsStrip />
      <HowItWorks />
      <WhyAhaar />
      <Testimonials />
      <DeliveryCoverage />
      <Faq />
      <ClosingNote onBrowsePlans={onBrowsePlans} />
    </>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

function StatsStrip() {
  return (
    <View className="mt-8 px-5">
      <Card className="bg-surface-secondary">
        <View className="flex-row items-center justify-between p-5">
          {AHAAR_STATS.map((stat, index) => (
            <View
              key={stat.label}
              className={cn(
                'flex-1 items-center',
                index > 0 && 'border-l border-border',
              )}
            >
              <Text className="text-xl font-bold text-brand-500">{stat.value}</Text>
              <Text className="mt-0.5 text-center text-[11px] text-text-secondary">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <View className="mt-8">
      <SectionHeading
        eyebrow="How it works"
        title="Great meals in four simple steps"
        subtitle="From subscription to your table — no planning, no shopping, no cleanup."
      />

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
              <Text className="text-sm font-bold text-text-primary">
                {step.title}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-text-secondary">
                {step.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Why Ahaar ────────────────────────────────────────────────────────────────

function WhyAhaar() {
  return (
    <View className="mt-6">
      <SectionHeading
        eyebrow="Why AHAAR"
        title="Food you look forward to, every day"
        subtitle="We obsess over the details so you don't have to — from sourcing to the moment it lands at your door."
      />

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
              <Text className="mt-2 text-xs font-bold text-text-primary">
                {feature.title}
              </Text>
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

function Testimonials() {
  return (
    <View className="mt-8">
      <SectionHeading
        eyebrow="Loved by subscribers"
        title="What our customers say"
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
        style={{ flexGrow: 0 }}
      >
        {TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.id} className="w-72">
            <View className="p-5">
              <Text className="text-sm text-warning">
                {'★'.repeat(testimonial.rating)}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-text-primary">
                “{testimonial.quote}”
              </Text>
              <View className="mt-4 flex-row items-center gap-2">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
                  <Text className="text-xs font-bold text-brand-700">
                    {testimonial.name.charAt(0)}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs font-bold text-text-primary">
                    {testimonial.name}
                  </Text>
                  <Text className="text-[11px] text-text-muted">
                    {testimonial.city}
                  </Text>
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

function DeliveryCoverage() {
  return (
    <View className="mt-8 px-5">
      <Card>
        <View className="p-5">
          <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
            Where we deliver
          </Text>
          <Text className="mt-1 text-base font-bold text-text-primary">
            Fresh food, across the Kingdom
          </Text>
          <Text className="mt-1 text-xs text-text-secondary">
            Daily delivery in these cities and the areas around them — with more
            added every month.
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

function Faq() {
  // One open at a time: an accordion that lets every panel stand open turns
  // into a wall of text and loses the scannable list of questions.
  const [open, setOpen] = useState<number | null>(0);

  return (
    <View className="mt-8">
      <SectionHeading eyebrow="Good to know" title="Frequently asked questions" />

      <View className="gap-2 px-5">
        {FAQS.map((faq, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={faq.q}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              className="rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
            >
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm font-bold text-text-primary">
                  {faq.q}
                </Text>
                <Text className="text-base text-text-muted">
                  {expanded ? '−' : '+'}
                </Text>
              </View>

              {expanded ? (
                <Text className="mt-2 text-xs leading-5 text-text-secondary">
                  {faq.a}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Closing note ─────────────────────────────────────────────────────────────

function ClosingNote({ onBrowsePlans }: { onBrowsePlans: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Browse meal plans"
      onPress={onBrowsePlans}
      className="mt-8 px-5 active:opacity-90"
    >
      <View className="items-center rounded-3xl bg-brand-500 px-6 py-8">
        <Text className="text-center text-lg font-bold text-text-inverse">
          Ready to stop thinking about dinner?
        </Text>
        <Text className="mt-1.5 text-center text-xs leading-5 text-brand-50">
          Pick a plan, choose your start date, and we take it from there. Pause,
          swap or skip whenever you need to.
        </Text>
        <View className="mt-5 rounded-2xl bg-surface px-6 py-3">
          <Text className="text-sm font-bold text-brand-500">Browse plans</Text>
        </View>
      </View>
    </Pressable>
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
      <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
        {eyebrow}
      </Text>
      <Text className="mt-1 text-lg font-bold text-text-primary">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 text-xs leading-5 text-text-secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
