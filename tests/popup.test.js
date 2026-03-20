const { parseMMSS, formatMMSS } = require('../popup/popup.js');

describe('parseMMSS', () => {
  test('parses valid MM:SS to milliseconds', () => {
    expect(parseMMSS('05:30')).toBe(330000);
  });
  test('parses 00:05 — minimum valid duration', () => {
    expect(parseMMSS('00:05')).toBe(5000);
  });
  test('parses 99:59 — maximum', () => {
    expect(parseMMSS('99:59')).toBe(5999000);
  });
  test('returns null for 00:00', () => {
    expect(parseMMSS('00:00')).toBeNull();
  });
  test('returns null for duration under 5 seconds', () => {
    expect(parseMMSS('00:04')).toBeNull();
  });
  test('returns null for letters', () => {
    expect(parseMMSS('ab:cd')).toBeNull();
  });
  test('returns null for seconds >= 60', () => {
    expect(parseMMSS('05:60')).toBeNull();
  });
  test('returns null for empty string', () => {
    expect(parseMMSS('')).toBeNull();
  });
  test('returns null for null input', () => {
    expect(parseMMSS(null)).toBeNull();
  });
  test('returns null for number input (not a string)', () => {
    expect(parseMMSS(330)).toBeNull();
  });
  // Plain integer → seconds
  test('plain integer interpreted as seconds', () => {
    expect(parseMMSS('90')).toBe(90000);
  });
  test('plain integer 0530 interpreted as 530 seconds', () => {
    expect(parseMMSS('0530')).toBe(530000);
  });
  test('plain integer under 5 returns null', () => {
    expect(parseMMSS('4')).toBeNull();
  });
  test('plain integer 5 is minimum valid', () => {
    expect(parseMMSS('5')).toBe(5000);
  });
});

describe('formatMMSS', () => {
  test('formats ms to MM:SS', () => {
    expect(formatMMSS(330000)).toBe('05:30');
  });
  test('formats 0 to 00:00', () => {
    expect(formatMMSS(0)).toBe('00:00');
  });
  test('pads single digits', () => {
    expect(formatMMSS(5000)).toBe('00:05');
  });
  test('floors partial seconds', () => {
    expect(formatMMSS(5999)).toBe('00:05');
  });
});
