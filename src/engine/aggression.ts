export type AggressionLevel = 'standard' | 'aggressive';

/**
 * How much further the aggressive setting leans.
 *
 * 1.12, which is deliberately small. The request was "more aggressive, not
 * much though, just a little bit", and that is a real constraint rather than
 * a vague one: a frequency dial applies to every borderline spot at once, so
 * what reads as a modest nudge on one decision compounds across a session.
 *
 * It is a multiplier on FREQUENCY — how often a close spot takes the
 * aggressive branch — and on nothing else. Not hand strength, not price, not
 * sizing. A hand the engine is confident about has already been decided by
 * the time this is consulted, which is why the dial cannot produce the kind
 * of failure the learning layer was wrongly blamed for.
 */
export const AGGRESSION_BUMP = 1.12;

/**
 * The setting as the engine consumes it: a plain multiplier.
 *
 * It used to be a field on `LearnedParams`, carried through to the two
 * places that read it. Two tests objected, and they were right to:
 * `learning-chain` asserts that type has exactly five members and
 * `self-check-covers-dials` asserts every member has a self-check scenario
 * proving learning can move it. Neither is true of a user setting, and
 * making them true would have meant pretending the popup was evidence.
 *
 * So it travels as its own argument. `LearnedParams` means what the results
 * argue for; this means what the user asked for; they multiply where they
 * meet, and 1 is "as measured" at both ends.
 */
export function aggressionFactor(level: AggressionLevel | undefined): number {
  return level === 'aggressive' ? AGGRESSION_BUMP : 1;
}
