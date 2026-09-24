/**
 * Science question bank. Format: [level, prompt, correct answer, wrong choices, explanation].
 * Choices are shuffled when the question is shown.
 * Facts are kept to well-established primary-school science.
 */
import type { Level, Question } from '../brain/types';

type Row = [Level, string, string, string[], string];

const BANK: Record<string, Row[]> = {
  'living-things': [
    [1, 'Which of these is a living thing?', 'A tree', ['A rock', 'A cloud', 'A chair'], 'Trees grow, need water and food, and make new trees. Rocks, clouds and chairs do not.'],
    [1, 'What is a baby frog called?', 'A tadpole', ['A puppy', 'A calf', 'A chick'], 'Frogs hatch from eggs as tadpoles, which live in water and slowly grow legs.'],
    [1, 'Along with water and air, what do plants need to make their food?', 'Sunlight', ['Moonlight', 'Sand', 'Plastic'], 'Plants use energy from sunlight to make their own food.'],
    [2, 'Which part of a plant takes in water from the soil?', 'The roots', ['The petals', 'The flowers', 'The seeds'], 'Roots grow into the soil and soak up water and minerals.'],
    [2, 'An animal that eats only plants is called a…', 'Herbivore', ['Carnivore', 'Omnivore', 'Predator'], 'Herbivores (like rabbits and cows) eat plants. Carnivores eat meat; omnivores eat both.'],
    [2, 'What do fish use to breathe underwater?', 'Gills', ['Lungs', 'Fins', 'Scales'], 'Gills take oxygen out of the water as it flows over them.'],
    [3, 'Which of these animals is a mammal?', 'A whale', ['A shark', 'A salmon', 'An octopus'], 'Whales breathe air with lungs and feed their babies milk, so they are mammals, not fish.'],
    [3, 'A caterpillar grows up to become a…', 'Butterfly or moth', ['Beetle', 'Spider', 'Worm'], 'Caterpillars are the young (larva) stage of butterflies and moths.'],
    [3, 'Which gas do plants take in from the air to make food?', 'Carbon dioxide', ['Oxygen', 'Helium', 'Hydrogen'], 'Plants take in carbon dioxide and, using sunlight and water, turn it into sugar.'],
    [4, 'What is the process called where plants make food using sunlight?', 'Photosynthesis', ['Evaporation', 'Digestion', 'Condensation'], '"Photo" means light and "synthesis" means making: plants make food with light.'],
    [4, 'In the food chain grass → rabbit → fox, which one is the producer?', 'Grass', ['Rabbit', 'Fox', 'None of them'], 'Producers make their own food from sunlight. Plants are producers; animals are consumers.'],
    [4, 'Animals without a backbone are called…', 'Invertebrates', ['Vertebrates', 'Mammals', 'Reptiles'], 'Insects, worms, spiders and snails have no backbone, so they are invertebrates.'],
    [5, 'Which gas do plants give off during photosynthesis?', 'Oxygen', ['Carbon dioxide', 'Nitrogen', 'Helium'], 'Photosynthesis releases oxygen, which animals (and people) need to breathe.'],
    [5, 'Which part of a plant cell contains the green chlorophyll?', 'Chloroplast', ['Nucleus', 'Cell wall', 'Vacuole'], 'Chloroplasts hold chlorophyll, which captures light energy for photosynthesis.'],
  ],
  'human-body': [
    [1, 'Which sense do you use your nose for?', 'Smell', ['Hearing', 'Sight', 'Touch'], 'Your nose detects smells. Ears hear, eyes see and skin feels touch.'],
    [1, 'Which organ pumps blood around your body?', 'The heart', ['The lungs', 'The stomach', 'The brain'], 'The heart is a strong muscle that pumps blood all day and night.'],
    [2, 'Which organs do you use to breathe?', 'The lungs', ['The kidneys', 'The heart', 'The liver'], 'Your lungs fill with air and take oxygen into your blood.'],
    [2, 'What protects your brain?', 'The skull', ['The ribs', 'The spine', 'The kneecap'], 'The skull is a hard case of bone around the brain.'],
    [2, 'Which part of your body helps you taste food?', 'The tongue', ['The elbow', 'The ear', 'The hair'], 'Taste buds on your tongue detect flavours like sweet, salty and sour.'],
    [3, 'About how many bones does an adult human have?', '206', ['26', '106', '506'], 'Babies are born with more bones, but some join together, leaving about 206 in adults.'],
    [3, 'What do your muscles pull on so that you can move?', 'Bones', ['Blood', 'Skin', 'Hair'], 'Muscles are attached to bones and pull on them to move your body.'],
    [3, 'Where does food go right after you swallow it?', 'The food pipe (oesophagus)', ['The lungs', 'The heart', 'The kidneys'], 'The oesophagus carries food from your mouth down to your stomach.'],
    [4, 'Which organs clean your blood and make urine?', 'The kidneys', ['The lungs', 'The heart', 'The stomach'], 'Kidneys filter waste out of the blood and turn it into urine.'],
    [4, 'Which blood cells help fight germs?', 'White blood cells', ['Red blood cells', 'Platelets', 'Nerve cells'], 'White blood cells are part of your immune system and attack germs.'],
    [4, 'What is the largest organ of the human body?', 'The skin', ['The liver', 'The brain', 'The lungs'], 'Skin covers your whole body, making it the largest organ.'],
    [5, 'Which blood vessels carry blood away from the heart?', 'Arteries', ['Veins', 'Nerves', 'Tendons'], 'Arteries carry blood away from the heart; veins bring it back.'],
    [5, 'Where are most nutrients from food absorbed into the blood?', 'The small intestine', ['The stomach', 'The large intestine', 'The mouth'], 'The small intestine is long and lined with tiny finger-like villi that absorb nutrients.'],
    [5, 'What is the longest bone in the human body?', 'The femur (thigh bone)', ['The spine', 'The skull', 'The humerus (upper arm)'], 'The femur runs from your hip to your knee.'],
  ],
  materials: [
    [1, 'Ice is water in which state?', 'Solid', ['Liquid', 'Gas', 'Powder'], 'Ice keeps its own shape, so it is a solid.'],
    [1, 'Which material can you see through?', 'Clear glass', ['Wood', 'Brick', 'Metal'], 'Clear glass is transparent, so light passes through it.'],
    [2, 'What happens to ice when it warms up?', 'It melts into water', ['It turns into sand', 'It gets bigger', 'Nothing happens'], 'Heat makes ice melt from a solid into liquid water.'],
    [2, 'Which material would be best for a raincoat?', 'Plastic', ['Paper', 'Cotton wool', 'Cardboard'], 'Plastic is waterproof, so rain cannot soak through it.'],
    [2, 'Steam is water as a…', 'Gas', ['Solid', 'Liquid', 'Metal'], 'When water boils it turns into a gas called steam (water vapour).'],
    [3, 'At what temperature does pure water freeze?', '0 °C', ['10 °C', '37 °C', '100 °C'], 'Pure water freezes at 0 °C and boils at 100 °C (at sea level).'],
    [3, 'At what temperature does pure water boil at sea level?', '100 °C', ['0 °C', '37 °C', '50 °C'], 'At sea level, pure water boils at 100 °C.'],
    [3, 'When water vapour cools and turns back into liquid, it is called…', 'Condensation', ['Evaporation', 'Melting', 'Freezing'], 'That is why drops form on a cold glass: water vapour in the air condenses.'],
    [4, 'Which of these conducts electricity well?', 'Copper', ['Rubber', 'Wood', 'Plastic'], 'Copper is a metal and a good conductor, which is why it is used in wires.'],
    [4, 'When a liquid slowly turns into a gas, it is called…', 'Evaporation', ['Condensation', 'Freezing', 'Melting'], 'Puddles dry up because the water evaporates into the air.'],
    [4, 'Which of these is a natural material?', 'Wool', ['Plastic', 'Nylon', 'Polyester'], 'Wool comes from sheep. Plastic, nylon and polyester are made by people.'],
    [5, 'In which state are particles held in fixed places, only vibrating?', 'Solid', ['Liquid', 'Gas', 'They are the same in all states'], 'In a solid, particles are held in place and only vibrate, so it keeps its shape. In liquids and gases they move around.'],
    [5, 'When sugar dissolves completely in water, the mixture is called a…', 'Solution', ['Solid', 'Gas', 'Magnet'], 'A solution forms when one substance dissolves evenly into another.'],
    [5, 'Everything around us is made of tiny particles called…', 'Atoms', ['Cells', 'Pixels', 'Grains'], 'Atoms are the tiny building blocks of all matter.'],
  ],
  'forces-energy': [
    [1, 'A push or a pull is called a…', 'Force', ['Colour', 'Sound', 'Shape'], 'Every push or pull is a force. Forces can make things move, stop or change shape.'],
    [1, 'Which of these will a magnet pick up?', 'An iron paperclip', ['A plastic spoon', 'A wooden pencil', 'A paper cup'], 'Magnets attract iron and steel, but not plastic, wood or paper.'],
    [2, 'Which force pulls things down towards the Earth?', 'Gravity', ['Friction', 'Magnetism', 'Wind'], 'Gravity is why things fall when you drop them.'],
    [2, 'Which of these gives off its own light?', 'The Sun', ['The Moon', 'A mirror', 'A window'], 'The Sun makes its own light. The Moon and mirrors only reflect light.'],
    [2, 'Which force slows down a ball rolling on grass?', 'Friction', ['Magnetism', 'Electricity', 'Light'], 'Friction happens when surfaces rub together, and it slows moving things down.'],
    [3, 'What happens when you put the north poles of two magnets together?', 'They push apart', ['They stick together', 'Nothing happens', 'They get hot'], 'Like poles repel (push apart); opposite poles attract.'],
    [3, 'How is a shadow made?', 'An object blocks light', ['Light bounces off water', 'The ground gets darker by itself', 'Wind blows light away'], 'Light travels in straight lines, so an object in the way leaves a dark shape behind it.'],
    [3, 'Which surface gives the most friction?', 'Sandpaper', ['Ice', 'Glass', 'A polished floor'], 'Rough surfaces like sandpaper grip more, which means more friction.'],
    [4, 'What does a switch do in an electric circuit?', 'Opens or closes the circuit', ['Makes electricity', 'Stores the battery', 'Changes the bulb colour'], 'When a switch is off, it makes a gap, so electricity cannot flow around the circuit.'],
    [4, 'What causes sound?', 'Vibrations', ['Light', 'Magnets', 'Shadows'], 'Sound is made when something vibrates, like a guitar string or your vocal cords.'],
    [4, 'What kind of energy does a moving car have?', 'Kinetic energy', ['Sound energy only', 'Light energy only', 'No energy'], 'Anything that moves has kinetic energy (energy of motion).'],
    [5, 'Which travels faster?', 'Light', ['Sound', 'They travel at the same speed', 'It depends on the colour'], 'Light is far faster than sound, which is why you see lightning before you hear thunder.'],
    [5, 'A solar panel changes light energy into…', 'Electrical energy', ['Sound energy', 'Chemical energy in food', 'Magnetism'], 'Solar panels turn sunlight into electricity.'],
    [5, 'What is the unit used to measure force?', 'The newton', ['The metre', 'The litre', 'The gram'], 'Force is measured in newtons (N), named after Isaac Newton.'],
  ],
  'earth-space': [
    [1, 'What is the name of the star at the centre of our solar system?', 'The Sun', ['The Moon', 'Mars', 'The North Star'], 'The Sun is a star, and all the planets in our solar system travel around it.'],
    [1, 'Which planet do we live on?', 'Earth', ['Mars', 'Jupiter', 'Venus'], 'We live on Earth, the third planet from the Sun.'],
    [2, 'About how long does Earth take to travel once around the Sun?', 'One year', ['One day', 'One week', 'One month'], 'Earth takes about 365 days, one year, to orbit the Sun.'],
    [2, 'About how long does Earth take to spin around once?', 'One day (24 hours)', ['One hour', 'One week', 'One year'], 'One full spin of Earth takes about 24 hours, giving us one day.'],
    [3, 'Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Earth', 'Neptune'], 'Mercury is the closest planet to the Sun.'],
    [3, 'What causes day and night?', 'Earth spinning on its axis', ['The Sun going around Earth', 'The Moon blocking the Sun', 'Clouds covering the Sun'], 'As Earth spins, your side faces the Sun (day) and then turns away (night).'],
    [3, 'Which planet is known as the Red Planet?', 'Mars', ['Jupiter', 'Venus', 'Saturn'], 'Mars looks red because of iron-rich dust (rust) on its surface.'],
    [4, 'What is the largest planet in our solar system?', 'Jupiter', ['Saturn', 'Earth', 'Neptune'], 'Jupiter is a giant gas planet with more mass than all the other planets put together.'],
    [4, 'How many planets are in our solar system?', '8', ['7', '9', '10'], 'Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Pluto is now called a dwarf planet.'],
    [4, 'Rain, snow, sleet and hail are all kinds of…', 'Precipitation', ['Evaporation', 'Condensation', 'Erosion'], 'Precipitation is any water that falls from clouds to the ground.'],
    [5, 'What causes Earth to have seasons?', "The tilt of Earth's axis", ['Earth getting closer to and further from the Sun', 'The Moon changing shape', 'Clouds blocking the Sun'], "Earth is tilted, so each half gets more direct sunlight for part of the year (summer)."],
    [5, 'Why does the Moon shine at night?', 'It reflects light from the Sun', ['It makes its own light', 'It is on fire', 'It reflects light from Earth’s cities'], 'The Moon has no light of its own; we see sunlight bouncing off it.'],
    [5, 'In the water cycle, how do clouds form?', 'Water vapour cools and condenses', ['Wind blows dust together', 'The Sun makes smoke', 'Rain goes back up'], 'Warm water vapour rises, cools and condenses into tiny droplets that make clouds.'],
  ],
};

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function scienceQuestions(skillId: string): Question[] {
  const rows = BANK[skillId];
  if (!rows) throw new Error(`No science questions for ${skillId}`);
  return rows.map(([level, prompt, answer, wrong, explanation], i) => ({
    skillId, level, id: `${skillId}#${i}`, prompt, answer, explanation, choices: [answer, ...wrong],
  }));
}

export function scienceSkillIds(): string[] {
  return Object.keys(BANK);
}

/**
 * Pick a bank question as close as possible to the wanted level, preferring
 * ones the child has not seen recently.
 */
export function pickScienceQuestion(
  skillId: string,
  level: Level,
  recentIds: string[],
  rng: () => number,
): Question {
  const all = scienceQuestions(skillId);
  const fresh = all.filter((x) => !recentIds.includes(x.id));
  const pool = fresh.length > 0 ? fresh : all;
  const best = Math.min(...pool.map((x) => Math.abs(x.level - level)));
  const candidates = pool.filter((x) => Math.abs(x.level - level) === best);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  return { ...chosen, choices: shuffle(chosen.choices!, rng) };
}
