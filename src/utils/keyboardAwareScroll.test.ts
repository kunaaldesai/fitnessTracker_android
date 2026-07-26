import { describe, expect, it } from 'vitest';

import { calculateKeyboardAwareScrollDelta } from './keyboardAwareScroll';

describe('calculateKeyboardAwareScrollDelta', () => {
  it('does not scroll when the input is already visible above the keyboard', () => {
    expect(
      calculateKeyboardAwareScrollDelta({
        inputTop: 360,
        inputBottom: 400,
        viewportTop: 120,
        viewportBottom: 780,
        keyboardTop: 520,
        topMargin: 18,
        bottomMargin: 28,
      }),
    ).toBe(0);
  });

  it('returns a positive scroll delta when the input is hidden below the keyboard', () => {
    expect(
      calculateKeyboardAwareScrollDelta({
        inputTop: 480,
        inputBottom: 526,
        viewportTop: 120,
        viewportBottom: 780,
        keyboardTop: 520,
        topMargin: 18,
        bottomMargin: 28,
      }),
    ).toBe(34);
  });

  it('returns a negative scroll delta when the input is above the visible viewport', () => {
    expect(
      calculateKeyboardAwareScrollDelta({
        inputTop: 96,
        inputBottom: 134,
        viewportTop: 120,
        viewportBottom: 780,
        keyboardTop: 520,
        topMargin: 18,
        bottomMargin: 28,
      }),
    ).toBe(-42);
  });

  it('falls back to the list viewport bottom when the keyboard frame is missing', () => {
    expect(
      calculateKeyboardAwareScrollDelta({
        inputTop: 720,
        inputBottom: 780,
        viewportTop: 120,
        viewportBottom: 760,
        keyboardTop: null,
        topMargin: 18,
        bottomMargin: 28,
      }),
    ).toBe(48);
  });
});
