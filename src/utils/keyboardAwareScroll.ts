export type KeyboardAwareScrollMetrics = {
  inputTop: number;
  inputBottom: number;
  viewportTop: number;
  viewportBottom: number;
  keyboardTop?: number | null;
  topMargin?: number;
  bottomMargin?: number;
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function calculateKeyboardAwareScrollDelta({
  inputTop,
  inputBottom,
  viewportTop,
  viewportBottom,
  keyboardTop,
  topMargin = 0,
  bottomMargin = 0,
}: KeyboardAwareScrollMetrics) {
  if (![inputTop, inputBottom, viewportTop, viewportBottom].every(isFiniteNumber)) return 0;
  if (inputBottom < inputTop || viewportBottom <= viewportTop) return 0;

  const visibleTop = viewportTop + Math.max(0, topMargin);
  const keyboardLimitedBottom = isFiniteNumber(keyboardTop) && keyboardTop > 0 ? Math.min(viewportBottom, keyboardTop) : viewportBottom;
  const visibleBottom = keyboardLimitedBottom - Math.max(0, bottomMargin);

  if (visibleBottom <= visibleTop) return 0;
  if (inputBottom > visibleBottom) return inputBottom - visibleBottom;
  if (inputTop < visibleTop) return inputTop - visibleTop;
  return 0;
}
