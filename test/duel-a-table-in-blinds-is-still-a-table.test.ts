/**
 * duel.com can count in big blinds instead of chips, and every number on the
 * table changes meaning when it does.
 *
 * The danger here is not hypothetical and not symmetrical. Reading a chip
 * figure as blinds would multiply every size by the blind level; reading a
 * blind figure as chips is the hundredfold understatement that was caught
 * live last week on the call button — "Call 150" read as a price of 1.5, out
 * of which came folding aces, calling off with 83o, and re-raises below the
 * table minimum. So the mode is detected from the figures that are on screen
 * for the whole hand, and the default when nothing says otherwise is chips.
 *
 * The engine needs no changes for any of this: it reasons in ratios, and a
 * consistent unit is all a ratio needs. In blinds mode the blinds are 1 and
 * 0.5 by definition, the small-blind rounding increment becomes half a
 * blind, and the minimum-bet floor of 1 becomes one blind — each of which is
 * the right answer in that unit rather than a coincidence.
 *
 * `55.8BB` is the live rendering, not an invention: the raise button has
 * been stating its amount that way since it was first read, which is how the
 * blind level is derived at all (see readBigBlindFromRaiseButton).
 */
import { JSDOM } from 'jsdom';
import { mountTable } from './helpers/duel-table';
import {
  readBlinds, readCostToCall, readDisplayUnit, readYourStack, readBetsOnTable,
} from '../src/content/scraper/table-reader';
import { isBlindDenominated, formatAmount } from '../src/shared/units';
import { renderAdvice } from '../src/content/ui/components';
import { Advice } from '../src/engine/types';
import { findContradictions } from '../src/engine/state-check';
import { StrategyEngine } from '../src/engine/index';

let failures = 0;
function expect(name: string, actual: unknown, wanted: unknown): void {
  const ok = actual === wanted;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: expected ${wanted}, got ${actual}`}`);
  if (!ok) failures++;
}
function check(name: string, cond: boolean, detail = ''): void {
  console.log(`  ${cond ? 'PASS' : 'FAIL'} ${name}${cond || !detail ? '' : `: ${detail}`}`);
  if (!cond) failures++;
}

/** A table in chips, with the call button carrying its blind conversion. */
const IN_CHIPS = {
  seats: [
    { name: 'Villain', stack: '9,600', bet: '400' },
    { name: 'Hero', stack: '9,750', bet: '250', isSelf: true, isActor: true },
  ],
  hole: ['Ah', 'Kh'],
  pot: '0',
  actions: { fold: true, call: 'Call' as const, callBB: '1.5BB', callAmount: '150.00' },
  allIn: { chips: '3,346.00', bb: '55.8' },
};

/**
 * The same table in blinds, at the same 50/100 level.
 *
 * Everything is divided by 100 and carries the BB marker — stacks, the chips
 * in front of each player, the pot and the call button. The raise button
 * quotes its all-in figure in blinds only, because there is no second unit
 * left for it to convert into.
 */
const IN_BLINDS = {
  seats: [
    { name: 'Villain', stack: '96BB', bet: '4BB' },
    { name: 'Hero', stack: '97.5BB', bet: '2.5BB', isSelf: true, isActor: true },
  ],
  hole: ['Ah', 'Kh'],
  pot: '0BB',
  actions: { fold: true, call: 'Call' as const, callBB: '1.5BB' },
  allIn: { chips: '', bb: '33.5' },
};

async function main(): Promise<void> {
  console.log('\ntelling an amount in blinds from an amount in chips');
  {
    expect('55.8BB is blinds', isBlindDenominated('55.8BB'), true);
    expect('so is "1.5 bb"', isBlindDenominated('1.5 bb'), true);
    expect('and "97.5BB"', isBlindDenominated('97.5BB'), true);
    expect('3,346.00 is chips', isBlindDenominated('3,346.00'), false);
    expect('and 9,600', isBlindDenominated('9,600'), false);
    /**
     * A bare "BB" is a label, not an amount.
     *
     * Column headings, tooltips and the blinds-up banner all say BB without
     * stating a figure in it. Matching those would flip the whole table into
     * blind units on the strength of a caption, so a digit is required.
     */
    expect('a bare BB label is not an amount', isBlindDenominated('BB'), false);
    expect('nor is an empty string', isBlindDenominated(''), false);
  }

  console.log('\nhow the panel writes an amount');
  {
    expect('chips abbreviate', formatAmount(3346, 'chips'), '3.3K');
    expect('small chip amounts do not', formatAmount(150, 'chips'), '150');
    /**
     * Blinds keep their decimal. 2 and 2.5 big blinds are different raises,
     * and the box the user types into is in blinds too.
     */
    expect('blinds keep a decimal', formatAmount(2.5, 'bb'), '2.5BB');
    expect('a whole number of blinds gets no false decimal', formatAmount(3, 'bb'), '3BB');
    expect('and blinds never abbreviate', formatAmount(1200, 'bb'), '1200BB');
    expect('chips are the default', formatAmount(150), '150');
  }

  console.log('\na table in chips reads exactly as it did');
  {
    mountTable(JSDOM, IN_CHIPS);
    expect('the mode is chips', readDisplayUnit(), 'chips');
    const blinds = readBlinds(readDisplayUnit());
    expect('the big blind still comes from the raise button', Math.round(blinds.bigBlind), 60);
    expect('the price is still the chip figure', readCostToCall('chips'), 150);
    expect('and the stack is still chips', readYourStack(), 9750);
  }

  console.log('\na table in blinds');
  {
    mountTable(JSDOM, IN_BLINDS);
    expect('the mode is blinds', readDisplayUnit(), 'bb');

    const blinds = readBlinds(readDisplayUnit());
    expect('the big blind is one', blinds.bigBlind, 1);
    expect('the small blind is half of it', blinds.smallBlind, 0.5);

    /**
     * The BB leaf is the amount here, not something to skip.
     *
     * `readAmountFromButton` filtered every leaf mentioning BB, which is
     * right in chips mode and leaves nothing at all in this one. The price
     * would have read 0, which `findContradictions` refuses — loud rather
     * than wrong, but a panel that declines every hand of a blinds-mode
     * table is no more use than one that lies about it.
     */
    expect('the price is the blind figure', readCostToCall('bb'), 1.5);
    expect('the stack is in blinds', readYourStack(), 97.5);
    expect('and so are the chips on the felt', readBetsOnTable(), 6.5);
  }

  console.log('\nthe blind level is never divided out of a blinds-mode table');
  {
    mountTable(JSDOM, IN_BLINDS);
    /**
     * This is the failure worth a test of its own. The raise button's
     * chips-to-blinds division is the authoritative source for the level in
     * chips mode, and running it here would hand back a blind level of 100
     * against stacks measured in 97.5 — so a 2.5bb open would be sized at
     * 250 blinds, twice the table's whole stack.
     */
    const blinds = readBlinds('bb');
    check('the level is the unit, not a division', blinds.bigBlind === 1,
      `got ${blinds.bigBlind}`);
    check('which is well under the stack read from the same table',
      blinds.bigBlind < readYourStack(), `${blinds.bigBlind} vs ${readYourStack()}`);
  }

  console.log('\nthe panel states its answer in the table’s own unit');
  {
    const advice = {
      action: 'raise', amount: 2.5, confidence: 70, equity: 60, potOdds: 30,
      handStrength: { category: 'Ace high', madeHand: 1, drawStrength: 0, relative: 'strong' },
      boardTexture: { summary: 'dry' },
      reasoning: ['because'],
      alternatives: [{ action: 'call', amount: 1.5, note: 'flatting' }],
    } as unknown as Advice;

    const inBlinds = renderAdvice(advice, 'bb');
    check('the raise is stated in blinds', inBlinds.includes('2.5BB'), inBlinds.slice(0, 200));
    check('and so is the alternative', inBlinds.includes('1.5BB'));

    /**
     * The same advice in chips mode rounds to whole chips, which is why the
     * unit has to travel with it: 2.5 chips is not a raise anyone makes, but
     * 2.5 blinds is the standard open.
     */
    const inChips = renderAdvice(advice, 'chips');
    check('chips mode rounds to whole chips', inChips.includes('>3<'), inChips.slice(0, 200));
    check('and says nothing about blinds', !inChips.includes('BB'));
  }

  console.log('\nend to end: a blinds-mode table produces advice, not a refusal');
  {
    /**
     * The whole point of the exercise. `findContradictions` compares the
     * price on the call button against the chips in front of the players, so
     * a table read in the wrong unit refuses rather than advising — which is
     * the guard working, and also indistinguishable from the feature being
     * broken. This asserts the other outcome.
     */
    mountTable(JSDOM, IN_BLINDS);
    const { GameStateScraper } = await import('../src/content/scraper/index');
    const state = new GameStateScraper().scrapeNow();
    check('the table reads', state !== null);
    if (state) {
      expect('and reads as blinds', state.displayUnit, 'bb');
      expect('the big blind is one', state.bigBlind, 1);
      expect('the price is 1.5 blinds', state.costToCall, 1.5);
      expect('our stack is in blinds', state.yourStack, 97.5);

      const problems = findContradictions(state);
      check('nothing about it contradicts itself', problems.length === 0,
        problems.join('; '));

      const advice = await new StrategyEngine().evaluate(state);
      check('so the engine gives real advice', advice.noAdvice !== true,
        advice.reasoning.join(' '));
      check('and sizes in blinds, not chips',
        advice.amount === undefined
        || (advice.amount > 0 && advice.amount <= state.yourStack + state.yourCurrentBet),
        `${advice.action} ${advice.amount} against a stack of ${state.yourStack}`);
      console.log(`       (it said ${advice.action}${
        advice.amount ? ' ' + formatAmount(advice.amount, 'bb') : ''})`);
    }
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
