/**
 * The call button states its amount twice. Only one of them is chips.
 *
 * Observed in play at 50/100, facing a bet of 400 with 250 already in: the
 * button read "Call 150" and the scraper reported a cost to call of 1.5.
 *
 * duel.com puts the big-blind conversion beside the chip figure — 150 chips
 * is 1.5BB — and `readCostToCall` took `.poker-btn__amount` flatly. The
 * blind-denominated figure comes first, and `parseChipValue` takes the first
 * number in a string by design, so the price came back a hundredfold too
 * small.
 *
 * `docs/duel-dom.md` had already recorded this shape for the RAISE button,
 * whose text runs together as `Raise | All in | Raise | 72.2BB | 3,609.00 |
 * 100`, and said in as many words that its children have to be read
 * separately. The call button was never checked for the same thing, and the
 * test fixture did not render the BB element at all — so the markup under
 * test was missing the very element that caused the bug.
 *
 * This is the misread behind the live reports of folding aces, calling off
 * with 83o and raising below the table minimum: a price that small makes
 * every hand look free, and the legal minimum raise is computed from the
 * price. It was caught by `findContradictions` comparing the button against
 * the chips in front of the players, which is the comparison working.
 */
import { JSDOM } from 'jsdom';
import { mountTable } from './helpers/duel-table';
import { readCostToCall } from '../src/content/scraper/table-reader';

let failures = 0;
function expect(name: string, actual: unknown, wanted: unknown): void {
  const ok = actual === wanted;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `: expected ${wanted}, got ${actual}`}`);
  if (!ok) failures++;
}

function main(): void {
  console.log('\nthe live hand: Call 150 at 50/100');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'],
      board: [],
      pot: '24',
      seats: [
        { name: 'Villain', stack: '9,126' },
        { name: 'Hero', stack: '10,200', isSelf: true, isActor: true },
      ],
      // Exactly what was on screen: the conversion first, then the chips
      actions: { fold: true, call: 'Call', callBB: '1.5BB', callAmount: '150.00', raise: true },
    });
    expect('the price is the chips, not the blinds', readCostToCall(), 150);
  }

  console.log('\nthe chip figure is read whichever way round the button lists them');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'], board: [], pot: '24',
      seats: [
        { name: 'Villain', stack: '9,126' },
        { name: 'Hero', stack: '10,200', isSelf: true, isActor: true },
      ],
      actions: { fold: true, call: 'Call', callAmount: '150.00', callBB: '1.5BB', raise: true },
    });
    expect('still the chips', readCostToCall(), 150);
  }

  console.log('\nand a button with no conversion still works');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'], board: [], pot: '24',
      seats: [
        { name: 'Villain', stack: '9,126' },
        { name: 'Hero', stack: '10,200', isSelf: true, isActor: true },
      ],
      actions: { fold: true, call: 'Call', callAmount: '150.00', raise: true },
    });
    expect('the plain amount is read', readCostToCall(), 150);
  }

  console.log('\na bigger price with thousands separators');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'], board: [], pot: '2,400',
      seats: [
        { name: 'Villain', stack: '6,000' },
        { name: 'Hero', stack: '7,299', isSelf: true, isActor: true },
      ],
      actions: { fold: true, call: 'Call', callBB: '33.5BB', callAmount: '3,346.00', raise: true },
    });
    expect('read in full', readCostToCall(), 3346);
  }

  console.log('\nchecking is still free, and still says so');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'], board: ['2c', '9d', 'Ks'], pot: '400',
      seats: [
        { name: 'Villain', stack: '9,126' },
        { name: 'Hero', stack: '10,200', isSelf: true, isActor: true },
      ],
      // No amount at all when the button says Check — the text decides
      actions: { fold: true, call: 'Check', raise: true },
    });
    expect('a check costs nothing', readCostToCall(), 0);
  }

  console.log('\nand with no button at all there is no price');
  {
    mountTable(JSDOM, {
      hole: ['Ah', '7c'], board: [], pot: '24',
      seats: [
        { name: 'Villain', stack: '9,126', isActor: true },
        { name: 'Hero', stack: '10,200', isSelf: true },
      ],
    });
    expect('nothing is being asked of us', readCostToCall(), 0);
  }
}

main();
if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall price-in-blinds tests passed');
