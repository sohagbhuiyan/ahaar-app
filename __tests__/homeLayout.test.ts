import { normalizeHomeContent } from '@/lib/api/normalize';
import { cmsHeading, resolveCmsImage, resolveCmsLink } from '@/lib/cms';
import { FALLBACK_HOME_LAYOUT, selectHomeLayout } from '@/lib/query/hooks/useHome';

const types = (layout: { sections: { type: string }[] }) => layout.sections.map((s) => s.type);

describe('selectHomeLayout', () => {
  it("follows the admin's app order from a current API", () => {
    const layout = selectHomeLayout(
      normalizeHomeContent({
        layout_version: 2,
        sections: [
          { type: 'hero', sort_order: 0, content: { title: 'Eat well,' }, banners: [] },
          {
            type: 'promo_top',
            sort_order: 1,
            content: null,
            banners: [{ id: 4, image_path: 'home/a.png', image_url: 'https://cdn.test/a.png' }],
          },
          { type: 'faq', sort_order: 2, content: null, banners: [] },
          { type: 'newsletter', sort_order: 3, content: null, banners: [] },
        ],
      }),
    );

    // Exactly what the API sent, minus the type this build cannot render — an
    // admin switching the categories off means no categories.
    expect(types(layout)).toEqual(['hero', 'promo_top', 'faq']);
    expect(layout.sections[1].banners[0].image_url).toBe('https://cdn.test/a.png');
  });

  it('keeps a complete Home against an API from before the app layout', () => {
    const layout = selectHomeLayout(
      normalizeHomeContent({
        sections: [
          { type: 'promo_app', sort_order: 1, content: null, banners: [] },
          { type: 'featured_menu', sort_order: 4, content: { limit: 4 }, banners: [] },
          { type: 'plans', sort_order: 7, content: null, banners: [] },
          { type: 'cta', sort_order: 11, content: null, banners: [] },
        ],
      }),
    );

    expect(types(layout)).toEqual([
      'hero',
      'promo_app',
      'category_showcase',
      'featured_menu',
      'media_videos',
      'plans',
      'how_it_works',
      'why_us',
      'testimonials',
      'faq',
      'cta',
    ]);
    // What the old API does describe still comes from it.
    expect(layout.sections.find((s) => s.type === 'featured_menu')?.content).toEqual({ limit: 4 });
  });

  it('falls back to every imageless section while the CMS is unavailable', () => {
    expect(types(FALLBACK_HOME_LAYOUT)).toEqual(
      expect.arrayContaining(['hero', 'category_showcase', 'featured_menu', 'media_videos', 'cta']),
    );
    expect(FALLBACK_HOME_LAYOUT.sections.every((s) => s.content === null)).toBe(true);
  });
});

describe('resolveCmsLink', () => {
  it("sends the website's dish menu to the Foods tab, not Account", () => {
    expect(resolveCmsLink('/menu')).toEqual({ kind: 'route', href: '/(tabs)/foods' });
    expect(resolveCmsLink('/en/plans')).toEqual({ kind: 'route', href: '/(tabs)/plans' });
    expect(resolveCmsLink('/media')).toEqual({ kind: 'route', href: '/media' });
    expect(resolveCmsLink('/package/3')).toEqual({ kind: 'route', href: '/package/3' });
  });

  it('hands phone links to the system and ignores paths the app has no screen for', () => {
    expect(resolveCmsLink('tel:+966500000000')).toEqual({ kind: 'system', href: 'tel:+966500000000' });
    expect(resolveCmsLink('https://wa.me/966500000000')?.kind).toBe('external');
    expect(resolveCmsLink('Rerum et sit atque')).toBeNull();
    expect(resolveCmsLink('  ')).toBeNull();
  });
});

describe('resolveCmsImage', () => {
  const api = 'https://api.ahaar.store/api/v1';

  it('prefers the URL the API resolved', () => {
    expect(resolveCmsImage('https://api.ahaar.store/storage/home/a.png', 'home/a.png', api)).toBe(
      'https://api.ahaar.store/storage/home/a.png',
    );
  });

  it('resolves a bare storage path against the API host, and passes absolute ones through', () => {
    expect(resolveCmsImage(null, 'home/a.png', api)).toBe('https://api.ahaar.store/storage/home/a.png');
    expect(resolveCmsImage(undefined, 'https://images.test/x.jpg', api)).toBe('https://images.test/x.jpg');
    expect(resolveCmsImage('', '', api)).toBeNull();
  });
});

describe('cmsHeading', () => {
  it('uses the shipped copy for anything the CMS leaves empty', () => {
    expect(cmsHeading(null, { title: 'Popular dishes', subtitle: 'Fresh today' })).toEqual({
      eyebrow: '',
      title: 'Popular dishes',
      subtitle: 'Fresh today',
    });
  });

  it('does not pair a CMS heading with the shipped sub-heading', () => {
    expect(
      cmsHeading(
        { eyebrow: 'On the menu', heading: "This week's favourites", subheading: '' },
        { title: 'Popular dishes', subtitle: 'Fresh today' },
      ),
    ).toEqual({ eyebrow: 'On the menu', title: "This week's favourites", subtitle: '' });
  });
});
