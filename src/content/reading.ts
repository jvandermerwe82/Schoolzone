/**
 * Year 6 reading comprehension, in the style of the KS2 English reading test.
 *
 * Every passage was written for Schoolzone (no copyrighted texts). Each
 * question is tagged with the reading "content domain" it tests, from the
 * Standards and Testing Agency's KS2 English reading test framework:
 *   2a word meaning in context · 2b retrieve information · 2c summarise
 *   2d inference · 2e prediction · 2f structure and how parts fit together
 *   2g how word choice adds meaning · 2h comparisons within the text
 *
 * Facts in the non-fiction passages were checked against more than one
 * source (e.g. London Museum, London Fire Brigade and The Monument for the
 * Great Fire of London). Levels are this app's judgement of difficulty.
 */
import type { Level, Question } from '../brain/types';

export type Domain = '2a' | '2b' | '2c' | '2d' | '2e' | '2f' | '2g' | '2h';

export const DOMAIN_NAMES: Record<Domain, string> = {
  '2a': 'Word meanings',
  '2b': 'Finding information',
  '2c': 'Summarising',
  '2d': 'Inference',
  '2e': 'Prediction',
  '2f': 'How the text is organised',
  '2g': 'Word choices',
  '2h': 'Comparing',
};

export interface Passage {
  id: string;
  title: string;
  kind: 'Story' | 'Information' | 'Poem' | 'Letter';
  /** Paragraphs (or verses) separated by blank lines. */
  text: string;
}

/** [level, domain, question, answer, wrong choices, explanation, tags: wrong choice → mistake pattern]. */
type ReadingRow = [Level, Domain, string, string, string[], string, Record<string, string>?];

// Mistake patterns in reading answers (see brain/misconceptions.ts).
const NOT_IN_TEXT = 'rd-not-in-text';
const WORD_MATCH = 'rd-word-match';
const EVERYDAY_MEANING = 'rd-everyday-meaning';
const PART_NOT_WHOLE = 'rd-part-not-whole';

export const PASSAGES: (Passage & { questions: ReadingRow[] })[] = [
  {
    id: 'keeper',
    title: 'The Keeper\'s Daughter',
    kind: 'Story',
    text: `The storm had been building all afternoon. By the time Isla climbed the last of the hundred and twelve steps, the windows of the lamp room were rattling in their frames like loose teeth. Below her, the sea hurled itself at the rocks, then drew back, gathering strength for the next attack.

Her father had gone to the mainland that morning to fetch a new part for the lamp. "Back by six," he had promised, ruffling her hair. It was now half past seven, and the little ferry had not returned.

Isla knew what she had to do. She had watched her father light the great lamp a thousand times, though she had never been allowed to touch the brass handle herself. Her fingers trembled as she wound the mechanism, counting each turn under her breath exactly as he did: "Twenty-one, twenty-two, twenty-three."

With a low hum, the lamp began to turn. A beam of white light swept across the water, once, twice, three times. Somewhere out in the darkness, a horn sounded: three short blasts. Isla pressed her face to the cold glass and, for the first time that evening, she smiled.`,
    questions: [
      [1, '2b', 'How many steps did Isla climb to reach the lamp room?', '112', ['100', '23', '1,000'],
        'The first paragraph says she climbed "the last of the hundred and twelve steps".', { '23': WORD_MATCH, '1,000': WORD_MATCH }],
      [1, '2b', 'Why had Isla\'s father gone to the mainland?', 'To fetch a new part for the lamp', ['To buy food for dinner', 'To get away from the storm', 'To visit Isla\'s school'],
        'Paragraph 2: "to fetch a new part for the lamp".', { 'To buy food for dinner': NOT_IN_TEXT, 'To get away from the storm': NOT_IN_TEXT }],
      [2, '2a', '"The sea hurled itself at the rocks." Which word is closest in meaning to "hurled"?', 'threw', ['rolled', 'whispered', 'floated'],
        'To hurl something is to throw it hard. The writer makes the sea sound violent.'],
      [3, '2d', 'Why did Isla\'s fingers tremble as she wound the mechanism?', 'She was nervous because she had never done it herself before.',
        ['She was angry with her father.', 'The brass handle was hot.', 'She was excited about going to the mainland.'],
        'The text says she "had never been allowed to touch the brass handle herself", and her father was late in a storm: she is nervous.',
        { 'She was angry with her father.': NOT_IN_TEXT, 'The brass handle was hot.': NOT_IN_TEXT }],
      [3, '2g', 'The windows were rattling "like loose teeth". What does this comparison suggest?', 'The windows were shaking so much they seemed ready to fall out.',
        ['The windows were white and shiny.', 'Isla had toothache.', 'The windows were small.'],
        'Loose teeth wobble and might fall out. The simile shows how hard the storm was shaking the windows.', { 'Isla had toothache.': EVERYDAY_MEANING }],
      [4, '2d', 'What does the horn sounding three short blasts most likely mean?', 'A boat out at sea has seen the light and is signalling back.',
        ['The storm is over.', 'Isla\'s father is cross with her.', 'The lamp has broken again.'],
        'The horn answers the three sweeps of light, and Isla smiles for the first time: a boat, probably the ferry, has seen it.', { 'The storm is over.': NOT_IN_TEXT }],
      [4, '2c', 'Which sentence best sums up the whole passage?', 'When her father is late, Isla bravely lights the lamp on her own to guide a boat through the storm.',
        ['Isla climbs a lighthouse to watch a storm.', 'Isla\'s father teaches her how to light the lamp.', 'A ferry sinks in a storm.'],
        'A summary covers the whole passage, not just one part. The first choice only describes the first paragraph.',
        { 'Isla climbs a lighthouse to watch a storm.': PART_NOT_WHOLE, 'A ferry sinks in a storm.': NOT_IN_TEXT }],
      [5, '2f', 'Why does the writer include her father\'s promise, "Back by six", in paragraph 2?', 'To show he is late, which builds worry and explains why Isla must act.',
        ['To tell us what time the story starts.', 'To show that her father is always on time.', 'To describe the weather.'],
        'Straight after the promise we learn it is half past seven. The promise makes his lateness, and the danger, clear.'],
      [5, '2e', 'What is most likely to happen next?', 'Isla\'s father arrives safely on the ferry.',
        ['Isla switches off the lamp and goes to bed.', 'Isla swims to the mainland.', 'The lighthouse falls into the sea.'],
        'The horn answering the light, and Isla smiling, suggest the ferry has seen the light and will reach safety.'],
    ],
  },
  {
    id: 'great-fire',
    title: 'The Great Fire of London',
    kind: 'Information',
    text: `In the early hours of Sunday 2 September 1666, a fire broke out in a bakery on Pudding Lane in the City of London. The baker, Thomas Farriner, had gone to bed believing his oven was safe. Within hours, the flames had spread to the houses around it.

At the time, London's streets were narrow and crowded. Most houses were built from timber, and their upper floors jutted out over the street, so that buildings on opposite sides almost touched. The summer had been long and dry, and a strong wind from the east blew the fire from one street to the next.

People tried to stop the fire with leather buckets of water and hand-held squirts, but these were no match for the blaze. Eventually, houses were pulled down or blown up with gunpowder to create gaps, called firebreaks, that the fire could not cross.

By the time the fire was put out, four days later, much of the City lay in ruins, including the old St Paul's Cathedral. We know a great deal about these days because of people like Samuel Pepys, who described them in his diary.

London was rebuilt, this time with more buildings of brick and stone. The architect Christopher Wren designed a new St Paul's Cathedral, which still stands today.`,
    questions: [
      [1, '2b', 'Where did the fire start?', 'In a bakery on Pudding Lane', ['In St Paul\'s Cathedral', 'In Samuel Pepys\'s house', 'In a brick factory'],
        'The first sentence says it "broke out in a bakery on Pudding Lane".', { 'In St Paul\'s Cathedral': WORD_MATCH }],
      [1, '2b', 'How long did the fire last?', 'Four days', ['One night', 'Four weeks', 'Two days'], 'Paragraph 4: "four days later".'],
      [2, '2a', '"Their upper floors jutted out over the street." What does "jutted out" mean here?', 'stuck out', ['fell down', 'were painted', 'were hidden'],
        'Jutted out means stuck out. The top floors stuck out so far that houses almost touched.'],
      [2, '2b', 'Which of these helped the fire to spread quickly?', 'The houses were made of timber and built close together.',
        ['The houses were made of brick and stone.', 'It was raining heavily.', 'There were no streets.'],
        'Paragraph 2: timber houses, narrow streets, a dry summer and a strong wind. Brick and stone came later, when London was rebuilt.',
        { 'The houses were made of brick and stone.': WORD_MATCH, 'It was raining heavily.': NOT_IN_TEXT }],
      [3, '2a', 'In this text, what is a "firebreak"?', 'A gap that the fire cannot cross', ['A short rest for the people fighting the fire', 'A bucket of water', 'A type of gunpowder'],
        'The text explains it: "gaps, called firebreaks, that the fire could not cross". It isn\'t a break as in a rest.',
        { 'A short rest for the people fighting the fire': EVERYDAY_MEANING }],
      [3, '2f', 'Which paragraph explains how people fought the fire?', 'Paragraph 3', ['Paragraph 1', 'Paragraph 4', 'Paragraph 5'],
        'Paragraph 3 describes buckets, squirts and firebreaks.'],
      [4, '2d', 'Why does the writer mention that the summer had been long and dry?', 'Dry wood burns easily, so it helps explain why the fire spread so fast.',
        ['To show it was a good summer holiday.', 'Because the fire happened in winter.', 'To show there was plenty of water.'],
        'The sentence is in the paragraph about why the fire spread. Dry timber catches fire more easily.'],
      [4, '2f', 'Why does the text mention Samuel Pepys?', 'To explain how we know so much about the fire', ['Because he started the fire', 'Because he designed the new St Paul\'s', 'Because he was the baker'],
        '"We know a great deal about these days because of people like Samuel Pepys, who described them in his diary."',
        { 'Because he designed the new St Paul\'s': WORD_MATCH }],
      [5, '2h', 'How was London different after it was rebuilt?', 'More buildings were made of brick and stone instead of timber.',
        ['The streets were made even narrower.', 'St Paul\'s Cathedral was never rebuilt.', 'All the houses were made of wood again.'],
        'Compare paragraph 2 (timber houses) with paragraph 5 ("more buildings of brick and stone").', { 'St Paul\'s Cathedral was never rebuilt.': NOT_IN_TEXT }],
      [5, '2c', 'Which heading would best sum up the last paragraph?', 'A new London', ['How the fire started', 'Pepys\'s diary', 'Fighting the flames'],
        'The last paragraph is about rebuilding London and the new St Paul\'s.', { 'Fighting the flames': PART_NOT_WHOLE }],
    ],
  },
  {
    id: 'leaves',
    title: 'Why Do Leaves Change Colour?',
    kind: 'Information',
    text: `Every autumn, many trees in Britain put on a spectacular show. Leaves that were green all summer turn yellow, orange, red and brown before falling to the ground. But where do these colours come from?

During spring and summer, leaves are packed with a green substance called chlorophyll. Chlorophyll allows the tree to capture energy from sunlight and use it to make food from water and carbon dioxide. This process is called photosynthesis. There is so much chlorophyll in a leaf that its green colour hides everything else.

As the days grow shorter and colder, the tree stops making chlorophyll, and the green slowly breaks down. Yellow and orange colours, which were in the leaf all along, can now be seen. Some trees, such as certain maples, also make new red colours in autumn.

Finally, a layer of special cells forms where each leaf joins its twig. This seals the leaf off, and before long it drops. By losing their leaves, trees save water and energy through the winter, ready to grow new leaves in spring.`,
    questions: [
      [1, '2b', 'What is the green substance in leaves called?', 'chlorophyll', ['photosynthesis', 'carbon dioxide', 'maple'],
        'Paragraph 2: "a green substance called chlorophyll". Photosynthesis is the process, not the substance.', { photosynthesis: WORD_MATCH }],
      [1, '2b', 'When does the tree stop making chlorophyll?', 'When the days grow shorter and colder', ['In the middle of summer', 'When it rains', 'When new leaves grow in spring'],
        'Paragraph 3: "As the days grow shorter and colder, the tree stops making chlorophyll".'],
      [2, '2a', '"Many trees put on a spectacular show." Which word means the same as "spectacular"?', 'amazing', ['boring', 'noisy', 'tiny'],
        'Spectacular means amazing and impressive to look at.'],
      [2, '2b', 'Which colours were in the leaf all along?', 'Yellow and orange', ['Red and purple', 'Only green', 'Blue and brown'],
        'Paragraph 3: "Yellow and orange colours, which were in the leaf all along". The red is made new in autumn.', { 'Red and purple': WORD_MATCH }],
      [3, '2d', 'Why can\'t we see the yellow colours in summer?', 'The green chlorophyll hides them.', ['They haven\'t been made yet.', 'The sun bleaches them.', 'Leaves are yellow in summer.'],
        'Paragraph 2: the green "hides everything else". The yellow is already there.', { 'They haven\'t been made yet.': NOT_IN_TEXT, 'The sun bleaches them.': NOT_IN_TEXT }],
      [3, '2f', 'The first paragraph ends with a question. Why?', 'To make the reader curious to find out the answer',
        ['Because the writer doesn\'t know the answer', 'To tell the reader to stop reading', 'To list the colours'],
        'A question at the start of an information text hooks the reader; the rest of the text answers it.'],
      [4, '2c', 'Which sentence best sums up paragraph 4?', 'A sealing layer forms, the leaf falls, and the tree saves water and energy for winter.',
        ['Trees grow new leaves in spring.', 'Leaves turn yellow and orange.', 'Chlorophyll helps the tree make food.'],
        'The first choice covers the whole paragraph. "Trees grow new leaves in spring" is only its last few words.',
        { 'Trees grow new leaves in spring.': PART_NOT_WHOLE }],
      [5, '2h', 'What is the difference between the yellow and the red colours in autumn leaves?', 'The yellow was there all along; the red is newly made in autumn by some trees.',
        ['Both are newly made in autumn.', 'The red was there all along; the yellow is new.', 'There is no difference.'],
        'Paragraph 3 says yellow and orange "were in the leaf all along", but some trees "make new red colours in autumn".'],
    ],
  },
  {
    id: 'last-train',
    title: 'The Last Train Home',
    kind: 'Poem',
    text: `The station clock says ten past nine,
the platform's cold and bare;
a paper cup goes cartwheeling
through empty evening air.

Then, far away, a silver thread
of light begins to grow;
it slides along the sleeping rails,
a comet, low and slow.

The doors sigh open, warm and bright;
I'm swallowed, safe inside.
The dark rolls past like velvet sea,
and home is one more ride.`,
    questions: [
      [1, '2b', 'What time does the station clock say?', 'Ten past nine', ['Nine o\'clock', 'Ten to nine', 'Half past nine'], 'Line 1: "ten past nine".'],
      [2, '2a', '"A paper cup goes cartwheeling." What is the cup doing?', 'Tumbling over and over in the wind', ['Being carried by a passenger', 'Standing still on a bench', 'Being thrown into a bin'],
        'A cartwheel turns over and over. The cup is being blown along, turning as it goes.'],
      [2, '2d', 'How does the speaker seem to feel on the platform at the start?', 'Cold and alone', ['Hot and tired', 'Excited and busy', 'Angry and loud'],
        'The platform is "cold and bare" and the air is "empty": there is no one else there.'],
      [3, '2g', 'The train\'s light is first "a silver thread". What does this suggest?', 'At first it is a thin, faint line of light far away.',
        ['The train is made of silver.', 'Someone is sewing.', 'The light is very close and bright.'],
        'A thread is thin. Far away, the light looks like a thin line that "begins to grow" as the train gets closer.', { 'Someone is sewing.': EVERYDAY_MEANING }],
      [3, '2g', '"The doors sigh open." Why does the poet use the word "sigh"?', 'It makes the doors sound gentle and relieved, like a person breathing out.',
        ['Because the doors are broken.', 'To make the doors sound loud and scary.', 'Because the train is sad.'],
        'Giving the doors a human action (personification) makes the moment feel calm and welcoming.'],
      [4, '2g', 'Which word in verse 2 compares the train to something in space?', 'comet', ['thread', 'rails', 'silver'],
        'A comet is a bright object moving through space: the train\'s light moving through the dark.'],
      [4, '2d', 'In the last verse, how have the speaker\'s feelings changed?', 'They now feel safe and warm instead of cold and lonely.',
        ['They feel more frightened than before.', 'They are angry that the train was late.', 'Their feelings have not changed.'],
        'Verse 1 is "cold and bare"; verse 3 is "warm and bright" and "safe inside".', { 'They are angry that the train was late.': NOT_IN_TEXT }],
      [5, '2f', 'How is the poem organised?', 'It follows the journey in order: waiting, the train arriving, then riding home.',
        ['It starts at home and goes back in time.', 'Each verse is about a different person.', 'It is a list of train times.'],
        'Verse 1 waits on the platform, verse 2 sees the train coming, verse 3 is on board heading home.'],
      [5, '2g', '"I\'m swallowed, safe inside." Why is "swallowed" a good choice of word?', 'It makes the train seem like a creature taking the speaker in, and "safe" shows this feels comforting.',
        ['It shows the speaker is eating on the train.', 'It shows the train is dangerous.', 'It means the speaker is very small.'],
        'Swallowed makes the train seem alive, but "safe" tells us the feeling is comfort, not fear.', { 'It shows the speaker is eating on the train.': EVERYDAY_MEANING }],
    ],
  },
  {
    id: 'library',
    title: 'Save Our Library!',
    kind: 'Letter',
    text: `Dear Councillor Patel,

I am writing to ask you to keep Brookfield Library open. I have heard that the council may close it next year to save money, and I believe this would be a serious mistake.

Firstly, the library is much more than a building full of books. Every Saturday, the Reading Club brings together children from different schools, and many of us have made friends there. Where else would we go?

Secondly, not every family can afford to buy books or has a quiet place to do homework. The library gives everyone the same chance, whatever their background. My older brother did all his revision there because our flat is too noisy.

Some people say that everything is online now, so libraries are no longer needed. However, the library's computers are free to use, and the librarians help people who find technology difficult, such as my neighbour, who is eighty-three.

Please visit the library on a Saturday morning and see for yourself how important it is. I am sure you will agree that closing it would be a loss for the whole community.

Yours sincerely,
Amara Okafor (aged 11)`,
    questions: [
      [1, '2b', 'When does the Reading Club meet?', 'Every Saturday', ['Every Sunday', 'After school on Fridays', 'Once a year'], 'Paragraph 2: "Every Saturday, the Reading Club…".'],
      [1, '2b', 'Why might the council close the library?', 'To save money', ['Because it is too noisy', 'Because nobody uses it', 'Because it needs new books'],
        'Paragraph 1: "the council may close it next year to save money".', { 'Because nobody uses it': NOT_IN_TEXT, 'Because it is too noisy': WORD_MATCH }],
      [2, '2a', '"This would be a serious mistake." Which word could replace "serious" without changing the meaning?', 'big', ['funny', 'small', 'quiet'],
        'Here "serious" means important or big. It isn\'t about someone being solemn.'],
      [2, '2f', 'What is the main purpose of this letter?', 'To persuade the councillor to keep the library open', ['To tell a story about a library', 'To complain about her brother', 'To explain how to use a computer'],
        'The first line says so: "I am writing to ask you to keep Brookfield Library open."'],
      [3, '2f', 'Why does Amara use the words "Firstly" and "Secondly"?', 'To organise her reasons clearly, one after another', ['To show her first reason is less important', 'To show she is unsure', 'To count the books'],
        'Words like "firstly" and "secondly" signpost each new reason in a persuasive text.'],
      [3, '2d', 'Why does Amara mention her neighbour who is eighty-three?', 'As an example of someone who needs the librarians\' help with technology',
        ['To show her neighbour works at the library', 'Because her neighbour wants the library to close', 'To show that only older people use the library'],
        'The neighbour is her example of someone who "finds technology difficult" and is helped by the librarians.', { 'To show her neighbour works at the library': NOT_IN_TEXT }],
      [4, '2g', '"Where else would we go?" Why does Amara ask this question?', 'To make the reader realise the children would have nowhere else to meet',
        ['Because she wants the councillor to reply with a place', 'Because she is lost', 'To change the subject'],
        'It\'s a rhetorical question: she doesn\'t expect an answer. It makes the reader think about what would be lost.'],
      [4, '2c', 'Which sentence best sums up Amara\'s argument?', 'The library helps the whole community, so it should stay open.',
        ['Everything is online now, so libraries are not needed.', 'Her brother likes revising in quiet places.', 'Councillors should visit more buildings.'],
        'Her reasons (friends, homework, computers, help) all support keeping it open. The "everything is online" view is the one she argues against.',
        { 'Everything is online now, so libraries are not needed.': WORD_MATCH, 'Her brother likes revising in quiet places.': PART_NOT_WHOLE }],
      [5, '2h', 'How does Amara deal with the view that "everything is online now"?', 'She mentions it, then gives reasons against it.',
        ['She agrees with it completely.', 'She ignores it.', 'She says computers should be banned.'],
        '"Some people say… However…": she answers the other side\'s point, which makes her argument stronger.'],
      [5, '2g', 'Why does Amara end with "I am sure you will agree"?', 'It politely assumes the councillor shares her view, which makes it harder to disagree.',
        ['It shows she is unsure.', 'It is a question the councillor must answer.', 'It lists her reasons.'],
        'Sounding confident that the reader agrees is a persuasive technique.'],
    ],
  },
];

const byId = new Map(PASSAGES.map((p) => [p.id, p]));
export const getPassage = (id: string): Passage | undefined => byId.get(id);

export function readingQuestions(): Question[] {
  return PASSAGES.flatMap((p) => p.questions.map(([level, domain, prompt, answer, wrong, explanation, tags], i): Question => {
    const bugs = wrong.filter((w) => tags?.[w]).map((w): [string, string] => [tags![w], w]);
    return {
      skillId: 'reading-y6', level, id: `reading-y6#${p.id}:${i}`, prompt, answer, explanation,
      choices: [answer, ...wrong], passageId: p.id, domain,
      ...(bugs.length ? { bugs } : {}),
    };
  }));
}
