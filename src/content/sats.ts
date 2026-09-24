/**
 * SATs-style practice for Year 6 (England), modelled on the KS2 tests:
 * - Spelling: like the grammar, punctuation and spelling paper 2, the word is
 *   read aloud in a sentence and the pupil writes it in the gap. Words are
 *   the Years 5 and 6 statutory word list from English Appendix 1 of the
 *   national curriculum (© Crown copyright 2013, used under the Open
 *   Government Licence v3.0). The sentences were written for Schoolzone.
 * - Arithmetic: like maths paper 1 (the real paper is 36 questions in 30
 *   minutes, about 50 seconds each), drawn from the app's own generators.
 * - Reading: one text and all its questions, marked at the end.
 * These are practice papers written for Schoolzone, not real past papers,
 * and the scores are not SATs scaled scores.
 */
import type { Level, Profile, Question, SatsResult } from '../brain/types';
import { makeQuestion } from '.';
import { shuffle } from './bank';
import { PASSAGES, readingQuestions } from './reading';

/** [word, a sentence that uses it]. The word appears in the sentence exactly as written. */
export const DICTATION: [string, string][] = [
  ['accommodate', 'The hotel can accommodate two hundred guests.'],
  ['accompany', 'Will you accompany me to the shops?'],
  ['according', 'According to the map, the castle is nearby.'],
  ['achieve', 'If you practise every day, you can achieve your goal.'],
  ['aggressive', 'The dog became aggressive when a stranger came near.'],
  ['amateur', 'My uncle is an amateur photographer.'],
  ['ancient', 'We visited an ancient Roman fort.'],
  ['apparent', 'It was apparent that nobody had tidied up.'],
  ['appreciate', 'I really appreciate your help.'],
  ['attached', 'A note was attached to the present.'],
  ['available', 'Tickets are available at the door.'],
  ['average', 'The average age of the team is eleven.'],
  ['awkward', 'There was an awkward silence after the joke.'],
  ['bargain', 'The bike was a bargain at only ten pounds.'],
  ['bruise', 'I got a bruise on my knee when I fell.'],
  ['category', 'Which category does a whale belong to?'],
  ['cemetery', 'The old cemetery is next to the church.'],
  ['committee', 'The school council is a committee of pupils.'],
  ['communicate', 'Dolphins communicate using clicks and whistles.'],
  ['community', 'The whole community helped to clean the park.'],
  ['competition', 'Our class won the poetry competition.'],
  ['conscience', 'My conscience told me to own up.'],
  ['conscious', 'She was conscious of everyone looking at her.'],
  ['controversy', 'The new rule caused a lot of controversy.'],
  ['convenience', 'For your convenience, the shop opens early.'],
  ['correspond', 'I correspond with a pen pal in France.'],
  ['criticise', 'It is easy to criticise but harder to help.'],
  ['curiosity', 'Curiosity made the cat look inside the box.'],
  ['definite', 'We need a definite answer by Friday.'],
  ['desperate', 'After the long walk, we were desperate for a drink.'],
  ['determined', 'She was determined to finish the race.'],
  ['develop', 'Tadpoles develop into frogs.'],
  ['dictionary', 'Look the word up in the dictionary.'],
  ['disastrous', 'Forgetting the tent was a disastrous mistake.'],
  ['embarrass', 'Please don\'t embarrass me in front of my friends.'],
  ['environment', 'We must look after the environment.'],
  ['equipment', 'Put the PE equipment back in the cupboard.'],
  ['especially', 'I love fruit, especially strawberries.'],
  ['exaggerate', 'Don\'t exaggerate: it wasn\'t a million spiders!'],
  ['excellent', 'That was an excellent piece of writing.'],
  ['existence', 'Scientists argue about the existence of life on other planets.'],
  ['explanation', 'The teacher gave a clear explanation.'],
  ['familiar', 'Her face looked familiar.'],
  ['foreign', 'Learning a foreign language is fun.'],
  ['forty', 'There are forty children in the choir.'],
  ['frequently', 'Buses run frequently in the city.'],
  ['government', 'The government made a new law.'],
  ['guarantee', 'I can\'t guarantee it will be sunny.'],
  ['harass', 'It is wrong to harass other people online.'],
  ['hindrance', 'The heavy bag was a hindrance on the hike.'],
  ['identity', 'The spy kept his identity secret.'],
  ['immediately', 'Come inside immediately; it\'s pouring!'],
  ['individual', 'Each individual pupil gets a certificate.'],
  ['interfere', 'Please don\'t interfere with the experiment.'],
  ['interrupt', 'It is rude to interrupt someone who is speaking.'],
  ['language', 'Welsh is a language spoken in Wales.'],
  ['leisure', 'The leisure centre has a new pool.'],
  ['lightning', 'A flash of lightning lit up the sky.'],
  ['marvellous', 'We had a marvellous day at the seaside.'],
  ['mischievous', 'The mischievous puppy chewed my slipper.'],
  ['muscle', 'Your heart is a muscle.'],
  ['necessary', 'Is it necessary to bring a coat?'],
  ['neighbour', 'Our neighbour feeds our cat when we are away.'],
  ['nuisance', 'The buzzing fly was a nuisance.'],
  ['occupy', 'Puzzles occupy my little brother for hours.'],
  ['occur', 'Earthquakes rarely occur in Britain.'],
  ['opportunity', 'This trip is a great opportunity to learn.'],
  ['parliament', 'Laws are made in Parliament.'],
  ['persuade', 'Can I persuade you to join the team?'],
  ['physical', 'Swimming is good physical exercise.'],
  ['prejudice', 'We should treat everyone fairly, without prejudice.'],
  ['privilege', 'It was a privilege to meet the author.'],
  ['profession', 'Teaching is a rewarding profession.'],
  ['programme', 'My favourite programme is on tonight.'],
  ['pronunciation', 'Check the pronunciation of the French words.'],
  ['queue', 'We waited in a long queue for the ride.'],
  ['recognise', 'I didn\'t recognise you with your new haircut.'],
  ['recommend', 'I recommend this book to everyone.'],
  ['relevant', 'Only include facts that are relevant.'],
  ['restaurant', 'We went to a restaurant for Mum\'s birthday.'],
  ['rhyme', '"Cat" and "hat" rhyme.'],
  ['rhythm', 'Clap your hands to the rhythm of the song.'],
  ['sacrifice', 'Giving up his seat was a small sacrifice.'],
  ['secretary', 'The school secretary answered the phone.'],
  ['shoulder', 'She carried the bag on her shoulder.'],
  ['signature', 'Please write your signature at the bottom.'],
  ['sincerely', 'I sincerely hope you feel better soon.'],
  ['soldier', 'The soldier stood guard at the gate.'],
  ['stomach', 'My stomach was rumbling before lunch.'],
  ['sufficient', 'Is there sufficient food for everyone?'],
  ['suggest', 'I suggest we leave early to miss the traffic.'],
  ['symbol', 'The heart is a symbol of love.'],
  ['system', 'The solar system has eight planets.'],
  ['temperature', 'The temperature dropped below freezing.'],
  ['thorough', 'Give your room a thorough clean.'],
  ['twelfth', 'My birthday is on the twelfth of May.'],
  ['variety', 'The shop sells a variety of sweets.'],
  ['vegetable', 'A carrot is a vegetable.'],
  ['vehicle', 'A tractor is a farm vehicle.'],
  ['yacht', 'The yacht sailed across the bay.'],
];

/** The sentence with the word replaced by a gap, as on the SATs paper. */
export function gapped(word: string, sentence: string): string {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase());
  return i < 0 ? sentence : `${sentence.slice(0, i)}________${sentence.slice(i + word.length)}`;
}

/** What is read aloud: the word, the sentence, then the word again. */
export const dictationScript = (word: string, sentence: string) => `The word is: ${word}. ${sentence} The word is: ${word}.`;

/** Spelling is marked exactly (ignoring capitals and spaces). American -ize spellings get a gentle note. */
export function markSpelling(word: string, given: string): { correct: boolean; note?: string } {
  const g = given.trim().toLowerCase();
  if (g === word) return { correct: true };
  if (word.endsWith('ise') && g === `${word.slice(0, -3)}ize`) return { correct: false, note: 'That\'s the American spelling. Schoolzone uses British spelling: -ise.' };
  return { correct: false };
}

export type SatsKind = 'spelling' | 'arithmetic' | 'reading';
export const SATS_XP = 30;
export const SPELLING_TEST_LENGTH = 10;
export const ARITHMETIC_LENGTH = 12;
/** The real arithmetic paper: 36 questions in 30 minutes. */
export const ARITHMETIC_PACE_SECONDS = 50;

/** Words for a spelling test: ones this child got wrong before come first, then words not tried yet. */
export function spellingTest(profile: Profile, rng: () => number): [string, string][] {
  const history = (profile.sats ?? []).filter((r) => r.kind === 'spelling').flatMap((r) => r.items);
  const lastResult = new Map<string, boolean>();
  for (const it of history) lastResult.set(it.id, it.correct);
  const wrong = DICTATION.filter(([w]) => lastResult.get(w) === false);
  const unseen = DICTATION.filter(([w]) => !lastResult.has(w));
  const right = DICTATION.filter(([w]) => lastResult.get(w) === true);
  const shuffled = <T>(xs: T[]) => xs.map((x) => [rng(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  return [...shuffled(wrong), ...shuffled(unseen), ...shuffled(right)].slice(0, SPELLING_TEST_LENGTH);
}

/** Words to learn: wrong the last time they were tested. */
export function wordsToLearn(profile: Profile): string[] {
  const last = new Map<string, boolean>();
  for (const r of (profile.sats ?? []).filter((x) => x.kind === 'spelling')) for (const it of r.items) last.set(it.id, it.correct);
  return [...last].filter(([, ok]) => !ok).map(([w]) => w);
}

/** Skills on the arithmetic paper, and the levels used for them. */
const ARITHMETIC: [string, Level[]][] = [
  ['addition', [4, 5]], ['subtraction', [4, 5]], ['multiplication', [4, 5]], ['division', [4, 5]],
  ['long-multiplication-division', [3, 4, 5]], ['order-of-operations', [3, 4]], ['fractions-y6', [2, 3, 4]],
  ['decimals-percentages', [2, 3, 4]], ['negative-numbers', [3, 4]],
];

export function arithmeticPaper(rng: () => number): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < ARITHMETIC_LENGTH; i++) {
    const [skill, levels] = ARITHMETIC[i % ARITHMETIC.length];
    const level = levels[Math.floor(rng() * levels.length)];
    out.push(makeQuestion(skill, level, out.map((q) => q.id), rng));
  }
  // Easier first, as on the real paper.
  return out.sort((a, b) => a.level - b.level);
}

/** A reading paper: one text and all its questions, in the order written, with the choices shuffled. */
export function readingPaper(passageId: string, rng: () => number = Math.random): Question[] {
  return readingQuestions().filter((q) => q.passageId === passageId).map((q) => ({ ...q, choices: shuffle(q.choices!, rng) }));
}

/** The next text to read: one this child hasn't done yet, if any. */
export function nextPassage(profile: Profile): string {
  const done = new Set((profile.sats ?? []).filter((r) => r.kind === 'reading').map((r) => r.passageId));
  return (PASSAGES.find((p) => !done.has(p.id)) ?? PASSAGES[(profile.sats ?? []).length % PASSAGES.length]).id;
}

export const satsScore = (r: SatsResult) => ({ correct: r.items.filter((i) => i.correct).length, total: r.items.length });
