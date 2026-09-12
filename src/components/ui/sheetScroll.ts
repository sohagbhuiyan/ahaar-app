/** Room kept between a revealed field and the edge it was hidden behind. */
const REVEAL_MARGIN = 16;

interface RevealParams {
  /** The field's top, measured from the top of the scroll content. */
  fieldTop: number;
  fieldHeight: number;
  scrollOffset: number;
  /** How much of the scroll view is uncovered, from its top down. */
  visibleHeight: number;
  margin?: number;
}

/**
 * The scroll offset that brings a field fully into view while moving as
 * little as possible — or `null` when it is in view already.
 *
 * A field taller than the view keeps its top visible, since that is where its
 * label is.
 */
export function scrollOffsetToReveal({
  fieldTop,
  fieldHeight,
  scrollOffset,
  visibleHeight,
  margin = REVEAL_MARGIN,
}: RevealParams): number | null {
  // Not measured yet, or a footer taller than the view: nowhere to reveal to.
  if (visibleHeight <= 0) return null;

  const top = fieldTop - margin;
  const bottom = fieldTop + fieldHeight + margin;

  let next = scrollOffset;
  if (bottom > next + visibleHeight) next = bottom - visibleHeight;
  if (top < next) next = top;
  next = Math.max(0, next);

  return Math.abs(next - scrollOffset) < 1 ? null : next;
}
