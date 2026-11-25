import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlanCard } from '@/components/shared/PlanCard';
import { PlanTrustStrip } from '@/components/shared/PlanTrustStrip';
import { normalizePlan } from '@/lib/api/normalize';
import i18n from '@/lib/i18n';

/** A plan exactly as `GET /plans` returns it, through the real normalizer. */
const fromApi = (extra: Record<string, unknown> = {}) =>
  normalizePlan({
    id: 7,
    name: 'Rice Plan',
    slug: 'rice-plan',
    description: 'A long description for the detail page.',
    short_description: 'Fresh rice meals, every day.',
    image_url: 'https://api.ahaar.store/storage/plan/rice.png',
    duration_days: 15,
    price: '349.00',
    currency: 'EUR',
    ...extra,
  });

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('PlanCard', () => {
  it('shows badge, name, short description, SAR price and the CTA', async () => {
    await render(<PlanCard plan={fromApi()} onPress={jest.fn()} />);

    expect(screen.getByText('15 Days')).toBeTruthy();
    expect(screen.getByText('Rice Plan')).toBeTruthy();
    expect(screen.getByText('Fresh rice meals, every day.')).toBeTruthy();
    // The long description belongs to the detail screen, not the card.
    expect(screen.queryByText(/long description/)).toBeNull();
    // SAR, even though the API says EUR.
    expect(screen.getByText('SAR 349')).toBeTruthy();
    expect(screen.getByText('Choose plan')).toBeTruthy();
  });

  it('draws the plan image whole (contain), not cropped', async () => {
    await render(<PlanCard plan={fromApi()} />);
    const image = screen.getByTestId('plan-card-7-photo');
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.source).toEqual({ uri: 'https://api.ahaar.store/storage/plan/rice.png' });
  });

  it.each([null, undefined, '', '   '])('omits the description line when it is %p', async (value) => {
    await render(<PlanCard plan={fromApi({ short_description: value })} />);
    expect(screen.queryByTestId('plan-card-7-description')).toBeNull();
  });

  it('chooses the plan with onSelect, and opens the detail on a card tap', async () => {
    const onSelect = jest.fn();
    const onPress = jest.fn();
    await render(<PlanCard plan={fromApi()} onSelect={onSelect} onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('plan-card-7-cta'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('plan-card-7'));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it('falls back to opening the plan when there is no onSelect (Home)', async () => {
    const onPress = jest.fn();
    await render(<PlanCard plan={fromApi()} onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('plan-card-7-cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders in Arabic and Bangla', async () => {
    await i18n.changeLanguage('ar');
    await render(<PlanCard plan={fromApi({ short_description: 'وجبات أرز طازجة' })} onPress={jest.fn()} />);
    expect(screen.getByText('اختر الخطة')).toBeTruthy();
    expect(screen.getByText('وجبات أرز طازجة')).toBeTruthy();
    expect(screen.getByText('15 يومًا')).toBeTruthy();

    await i18n.changeLanguage('bn');
    await render(<PlanCard plan={fromApi()} onPress={jest.fn()} />);
    expect(screen.getByText('প্ল্যান বেছে নিন')).toBeTruthy();
    expect(screen.getByText('15 দিন')).toBeTruthy();
  });

  it('uses the primary accent for the featured plan and secondary for the rest', async () => {
    await render(<PlanCard plan={fromApi()} featured onPress={jest.fn()} />);
    expect(screen.getByTestId('plan-card-7-accent-primary')).toBeTruthy();
    expect(screen.getByText('Most popular')).toBeTruthy();

    await render(<PlanCard plan={fromApi()} onPress={jest.fn()} />);
    expect(screen.getByTestId('plan-card-7-accent-secondary')).toBeTruthy();
  });
});

describe('PlanTrustStrip', () => {
  it('lists the three promises in the current language', async () => {
    await render(<PlanTrustStrip />);
    expect(screen.getByText('Fresh & Healthy Meals')).toBeTruthy();
    expect(screen.getByText('On-Time Delivery')).toBeTruthy();
    expect(screen.getByText('Your Health, Our Priority')).toBeTruthy();

    await i18n.changeLanguage('ar');
    await render(<PlanTrustStrip />);
    expect(screen.getByText('صحتك أولويتنا')).toBeTruthy();
  });
});
