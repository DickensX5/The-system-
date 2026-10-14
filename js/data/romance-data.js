// Romance quest content. Every suggestion is respectful, consent-aware, low-pressure and free.
import { seededRng, pick, shuffle } from '../utils/rng.js';

export const SUGGESTIONS = [
  { name: 'Practise a warm greeting', objective: 'Greet someone you meet today with eye contact and a genuine smile. No expectations of a reply.', xp: 5 },
  { name: 'Give a sincere compliment', objective: 'Say one specific, kind thing about someone\'s work, effort or style. Accept whatever response you get gracefully.', xp: 10 },
  { name: 'Listen first', objective: 'Have one conversation where you ask two open questions and listen without steering it back to yourself.', xp: 10 },
  { name: 'Write a kindness note', objective: 'Write a thoughtful note to a friend or family member to thank them for something real.', xp: 5 },
  { name: 'Reflect on a hard moment', objective: 'Write what felt awkward in a past interaction and one respectful thing you would do differently.', xp: 10 },
  { name: 'Practise a polite no', objective: 'Practise accepting a "no" or "not now" with a calm "okay, thanks". Rehearse it aloud twice.', xp: 10 },
  { name: 'Ask about their day', objective: 'Ask a friend how they are, then follow up on one thing they say. Do not pressure for details.', xp: 10 },
  { name: 'Be useful', objective: 'Offer one small, free, no-strings help to someone today (carry, share notes, hold a door).', xp: 15 },
  { name: 'Group hangout', objective: 'Join a group activity or event and talk with at least two people. Leave when you want to.', xp: 20 },
  { name: 'Invite with an easy out', objective: 'Invite a friend to something low-key, in a way that makes it equally easy to decline. Respect the answer.', xp: 20 },
  { name: 'Body-language check', objective: 'Practise relaxed posture and open body language for a full conversation, then note how it felt.', xp: 10 },
  { name: 'Learn their interest', objective: 'Ask a friend about a hobby of theirs and learn one new thing about it.', xp: 15 },
  { name: 'Self-care for confidence', objective: 'Do one thing that helps you feel your best today (grooming, a walk, a clean outfit).', xp: 5 },
  { name: 'Conversation practice', objective: 'Practise a 5-minute conversation with a friend, trying one new topic you have not talked about before.', xp: 15 },
];

// Hard safety rules for what a Romance quest may ask. Keyword filter + the written confirmation at completion.
const UNSAFE = /(stalk|follow (her|him|them)|spy|track (her|him|them)|surveil|secret(ly)? (watch|film|record)|ignore (her|his|their)? ?(no|refus)|won'?t take no|change (her|his|their) mind|pressure|guilt[- ]?trip|manipulat|force|coerc|harass|bomb(ard)?|keep (messag|text|call)|demand|make (her|him|them) (reply|love|jealous)|jealous|get (her|him|them) back|show up uninvited|private (photo|info)|password|phone number without|nude|sexting|threat)/i;
const MONEY = /(\bbuy\b|purchase|\bspend\b|\bpay\b|expensive|gift card|diamond|jewel|cost|dinner date at|\$|tsh\s*\d)/i;
export function checkQuestText(text) {
  if (UNSAFE.test(text)) return 'That sounds like it could pressure, track or manipulate someone. Romance quests must be respectful and low-pressure. Try something like listening, a kind note, or an invitation that is easy to decline.';
  if (MONEY.test(text)) return 'Romance quests must never require spending money. Choose a free action.';
  return null;
}

const QUIZ = [
  { prompt: 'Someone says they are not interested. What is the respectful response?', options: ['Accept it kindly and move on', 'Ask again until they agree', 'Ask their friends to convince them', 'Show up where they will be'], answer: 0 },
  { prompt: 'You message someone and they do not reply. What do you do?', options: ['Give them space and do not chase', 'Send more messages until they answer', 'Check where they are', 'Call repeatedly'], answer: 0 },
  { prompt: 'Which is genuine consent?', options: ['A clear, willing yes that can be withdrawn any time', 'Silence', 'A yes obtained by pressure', 'A maybe that you keep asking about'], answer: 0 },
  { prompt: 'A good compliment is...', options: ['Specific, sincere and with no strings attached', 'Meant to get something in return', 'Only about appearance', 'Repeated until they respond'], answer: 0 },
  { prompt: 'You feel nervous before talking to someone. The healthiest approach?', options: ['Breathe, be yourself, accept any outcome', 'Plan a way to make them feel guilty if they refuse', 'Avoid people forever', 'Pretend to be someone else'], answer: 0 },
  { prompt: 'Which action respects privacy?', options: ['Not sharing their messages or photos without permission', 'Posting their screenshots publicly', 'Reading their phone', 'Sharing their location'], answer: 0 },
  { prompt: 'Someone looks uncomfortable in a conversation. You should...', options: ['Ease off and give them room to leave', 'Keep going until they relax', 'Stand in their way', 'Joke harder'], answer: 0 },
];
export function romancePenaltyChallenge(tier, seed) {
  const rng = seededRng('rpen:' + seed);
  const n = tier === 'minor' ? 0 : tier === 'intermediate' ? 3 : 4;
  const qs = shuffle(QUIZ, rng).slice(0, n).map((q, i) => {
    const order = shuffle(q.options.map((o, j) => ({ o, j })), rng);
    return { id: `${seed}#${i + 1}`, type: 'choice', prompt: q.prompt, options: order.map((x) => x.o), answer: order.findIndex((x) => x.j === q.answer) };
  });
  const words = tier === 'severe' ? 40 : 20;
  return {
    intro: tier === 'minor' ? 'Write a short, honest reflection. No quiz needed.' : tier === 'intermediate' ? 'Answer the respect quiz (2 of 3), then write a short reflection.' : 'Answer the respect quiz (all 4), then write a longer reflection.',
    prompt: 'Reflection: what happened with the quest you missed, and what respectful, low-pressure step could you take next time? (Do not mention anything that pressures another person.)',
    questions: qs, pass: tier === 'minor' ? 0 : tier === 'intermediate' ? 2 : 4, reflectionWords: words,
  };
}
