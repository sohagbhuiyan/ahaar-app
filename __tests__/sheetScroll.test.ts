import { scrollOffsetToReveal } from '@/components/ui/sheetScroll';

describe('scrollOffsetToReveal', () => {
  // A 300pt uncovered view, scrolled to the top; the margin is 16pt.
  const view = { scrollOffset: 0, visibleHeight: 300 };

  it('leaves a field that is already in view alone', () => {
    expect(scrollOffsetToReveal({ ...view, fieldTop: 100, fieldHeight: 80 })).toBeNull();
  });

  it('scrolls down just far enough to lift a field out from behind the footer', () => {
    // Bottom edge 380, plus the margin, lands on the 300pt line.
    expect(scrollOffsetToReveal({ ...view, fieldTop: 300, fieldHeight: 80 })).toBe(96);
  });

  it('scrolls up to a field above the view', () => {
    expect(
      scrollOffsetToReveal({ scrollOffset: 200, visibleHeight: 300, fieldTop: 100, fieldHeight: 80 }),
    ).toBe(84);
  });

  it('keeps the top of a field taller than the view in sight', () => {
    expect(scrollOffsetToReveal({ ...view, fieldTop: 400, fieldHeight: 500 })).toBe(384);
  });

  it('never scrolls past the top', () => {
    expect(
      scrollOffsetToReveal({ scrollOffset: 40, visibleHeight: 300, fieldTop: 8, fieldHeight: 80 }),
    ).toBe(0);
  });

  it('does nothing when no part of the view is uncovered', () => {
    expect(scrollOffsetToReveal({ ...view, visibleHeight: 0, fieldTop: 400, fieldHeight: 80 })).toBeNull();
    expect(scrollOffsetToReveal({ ...view, visibleHeight: -20, fieldTop: 400, fieldHeight: 80 })).toBeNull();
  });
});
