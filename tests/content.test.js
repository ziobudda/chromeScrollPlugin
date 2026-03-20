const { calculateProgress, formatMMSS } = require('../content/content.js');

describe('calculateProgress', () => {
  test('returns 0 at start', () => {
    expect(calculateProgress(0, 60000)).toBe(0);
  });
  test('returns 0.5 at halfway', () => {
    expect(calculateProgress(30000, 60000)).toBe(0.5);
  });
  test('returns 1.0 at end', () => {
    expect(calculateProgress(60000, 60000)).toBe(1);
  });
  test('clamps to 1.0 past the end', () => {
    expect(calculateProgress(70000, 60000)).toBe(1);
  });
  test('returns 1 when totalDuration is 0', () => {
    expect(calculateProgress(0, 0)).toBe(1);
  });
});

describe('formatMMSS (content)', () => {
  test('formats ms to MM:SS', () => {
    expect(formatMMSS(330000)).toBe('05:30');
  });
  test('clamps negative ms to 00:00', () => {
    expect(formatMMSS(-1000)).toBe('00:00');
  });
  test('floors partial seconds', () => {
    expect(formatMMSS(5999)).toBe('00:05');
  });
});
