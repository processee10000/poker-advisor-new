/**
 * "More aggressive, not much though, just a little bit."
 *
 * That is a two-sided requirement and both sides can fail silently. A dial
 * that does nothing is the likelier bug, and this file caught three of them
 * before it passed: the setting folded into `LearnedParams` where two other
 * tests could prove it was not a learned dial, a multiplier on the c-bet and
 * barrel confidence gates that turned out to be arithmetically inert, and a
 * controller that passed the setting only when learning was switched on.
 *
 * The expensive failure is the other side. The reports this engine's guard
 * layer was built for — "fold BB AA preflop", "call all in with 38o" — are
 * what it looks like when something that should only move frequencies starts
 * moving decisions, so the spots the engine is sure about are checked to be
 * untouched at both settings.
 *
 * Mixing is a hash of the cards, not a random draw (see engine/mixing), so
 * sweeping hand classes is deterministic and a count of changed decisions
 * means something.
 */
import { aggressionFactor, AGGRESSION_BUMP } from '../src/engine/aggression';
import { advisePostflopAction } from '../src/engine/postflop/postflop-advisor';
import { advisePreflopAction } from '../src/engine/preflop/preflop-advisor';
import { NEUTRAL_PARAMS } from '../src/engine/learning';
import { Card, GameState } from '../src/engine/types';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${cond || !detail ? '' : `\n       ${detail}`}`);
  if (!cond) failures++;
}

const c = (rank: number, suit: number): Card => ({ rank: rank as any, suit: suit as any });
const BB = 100;
const STANDARD = aggressionFactor('standard');
const HOT = aggressionFactor('aggressive');

console.log('the dial itself');
{
  check('standard is exactly neutral', STANDARD === 1, String(STANDARD));
  check('so is an unset setting', aggressionFactor(undefined) === 1);
  check('aggressive is the bump', HOT === AGGRESSION_BUMP, String(HOT));
  check('and the bump is small', AGGRESSION_BUMP > 1 && AGGRESSION_BUMP <= 1.15,
    `${AGGRESSION_BUMP} is not "a little bit"`);
  check('it is not one of the learned dials', !('aggression' in NEUTRAL_PARAMS),
    'a user setting among the learned dials is what learning-chain objects to');
}

const SUITS = [0, 1, 2, 3];
const name = (r: number) => (r <= 10 ? String(r) : { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r]);

/** Every hand class once: pairs, then suited and offsuit of each combination. */
function allHandClasses(): { label: string; hole: [Card, Card] }[] {
  const out: { label: string; hole: [Card, Card] }[] = [];
  for (let hi = 14; hi >= 2; hi--) {
    for (let lo = hi; lo >= 2; lo--) {
      if (hi === lo) {
        out.push({ label: `${name(hi)}${name(lo)}`, hole: [c(hi, SUITS[0]), c(lo, SUITS[1])] });
      } else {
        out.push({ label: `${name(hi)}${name(lo)}s`, hole: [c(hi, SUITS[0]), c(lo, SUITS[0])] });
        out.push({ label: `${name(hi)}${name(lo)}o`, hole: [c(hi, SUITS[0]), c(lo, SUITS[1])] });
      }
    }
  }
  return out;
}

/** How aggressive an action is, for checking the dial never points backwards. */
const rank: Record<string, number> = {
  fold: 0, check: 0, call: 1, bet: 2, raise: 2, 'all-in': 3,
};

/**
 * The BB facing a single button open: the spot the light three-bet frequency
 * governs, and the one the original report was about.
 */
function bbFacingAnOpen(hole: [Card, Card], open = 250): GameState {
  const bets = [open, BB];
  return {
    holeCards: hole, communityCards: [], street: 'preflop',
    pot: bets[0] + bets[1], yourStack: 10000 - BB, yourCurrentBet: BB,
    costToCall: open - BB, minRaise: open * 2, bigBlind: BB, smallBlind: BB / 2,
    players: [
      { name: 'p0', seatIndex: 0, stack: 10000 - open, currentBet: open, isActive: true, isYou: false },
      { name: 'you', seatIndex: 1, stack: 10000 - BB, currentBet: BB, isActive: true, isYou: true },
    ],
    activePlayers: 2,
    position: 'BB' as any,
    dealerSeatIndex: 0,
    availableActions: open > BB ? ['fold', 'call', 'raise'] : ['check', 'raise'],
  } as GameState;
}

console.log('across every hand class, BB facing a button open');
{
  /**
   * Preflop the dial is deliberately NOT asserted to change anything.
   *
   * It is wired to the light three-bet frequency, the only preflop decision
   * that is a frequency rather than a range — and measurement says that at
   * this bump it moves no hand at all. The mix is hashed on the hole cards
   * alone, so each of the twenty-odd bluff candidates has one fixed roll for
   * every spot it ever appears in; 1.12 widens a 36-40% frequency by about
   * four points and no candidate's roll lands in that band. Swept across
   * 6,760 spot-hands — five open sizes, four stack depths, two player counts,
   * 169 classes — zero changes. The first class moves at about 1.5x, which
   * is not "a little bit".
   *
   * So this sweep is a guardrail, not a demonstration. Asserting zero would
   * lock that inertness in; asserting more than zero would fail a correct
   * implementation. What has to hold is that nothing moves the WRONG way and
   * nothing moves far.
   */
  const moved: string[] = [];
  const wrongWay: string[] = [];
  let spots = 0;

  for (const { label, hole } of allHandClasses()) {
    for (const open of [BB, 200, 250, 300, 400]) {
      spots++;
      const a = advisePreflopAction(bbFacingAnOpen(hole, open), NEUTRAL_PARAMS, STANDARD).action;
      const b = advisePreflopAction(bbFacingAnOpen(hole, open), NEUTRAL_PARAMS, HOT).action;
      if (a === b) continue;
      moved.push(`${label}@${open / BB}x: ${a} -> ${b}`);
      if ((rank[b] ?? 0) < (rank[a] ?? 0)) wrongWay.push(`${label}@${open / BB}x: ${a} -> ${b}`);
    }
  }

  check('nothing is made less aggressive', wrongWay.length === 0, wrongWay.join('; '));
  check('and nothing moves far', moved.length <= 20,
    `${moved.length} changes: ${moved.slice(0, 20).join('; ')}`);
  console.log(`       (${moved.length} of ${spots} spot-hands moved${moved.length ? ': ' + moved.join('; ') : ''})`);
}

console.log('spots the engine is sure about do not move');
{
  for (const [label, hole] of [
    ['AA', [c(14, 0), c(14, 1)]],
    ['KK', [c(13, 0), c(13, 1)]],
    ['QQ', [c(12, 0), c(12, 1)]],
    ['AKs', [c(14, 0), c(13, 0)]],
  ] as [string, [Card, Card]][]) {
    const a = advisePreflopAction(bbFacingAnOpen(hole), NEUTRAL_PARAMS, STANDARD);
    const b = advisePreflopAction(bbFacingAnOpen(hole), NEUTRAL_PARAMS, HOT);
    check(`${label} is raised either way`, a.action === 'raise' && b.action === 'raise',
      `${a.action} / ${b.action}`);
    check(`${label} is raised to the same size`, a.amount === b.amount,
      `${a.amount} vs ${b.amount}`);
  }
}
{
  /**
   * The other end of the original report: 38o is not a hand the dial may
   * talk itself into, at any price it is being asked to pay.
   */
  const trash: [Card, Card] = [c(8, 0), c(3, 1)];
  for (const open of [250, 1000, 3000, 9900]) {
    const a = advisePreflopAction(bbFacingAnOpen(trash, open), NEUTRAL_PARAMS, STANDARD).action;
    const b = advisePreflopAction(bbFacingAnOpen(trash, open), NEUTRAL_PARAMS, HOT).action;
    check(`38o folds to a ${open / BB}bb open either way`,
      a === 'fold' && b === 'fold', `${a} / ${b}`);
  }
}

/**
 * Postflop is where the dial actually bites: the share of missed turns and
 * rivers we fire at, which `bluffFrequencyGate` decides per hand from a hash
 * of the cards AND the board. The turn moves from 58% of eligible air to
 * 65%, the river from 80% to 90%.
 *
 * A dry rainbow turn in position with the betting checked through — the spot
 * where "do we fire at this" is a frequency question rather than a hand
 * question. The board has to be dry: on a two-tone one the wetness gate
 * closes the bluffing branch entirely and this sweep reports nothing, which
 * is how the first draft of it passed while measuring nothing at all.
 */
function missedTurnInPosition(hole: [Card, Card]): GameState {
  const board: Card[] = [c(9, 0), c(4, 1), c(2, 2), c(7, 3)];
  return {
    holeCards: hole, communityCards: board, street: 'turn',
    pot: 500, yourStack: 9750, yourCurrentBet: 0,
    costToCall: 0, minRaise: BB, bigBlind: BB, smallBlind: BB / 2,
    players: [
      { name: 'p0', seatIndex: 0, stack: 9750, currentBet: 0, isActive: true, isYou: false },
      { name: 'you', seatIndex: 1, stack: 9750, currentBet: 0, isActive: true, isYou: true },
    ],
    activePlayers: 2,
    position: 'BTN' as any,
    dealerSeatIndex: 1,
    availableActions: ['check', 'bet'],
    heroIsPreflopAggressor: true,
  } as GameState;
}

console.log('on a missed turn, checked to us in position');
{
  const moved: string[] = [];
  const wrongWay: string[] = [];
  let eligible = 0;

  for (const { label, hole } of allHandClasses()) {
    if (hole.some(h => [9, 4, 2, 7].includes(h.rank))) continue; // clashes with the board
    eligible++;
    const a = advisePostflopAction(missedTurnInPosition(hole), NEUTRAL_PARAMS, STANDARD).action;
    const b = advisePostflopAction(missedTurnInPosition(hole), NEUTRAL_PARAMS, HOT).action;
    if (a === b) continue;
    moved.push(`${label}: ${a} -> ${b}`);
    if (!(a === 'check' && b === 'bet')) wrongWay.push(`${label}: ${a} -> ${b}`);
  }

  check('the dial reaches the bluffing frequency', moved.length > 0,
    'no hand changed — the postflop hook is inert');
  check('and only ever turns a check into a bet', wrongWay.length === 0, wrongWay.join('; '));
  check('a nudge, not a rewrite', moved.length <= eligible / 8,
    `${moved.length} of ${eligible} moved`);
  console.log(`       (${moved.length} of ${eligible} moved: ${moved.join('; ')})`);
}
{
  /** A set on this board is not a decision any setting gets a say in. */
  const set: [Card, Card] = [c(9, 1), c(9, 2)];
  const a = advisePostflopAction(missedTurnInPosition(set), NEUTRAL_PARAMS, STANDARD);
  const b = advisePostflopAction(missedTurnInPosition(set), NEUTRAL_PARAMS, HOT);
  check('a set bets either way, for the same amount',
    a.action === b.action && a.amount === b.amount,
    `${a.action} ${a.amount} vs ${b.action} ${b.amount}`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
