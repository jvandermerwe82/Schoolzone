/**
 * Science question bank (format in bank.ts).
 * Facts are kept to well-established primary-school science. Year 6 topics
 * follow the national curriculum in England (2014) programme of study.
 */
import type { Level, Question } from '../brain/types';
import { pickFromBank, rowsToQuestions, type Row, type Tags } from './bank';

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
  // ---- Year 6 ----
  classification: [
    [1, 'Animals with a backbone are called…', 'Vertebrates', ['Invertebrates', 'Micro-organisms', 'Plants'], 'Fish, amphibians, reptiles, birds and mammals all have a backbone, so they are vertebrates.'],
    [1, 'Which of these is an invertebrate?', 'A snail', ['A frog', 'A robin', 'A salmon'], 'A snail has no backbone. Frogs, robins and salmon are vertebrates.'],
    [2, 'Which group of vertebrates has feathers?', 'Birds', ['Mammals', 'Reptiles', 'Amphibians'], 'Only birds have feathers.'],
    [2, 'Which vertebrate group has dry, scaly skin?', 'Reptiles', ['Amphibians', 'Mammals', 'Birds'], 'Reptiles such as lizards and snakes have dry, scaly skin. Amphibians have moist skin.'],
    [2, 'How many legs does an insect have?', '6', ['4', '8', '10'], 'All adult insects have 6 legs and 3 body parts.'],
    [3, 'Why is a spider not an insect?', 'It has eight legs', ['It has wings', 'It has a backbone', 'It has six legs'], 'Spiders have 8 legs and 2 body parts. Insects have 6 legs and 3 body parts.'],
    [3, 'Which of these is a micro-organism?', 'Bacteria', ['A mushroom', 'A worm', 'An ant'], 'Micro-organisms are too small to see without a microscope. Bacteria are micro-organisms.'],
    [3, 'Frogs and other amphibians usually…', 'Live in water when young and on land as adults', ['Live only in the sea', 'Have feathers', 'Feed their young on milk'], 'Frogs start as tadpoles in water, then grow lungs and legs and can live on land.'],
    [4, 'Which scientist was a pioneer of classification and gave living things two-part Latin names?', 'Carl Linnaeus', ['Charles Darwin', 'Isaac Newton', 'Mary Anning'], 'Carl Linnaeus created the naming system we still use, such as Homo sapiens for humans.'],
    [4, 'What is a classification key used for?', 'Identifying a living thing by answering questions about its features', ['Unlocking a science lab', 'Measuring how heavy an animal is', 'Counting how many animals live in a place'], 'A key asks yes/no questions about features (such as "Does it have legs?") to work out what something is.'],
    [4, 'A whale and a bat are both…', 'Mammals', ['Fish', 'Birds', 'Reptiles'], 'Both breathe air, have hair and feed their babies milk, so both are mammals.'],
    [5, 'Which feature do ALL mammals share?', 'They feed their young on milk', ['They give birth to live young', 'They live on land', 'They have four legs'], 'All mammals feed their young on milk. A few, like the platypus, lay eggs, so "live young" is not true of every mammal.'],
    [5, 'The mould that grows on old bread is a type of…', 'Fungus', ['Plant', 'Animal', 'Mineral'], 'Moulds, yeasts and mushrooms are fungi.'],
    [5, 'Why are fungi, like mushrooms, not classified as plants?', 'They cannot make their own food by photosynthesis', ['They are always poisonous', 'They only grow at night', 'They are not made of cells'], 'Plants make food using sunlight. Fungi cannot, so they feed on other things, like dead leaves.'],
  ],
  'circulatory-system': [
    [1, 'What is the main job of the heart?', 'To pump blood around the body', ['To digest food', 'To help us think', 'To store air'], 'The heart is a muscle that pumps blood through blood vessels to every part of the body.'],
    [1, 'Which of these helps keep your heart healthy?', 'Regular exercise', ['Smoking', 'Sitting still all day', 'Eating lots of sweets'], 'Exercise makes the heart muscle stronger. Smoking and too much sugar and fat can harm it.'],
    [2, 'Blood vessels that carry blood back to the heart are called…', 'Veins', ['Arteries', 'Nerves', 'Tendons'], 'Veins carry blood back to the heart. Arteries carry it away from the heart.'],
    [2, 'What does blood carry to every part of the body?', 'Oxygen and nutrients', ['Only water', 'Bones', 'Air bubbles'], 'Blood delivers oxygen from the lungs and nutrients from food, and carries away waste.'],
    [2, 'The tiniest blood vessels are called…', 'Capillaries', ['Arteries', 'Veins', 'Tendons'], 'Capillaries are so thin that oxygen and nutrients can pass through their walls into the body.'],
    [3, 'Where does blood pick up oxygen?', 'In the lungs', ['In the stomach', 'In the kidneys', 'In the brain'], 'Oxygen from the air we breathe passes into the blood in the lungs.'],
    [3, 'Why does your heart beat faster when you exercise?', 'Your muscles need more oxygen', ['Your bones are growing', 'You are digesting food', 'Your blood is getting colder'], 'Working muscles need more oxygen, so the heart pumps faster to deliver it.'],
    [3, 'How many chambers does the human heart have?', '4', ['2', '3', '6'], 'The heart has 4 chambers: two atria at the top and two ventricles at the bottom.'],
    [4, 'Which part of the blood helps it clot when you cut yourself?', 'Platelets', ['Red blood cells', 'Plasma', 'White blood cells'], 'Platelets stick together to plug a cut and stop the bleeding.'],
    [4, 'The liquid part of blood, which carries dissolved nutrients, is called…', 'Plasma', ['Platelets', 'Marrow', 'Saliva'], 'Plasma is mostly water and carries nutrients, water and waste around the body.'],
    [4, 'Smoking is especially harmful to which organs?', 'The heart and lungs', ['The hair and nails', 'The teeth only', 'The bones only'], 'Smoking damages the lungs and blood vessels and makes heart disease more likely.'],
    [5, 'Which side of the heart pumps blood to the lungs?', 'The right side', ['The left side', 'Neither side', 'The heart does not pump blood to the lungs'], 'The right side pumps blood to the lungs to collect oxygen. The left side pumps it to the rest of the body.'],
    [5, 'Why do arteries have thicker walls than veins?', 'They carry blood at high pressure straight from the heart', ['They carry more oxygen', 'They are older', 'They carry food instead of blood'], 'Each heartbeat pushes blood into the arteries at high pressure, so they need thick, stretchy walls.'],
    [5, 'How are nutrients from digested food carried around the body?', 'Dissolved in the blood', ['Along the nerves', 'Through the bones', 'In the air we breathe'], 'Nutrients pass from the small intestine into the blood, which carries them to every cell.'],
  ],
  'evolution-inheritance': [
    [1, 'What is a fossil?', 'The remains or traces of a living thing from long ago, preserved in rock', ['A type of crystal', 'A plant that is still growing', 'A rock shaped by the sea'], 'Fossils form over millions of years, often when a plant or animal is buried and turned to rock.'],
    [1, 'What are the offspring of a living thing?', 'Its young', ['Its parents', 'Its food', 'Its home'], 'Offspring are the young that a plant or animal produces.'],
    [2, 'Are offspring usually identical to their parents?', 'No, they are similar but usually vary', ['Yes, always exactly the same', 'No, they look nothing alike', 'Only in plants'], 'Offspring are the same kind of living thing as their parents but are not identical. This is called variation.'],
    [2, 'An arctic fox has thick white fur. This helps it survive in the snow and is an example of…', 'Adaptation', ['Photosynthesis', 'Evaporation', 'Classification'], 'An adaptation is a feature that helps a living thing survive in its environment.'],
    [2, "How does a camel's hump help it survive in the desert?", 'It stores fat that can be used for energy', ['It stores water', 'It keeps the camel cool', 'It helps the camel see further'], 'A camel\'s hump stores fat, not water. The fat can be used for energy when food is scarce.'],
    [3, 'Which fossil hunter made famous discoveries at Lyme Regis?', 'Mary Anning', ['Carl Linnaeus', 'Isaac Newton', 'Florence Nightingale'], 'Mary Anning found ichthyosaur and plesiosaur fossils on the Dorset coast in the early 1800s.'],
    [3, 'How are cactuses adapted to hot deserts?', 'They store water in thick stems and have spines instead of broad leaves', ['They grow huge soft leaves', 'They need lots of rain every day', 'They only grow in shade'], 'Thick stems store water, and spines lose less water than broad leaves (and protect the plant).'],
    [3, 'Features passed from parents to their offspring are…', 'Inherited', ['Learnt at school', 'Caught like a cold', 'Made up'], 'Inherited characteristics, like eye colour, are passed on from parents.'],
    [4, 'Which two scientists developed the idea of evolution by natural selection?', 'Charles Darwin and Alfred Russel Wallace', ['Isaac Newton and Albert Einstein', 'Mary Anning and Carl Linnaeus', 'Marie Curie and Louis Pasteur'], 'Darwin and Wallace both came up with natural selection, and their ideas were presented together in 1858.'],
    [4, 'In natural selection, which living things are most likely to survive and have offspring?', 'Those best adapted to their environment', ['Always the biggest ones', 'Always the oldest ones', 'Those that move the least'], 'Living things with helpful features survive better, so they have more offspring and pass those features on.'],
    [4, 'If a labrador and a poodle have puppies, the puppies will…', 'Have a mix of features from both parents', ['Look exactly like the poodle', 'Not be dogs', 'Have no features from either parent'], 'Offspring inherit characteristics from both parents, so they show a mix.'],
    [5, 'What do fossils tell us about living things?', 'They have changed over millions of years', ['They never change', 'Dinosaurs are alive today', 'All animals lived at the same time'], 'Fossils show animals and plants that no longer exist, and how living things have changed over time.'],
    [5, 'According to natural selection, why do giraffes have long necks?', 'Giraffes born with longer necks reached more food, survived, and passed long necks on', ['Giraffes stretched their necks and passed the stretch on to their babies', 'Giraffes decided to grow longer necks', 'Their necks grew because they ate leaves'], 'Stretching during life is not passed on. Natural variation plus survival of the best adapted explains it.'],
    [5, 'Why is variation between offspring important for evolution?', 'Some variations help survival, and these get passed on', ['It makes all animals identical', 'It stops animals from changing', 'It only affects plants'], 'Without variation there would be nothing for natural selection to choose between.'],
  ],
  'light-y6': [
    [1, 'Light travels in…', 'Straight lines', ['Curves', 'Circles', 'Zigzags'], 'Light travels in straight lines, which is why it cannot go around objects.'],
    [1, 'Which of these is a light source?', 'A lit candle', ['A mirror', 'The Moon', 'A white wall'], 'A light source gives out its own light. Mirrors, the Moon and walls only reflect light.'],
    [2, 'How do we see a book in a lit room?', 'Light reflects off the book into our eyes', ['Light shines out of our eyes onto the book', 'The book makes its own light', 'We can see without any light'], 'Light travels from a source, bounces off the book, and travels in a straight line into our eyes.'],
    [2, 'Why does a shadow have the same shape as the object?', 'Light travels in straight lines, so the object blocks light in its own shape', ['Shadows are copies made by our eyes', 'The object gives out dark light', 'Light bends around the object'], 'The object blocks the straight-line light rays, leaving a dark area with the same outline.'],
    [3, 'What happens to a shadow when you move an object closer to the light source?', 'It gets bigger', ['It gets smaller', 'It stays the same size', 'It disappears'], 'Closer to the light, the object blocks more of the spreading light, so the shadow grows.'],
    [3, 'Which surface reflects light best?', 'A mirror', ['Black paper', 'A carpet', 'A wooden table'], 'Smooth, shiny surfaces like mirrors reflect light best.'],
    [3, 'A simple periscope uses what to let you see over a wall?', 'Two mirrors', ['A magnet', 'A torch', 'A shadow'], 'Light reflects off the top mirror, down to the bottom mirror and into your eye.'],
    [4, 'Why should you never look directly at the Sun?', 'Its light is so strong it can damage your eyes', ['It will make the Sun go out', 'It makes shadows disappear', 'The Sun is too far away to see'], 'Sunlight is very intense and can permanently damage your eyes, even through sunglasses.'],
    [4, 'Which material would make the darkest shadow?', 'Cardboard (opaque)', ['Clear glass (transparent)', 'Tissue paper (translucent)', 'Clear plastic (transparent)'], 'Opaque materials block all light, so they make the darkest shadows.'],
    [4, 'A straw in a glass of water looks bent because light…', 'Changes direction as it passes between water and air', ['Is blocked by the water', 'Is soaked up by the straw', 'Stops travelling in water'], 'Light bends when it moves from one material to another. This is called refraction.'],
    [5, 'A rainbow forms when sunlight…', 'Is split into colours by raindrops', ['Bounces off clouds', 'Reflects off the ground', 'Passes through the Moon'], 'Raindrops bend and split white sunlight into its colours.'],
    [5, 'White light is made up of…', 'A mixture of all the colours', ['Only white', 'Only yellow', 'Only blue'], 'A prism or raindrops can split white light into red, orange, yellow, green, blue, indigo and violet.'],
    [5, 'Why does a red apple look red?', 'It reflects red light and absorbs most other colours', ['It gives out red light', 'It absorbs red light', 'Red light cannot reach it'], 'We see the colour of light that an object reflects into our eyes.'],
  ],
  'electricity-y6': [
    [1, 'For a bulb to light up, the circuit must be…', 'Complete (a full loop)', ['Broken', 'Wet', 'Made of wood'], 'Electricity can only flow if there is a complete loop from the cell, through the bulb and back.'],
    [1, 'What does a cell (battery) do in a circuit?', 'It provides the energy to push electricity around the circuit', ['It stops electricity', 'It makes light by itself', 'It measures the circuit'], 'The cell is the power source that pushes the current around the circuit.'],
    [2, 'In a series circuit, what happens to a bulb if you add another cell?', 'It gets brighter', ['It gets dimmer', 'Nothing changes', 'It changes colour'], 'More cells give a higher voltage, so more energy reaches the bulb and it glows brighter.'],
    [2, 'What happens to a buzzer if you use a higher-voltage cell?', 'It gets louder', ['It gets quieter', 'It stops working', 'Nothing changes'], 'A higher voltage gives the buzzer more energy, so it sounds louder.'],
    [2, 'What happens when a switch is open (off)?', 'The circuit is broken and electricity stops flowing', ['The bulb gets brighter', 'The cell recharges', 'Electricity flows faster'], 'An open switch makes a gap in the circuit.'],
    [3, 'In a series circuit with one cell, what happens if you add a second bulb?', 'Both bulbs are dimmer', ['Both bulbs are brighter', 'Nothing changes', 'One bulb goes out'], 'The same cell now has to push electricity through two bulbs, so each gets less energy and is dimmer.'],
    [3, 'What is voltage measured in?', 'Volts', ['Amps', 'Metres', 'Grams'], 'Voltage is measured in volts (V). A typical AA cell is 1.5 V.'],
    [3, 'Which of these is an electrical conductor?', 'A steel paperclip', ['A plastic ruler', 'A rubber band', 'A wooden peg'], 'Metals like steel conduct electricity. Plastic, rubber and wood are insulators.'],
    [4, 'In a circuit diagram, what does a circle with a cross inside it show?', 'A bulb (lamp)', ['A cell', 'A switch', 'A buzzer'], 'A circle with a cross is the symbol for a lamp (bulb).'],
    [4, 'In a circuit diagram, a long line next to a shorter line shows…', 'A cell', ['A bulb', 'A wire', 'A motor'], 'The cell symbol is a long line (positive) next to a short line (negative).'],
    [4, 'Why do scientists use symbols in circuit diagrams?', 'They are simple and understood everywhere', ['They look prettier than drawings', 'They make circuits work better', 'They are secret codes'], 'Standard symbols make circuits quick to draw and easy for anyone to read.'],
    [5, 'If one bulb breaks in a series circuit, what happens to the other bulbs?', 'They go out too', ['They get brighter', 'They stay the same', 'They change colour'], 'A series circuit is a single loop. One broken bulb breaks the loop for everything.'],
    [5, 'Why might a bulb blow if you connect too many cells?', 'The voltage is too high for the bulb', ['The wires get too long', 'The cells run out', 'The switch is off'], 'Each bulb is made for a certain voltage. Too high and its thin filament overheats and breaks.'],
    [5, 'A motor in a circuit changes electrical energy into…', 'Movement (kinetic energy)', ['Light only', 'Sound only', 'Chemical energy'], 'A motor uses electricity to make something spin.'],
  ],
};

/** Wrong choices that reveal a well-known misconception. */
const TAGS: Record<string, Tags> = {
  'living-things': { 'A shark': 'sci-whale-is-fish', Oxygen: 'sci-plants-breathe-in-oxygen' },
  'earth-space': {
    'The Sun going around Earth': 'sci-sun-orbits-earth',
    'Earth getting closer to and further from the Sun': 'sci-seasons-distance',
    'It makes its own light': 'sci-moon-own-light',
  },
  'forces-energy': { 'The Moon': 'sci-moon-own-light' },
  classification: { 'They give birth to live young': 'sci-mammal-live-young', Fish: 'sci-whale-is-fish' },
  'evolution-inheritance': {
    'It stores water': 'sci-camel-water',
    'Giraffes stretched their necks and passed the stretch on to their babies': 'sci-lamarck',
  },
  'light-y6': {
    'The Moon': 'sci-moon-own-light',
    'Light shines out of our eyes onto the book': 'sci-eyes-send-light',
    'It gets smaller': 'sci-shadow-size',
  },
  'electricity-y6': { 'Both bulbs are brighter': 'sci-more-bulbs-brighter', 'They stay the same': 'sci-series-break' },
};

export function scienceQuestions(skillId: string): Question[] {
  const rows = BANK[skillId];
  if (!rows) throw new Error(`No science questions for ${skillId}`);
  return rowsToQuestions(skillId, rows, TAGS[skillId]);
}

export function scienceSkillIds(): string[] {
  return Object.keys(BANK);
}

export function pickScienceQuestion(
  skillId: string,
  level: Level,
  recentIds: string[],
  rng: () => number,
  prefer?: (q: Question) => boolean,
): Question {
  return pickFromBank(scienceQuestions(skillId), level, recentIds, rng, prefer);
}
