// Question bank for the Intelligence quest. All answers are verified in JavaScript (no self-grading).
// Types: 'choice' (answer = index), 'number' (answer = number). Daily content is seeded by date, so it is stable across reloads.
import { seededRng, pick, randInt, shuffle } from '../utils/rng.js';
import { parseKey } from '../utils/dates.js';

const L = (prompt, options, answer, explain, hard = false) => ({ cat: 'Logic and reasoning', type: 'choice', prompt, options, answer, explain, hard });
const N = (prompt, answer, explain, hard = false) => ({ cat: 'Logic and reasoning', type: 'number', prompt, answer, explain, hard });

export const LOGIC = [
  L('All bloops are razzies. All razzies are lazzies. Which must be true?', ['All bloops are lazzies', 'All lazzies are bloops', 'Some lazzies are not razzies', 'No bloops are lazzies'], 0, 'Chain the two statements: bloops ⊂ razzies ⊂ lazzies.'),
  L('If it rains, the match is cancelled. The match was NOT cancelled. What follows?', ['It did not rain', 'It rained', 'The match was cancelled', 'Nothing follows'], 0, 'Contrapositive: no cancellation means no rain.'),
  L('Three boxes are labelled Apples, Oranges and Mixed, and ALL labels are wrong. You take one fruit from the box labelled Mixed and it is an apple. What is in the box labelled Oranges?', ['Mixed fruit', 'Apples', 'Oranges', 'Cannot be told'], 0, 'The "Mixed" box must be apples; "Oranges" cannot be oranges, so it is the mixed box.', true),
  L('A is taller than B. C is shorter than B. D is taller than A. Who is the shortest?', ['A', 'B', 'C', 'D'], 2, 'Order: D > A > B > C.'),
  L('Which does not belong: Triangle, Square, Circle, Cube?', ['Triangle', 'Square', 'Circle', 'Cube'], 3, 'The cube is three-dimensional; the others are flat shapes.'),
  L('Tom is faster than Sam. Sam is faster than Ria. Which is definitely true?', ['Tom is faster than Ria', 'Ria is faster than Tom', 'Sam is the slowest', 'Tom and Ria are equal'], 0, 'Transitivity.'),
  L('All A are B, and some B are C. Which must be true?', ['Some A are C', 'No A are C', 'It cannot be determined', 'All C are A'], 2, 'The C members of B may not be the A members.', true),
  N('A bat and a ball cost 110 cents together. The bat costs 100 cents more than the ball. How many cents does the ball cost?', 5, 'ball + (ball + 100) = 110, so ball = 5.', true),
  N('5 machines make 5 widgets in 5 minutes. How many minutes do 100 machines need to make 100 widgets?', 5, 'Each machine makes one widget per 5 minutes.', true),
  N('Lily pads double in area every day and cover a lake in 48 days. On which day is HALF the lake covered?', 47, 'One day before it is fully covered.', true),
  L('Which is the odd one out: 2, 3, 5, 9, 11?', ['2', '5', '9', '11'], 2, '9 is the only non-prime.'),
  L('Today is Wednesday. What day will it be in 100 days?', ['Thursday', 'Friday', 'Saturday', 'Wednesday'], 1, '100 mod 7 = 2, so Wednesday + 2 = Friday.'),
  N('A farmer has 17 sheep. All but 9 die. How many are left?', 9, '"All but 9" means 9 survive.'),
  L('"Every student passed." Which single fact proves this statement false?', ['One student failed', 'One student passed', 'Most students passed', 'Nobody took the exam'], 0, 'One counterexample is enough.'),
  L('You overtake the runner in second place. What place are you in now?', ['First', 'Second', 'Third', 'Last'], 1, 'You take the second place spot.'),
  L('Book is to Reading as Fork is to ...', ['Eating', 'Cooking', 'Kitchen', 'Metal'], 0, 'Tool to the action it is used for.'),
  L('Which statement is the contrapositive of "If it is a square, it has four sides"?', ['If it does not have four sides, it is not a square', 'If it has four sides, it is a square', 'If it is not a square, it has no sides', 'Squares have no sides'], 0, 'Negate and swap both parts.'),
  L('Six people each shake hands once with every other person. How many handshakes?', ['12', '15', '30', '36'], 1, '6 × 5 / 2 = 15.', true),
];

const PASSAGES = [
  { title: 'Sleep and memory', text: 'During sleep the brain replays recent experiences. This replay appears to strengthen connections that matter and let weaker ones fade. People who sleep after learning usually recall more than people who stay awake for the same period.', q: 'According to the passage, sleep after learning mainly helps with:', options: ['Recalling what was learned', 'Learning faster while asleep', 'Forgetting everything', 'Needing less practice forever'], answer: 0 },
  { title: 'Compound interest', text: 'Simple interest pays only on the original amount. Compound interest pays on the original amount plus the interest already earned, so growth speeds up the longer money is left alone.', q: 'What makes compound interest grow faster over time?', options: ['Interest is earned on earlier interest', 'The bank raises the rate yearly', 'Only the original amount counts', 'Fees are removed'], answer: 0 },
  { title: 'Deliberate practice', text: 'Repeating a skill you already do well builds comfort, not progress. Improvement usually needs tasks that sit just beyond current ability, quick feedback, and a willingness to repeat the parts that fail.', q: 'Which activity best matches deliberate practice?', options: ['Repeating the hardest part you keep getting wrong', 'Replaying songs you already know', 'Reading about the skill without trying it', 'Practising only when motivated'], answer: 0 },
  { title: 'Base rates', text: 'A test that is 90% accurate sounds reliable. But if only 1 person in 1,000 has a condition, most positive results will still be false alarms, because healthy people vastly outnumber affected people.', q: 'Why can a 90% accurate test still give mostly false alarms?', options: ['The condition is very rare', 'The test is secretly broken', 'Healthy people never test positive', 'Accuracy cannot be measured'], answer: 0 },
  { title: 'Rubber-duck debugging', text: 'Explaining a bug aloud, line by line, to an inanimate object often reveals the mistake. Putting vague assumptions into precise words forces gaps in your reasoning to show.', q: 'Why does explaining code aloud help find bugs?', options: ['Precise wording exposes faulty assumptions', 'The duck knows the answer', 'Speaking makes code run faster', 'It replaces testing'], answer: 0 },
  { title: 'Opportunity cost', text: 'Every choice excludes alternatives. The opportunity cost of an hour spent on one task is the best other use of that hour, which is why "free" activities are rarely free.', q: 'What is opportunity cost?', options: ['The value of the best alternative you give up', 'The price printed on a product', 'Interest on a loan', 'A tax on spending'], answer: 0 },
];
const STRATEGY = (rng) => {
  const g = randInt(40, 90, rng) * 10, y = randInt(2, 8, rng) * 100 + randInt(2, 8, rng) * 100, p = randInt(3, 8, rng) * 10;
  const ev = (y * p) / 100;
  const correct = ev > g ? 1 : 0;
  return { cat: 'Strategy and decision-making', type: 'choice', prompt: `Option A pays ${g} for sure. Option B pays ${y} with a ${p}% chance (otherwise 0). Which has the higher expected value?`, options: [`A (${g})`, `B (${y} × ${p}% = ${ev})`, 'They are equal', 'Cannot be compared'], answer: ev === g ? 2 : correct, explain: `Expected value of B = ${y} × ${p / 100} = ${ev}; A = ${g}.` };
};
const SEQ = (rng, hard = false) => {
  const t = randInt(0, hard ? 4 : 3, rng);
  let seq, ans, why;
  if (t === 0) { const a = randInt(2, 15, rng), d = randInt(2, 9, rng); seq = [0, 1, 2, 3, 4].map((i) => a + d * i); ans = a + 5 * d; why = `Add ${d} each time.`; }
  else if (t === 1) { const a = randInt(1, 5, rng), r = randInt(2, 4, rng); seq = [0, 1, 2, 3].map((i) => a * r ** i); ans = a * r ** 4; why = `Multiply by ${r}.`; }
  else if (t === 2) { const k = randInt(0, 6, rng); seq = [1, 2, 3, 4, 5].map((i) => i * i + k); ans = 36 + k; why = `n² + ${k}.`; }
  else if (t === 3) { const a = randInt(1, 6, rng), b = randInt(1, 6, rng); seq = [a, b, a + b, a + 2 * b, 2 * a + 3 * b]; ans = 3 * a + 5 * b; why = 'Each term is the sum of the previous two.'; }
  else { const a = randInt(1, 9, rng), d = randInt(1, 4, rng), e = randInt(1, 3, rng); seq = [0, 1, 2, 3, 4].map((i) => a + d * i + e * i * (i - 1)); ans = a + 5 * d + e * 20; why = 'The differences themselves grow by a constant.'; }
  return { cat: 'Logic and reasoning', type: 'number', prompt: `What number comes next? ${seq.join(', ')}, ?`, answer: ans, explain: why, hard };
};
const TECH = (rng) => {
  const k = randInt(0, 3, rng);
  if (k === 0) { const n = randInt(5, 31, rng); return { cat: 'Technical intelligence', type: 'number', prompt: `Convert the binary number ${n.toString(2)} to decimal.`, answer: n, explain: 'Add the place values of each 1 bit.' }; }
  if (k === 1) { const n = randInt(9, 60, rng); return { cat: 'Technical intelligence', type: 'number', prompt: `How many 1 bits are in the binary form of ${n}? (${n} = ${n.toString(2)})`, answer: n.toString(2).split('1').length - 1, explain: `Binary ${n.toString(2)}.` }; }
  if (k === 2) { const a = randInt(11, 99, rng), b = randInt(3, 9, rng); return { cat: 'Technical intelligence', type: 'number', prompt: `In code, what does ${a} % ${b} evaluate to?`, answer: a % b, explain: 'The % operator returns the remainder.' }; }
  const m = randInt(2, 5, rng), arr = [1, 2, 3, 4].map((x) => x * m);
  const right = arr.join('-');
  const opts = shuffle([right, arr.slice().reverse().join('-'), arr.map((x) => x + m).join('-'), arr.join('')], rng);
  return { cat: 'Technical intelligence', type: 'choice', prompt: `What does [1,2,3,4].map(x => x * ${m}).join('-') return?`, options: opts, answer: opts.indexOf(right), explain: 'map multiplies each element, join glues them with "-".' };
};
const COMP = (rng) => { const p = pick(PASSAGES, rng); return { cat: 'Learning and comprehension', type: 'choice', passage: p.title + ': ' + p.text, prompt: p.q, options: p.options, answer: p.answer, explain: 'Re-read the passage for the key idea.' }; };
const REFLECT_Q = null; // reflection quests are custom quests (written takeaway required)

function dayNumber(dateKey) { return Math.floor(parseKey(dateKey).getTime() / 86400000); }

/** The 3 standard daily questions for a date. Deterministic: same date => same questions. */
export function dailyQuestions(dateKey) {
  const n = dayNumber(dateKey);
  const rng = seededRng('daily:' + dateKey);
  const q1 = { ...LOGIC[n % LOGIC.length] };
  const q2 = n % 2 === 0 ? SEQ(rng) : TECH(rng);
  const third = [COMP, STRATEGY, TECH][n % 3];
  const q3 = third(rng);
  return [q1, q2, q3].map((q, i) => ({ ...q, id: `${dateKey}#${i + 1}` }));
}

/** Penalty challenge content, deterministic per penalty id. */
export function penaltyChallenge(tier, seed) {
  const rng = seededRng('pen:' + seed);
  if (tier === 'minor') {
    const q = rng() < 0.5 ? SEQ(rng) : { ...pick(LOGIC.filter((x) => !x.hard), rng) };
    return { intro: 'Solve a puzzle similar to the one you missed.', questions: [{ ...q, id: `${seed}#1` }], pass: 1, explainWords: 0 };
  }
  if (tier === 'intermediate') {
    const c = COMP(rng);
    return { intro: 'Review this topic, then complete the quiz (2 of 3 correct).', topic: c.passage, questions: [c, SEQ(rng), { ...pick(LOGIC.filter((x) => !x.hard), rng) }].map((q, i) => ({ ...q, id: `${seed}#${i + 1}` })), pass: 2, explainWords: 0 };
  }
  const hardLogic = shuffle(LOGIC.filter((x) => x.hard), rng).slice(0, 2);
  return { intro: 'A harder challenge: answer all three correctly, then explain your reasoning in your own words (25+ words).', questions: [SEQ(rng, true), ...hardLogic].map((q, i) => ({ ...q, id: `${seed}#${i + 1}` })), pass: 3, explainWords: 25 };
}

export function checkAnswer(q, given) {
  if (q.type === 'choice') return Number(given) === q.answer;
  const n = Number(String(given).trim().replace(/,/g, ''));
  return Number.isFinite(n) && n === q.answer;
}
