/**
 * Which unit a duel.com table is counting in.
 *
 * The site can show stacks, bets and the pot either as chips ("3,346.00") or
 * as big blinds ("55.8BB"). Every number the scraper reads changes meaning
 * with that switch, and reading one as the other is not a small error: a
 * stack of 55.8 where 3,346 was meant reads as a player with half a blind
 * behind, and the price of a call read in blinds instead of chips is the
 * hundredfold understatement that produced "call all in with 38o" live.
 */
export type DisplayUnit = 'chips' | 'bb';

/**
 * Does this text state a figure in big blinds?
 *
 * The pattern is not a guess. `readBigBlindFromRaiseButton` has been matching
 * `/([\d.]+)\s*BB/i` against this site's live markup since the raise button
 * was first read — the button states its amount twice, once each way, which
 * is how the blind level is derived at all. So "a number followed by BB" is
 * an established fact about duel.com's rendering rather than an assumption
 * about what a blinds mode might look like.
 *
 * Deliberately requires a digit before the BB. A heading or tooltip reading
 * "BB" on its own is a label, not an amount, and matching it would flip the
 * whole table into blind units on the strength of a caption.
 */
export function isBlindDenominated(text: string): boolean {
  return /\d\s*bb\b/i.test(text || '');
}

/**
 * An amount for the panel, in whatever unit the table is using.
 *
 * Chips are whole numbers and get the K/M abbreviation, because a 3,346 chip
 * stack is read as "3.3K" and the trailing digits are noise. Blinds are not:
 * the difference between 2 and 2.5 big blinds is a different raise, so they
 * keep a decimal and never abbreviate — "2.5BB" is the number the user is
 * about to type into a box that is also in blinds.
 */
export function formatAmount(amount: number, unit: DisplayUnit = 'chips'): string {
  if (unit === 'bb') {
    // A whole number of blinds does not need a false decimal place
    const rounded = Math.round(amount * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}BB`;
  }
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}
