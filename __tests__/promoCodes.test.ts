import { normalizeHomeContent, normalizePromoCodes } from '@/lib/api/normalize';

const NOW = new Date('2026-09-15T12:00:00Z');

describe('normalizePromoCodes', () => {
  it('keeps usable codes and drops blank or expired ones', () => {
    const codes = normalizePromoCodes(
      [
        { code: ' FRESH20 ', title: 'First week', discount_label: '20% off', expires_at: '2026-10-01T00:00:00Z' },
        { code: 'OLD10', expires_at: '2026-09-01T00:00:00Z' },
        { code: '   ' },
        null,
        { code: 'FOREVER', description: '' },
      ],
      NOW,
    );

    expect(codes.map((c) => c.code)).toEqual(['FRESH20', 'FOREVER']);
    expect(codes[0]).toMatchObject({ title: 'First week', discount_label: '20% off' });
    // An empty CMS field means "not set", never an empty line.
    expect(codes[1].description).toBeNull();
  });

  it('is empty for anything that is not a list', () => {
    expect(normalizePromoCodes(undefined)).toEqual([]);
    expect(normalizePromoCodes({ code: 'X' })).toEqual([]);
  });
});

describe('normalizeHomeContent', () => {
  it('carries promo codes on their own section only', () => {
    const content = normalizeHomeContent({
      sections: [
        { type: 'promo_app', sort_order: 1, content: null, banners: [] },
        { type: 'promo_codes', sort_order: 2, content: { codes: [{ code: 'AHAAR15' }] } },
      ],
    });

    expect(content.sections.find((s) => s.type === 'promo_app')?.codes).toEqual([]);
    expect(content.sections.find((s) => s.type === 'promo_codes')?.codes[0].code).toBe('AHAAR15');
  });
});
