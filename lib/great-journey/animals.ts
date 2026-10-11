/**
 * great-journey/animals — the real animals behind The Great Journey.
 *
 * Every fact here is real: real species, real routes, real distances
 * (rounded for kids). The animal's expedition parallels the kid's growth —
 * "Where animals raise good humans."
 *
 * Trait mapping uses the TailTots trait vocabulary so journey progress can
 * water the Trait Garden (see journey.ts → journeyTraitBoosts).
 */

export interface JourneyLeg {
  /** Short name for the map waypoint. */
  name: string;
  /** What happens here — wonder-first, never textbook. */
  story: string;
  /** A true, kid-sized fact about this stop. */
  fact: string;
  /** Approximate miles for this leg (sums to totalDistanceMi). */
  miles: number;
  /** Gentle parallel between the animal's challenge and the kid's growth. */
  parallel: string;
}

export interface JourneyAnimal {
  id: string;
  emoji: string;
  name: string;
  species: string;
  /** One-line wonder hook for the picker card. */
  hook: string;
  totalDistanceMi: number;
  /** Traits this journey waters in the Trait Garden. */
  traits: string[];
  legs: JourneyLeg[];
}

const MONARCH_LEGS: JourneyLeg[] = [
  {
    name: "The Gathering",
    story:
      "In late summer, millions of monarchs rise from fields across Canada and the northern United States. None of them has ever made this trip before — but somehow, they all know the way.",
    fact: "A monarch weighs less than a paperclip — yet flies up to 3,000 miles.",
    miles: 450,
    parallel:
      "Starting something new feels big. The monarch has never flown this far either — but she starts anyway.",
  },
  {
    name: "Great Lakes Crossing",
    story:
      "The monarchs stream south over the Great Lakes, riding warm air like invisible elevators. They rest in trees at night, hanging in orange clusters.",
    fact: "Monarchs can glide for miles without flapping, surfing on rising warm air.",
    miles: 550,
    parallel:
      "Some days you glide. Resting isn't quitting — even monarchs stop to sleep in the trees.",
  },
  {
    name: "Prairie Skies",
    story:
      "Over the wide prairies of Iowa and Kansas, the butterflies sip nectar from late-blooming flowers, fueling up for the hardest part ahead.",
    fact: "Monarchs taste with their feet — they stand on a flower to check if it's sweet!",
    miles: 450,
    parallel:
      "Fueling up matters. Snacks, sleep, and kind words are your nectar too.",
  },
  {
    name: "Texas Stopover",
    story:
      "Texas is the most important rest stop of the whole journey. Millions of monarchs funnel through here, drinking deep before the final push south.",
    fact: "No single monarch makes the round trip — it takes four generations to complete one year of migration.",
    miles: 350,
    parallel:
      "You're part of something bigger than one trip — just like every mission you finish helps the next one.",
  },
  {
    name: "Desert Climb",
    story:
      "Past Texas, the land rises into dry mountains. The air gets thin and cool. The monarchs climb higher than most birds fly.",
    fact: "Monarchs fly up to 11,000 feet high crossing the mountains of Mexico.",
    miles: 600,
    parallel:
      "Hard parts come near the end. That's when perseverance matters most — and you've got it.",
  },
  {
    name: "The Oyamel Forest",
    story:
      "She made it! In the mountains of Michoacán, Mexico, the monarchs blanket entire fir trees in living orange. They'll rest here all winter, then begin the journey north again.",
    fact: "Millions of monarchs crowd into an area smaller than a city park — you can hear their wings.",
    miles: 600,
    parallel:
      "Look how far you both came. Rest now — new journeys are already growing inside you.",
  },
];

const LEATHERBACK_LEGS: JourneyLeg[] = [
  {
    name: "The Nesting Beach",
    story:
      "Under a moonlit sky in Papua New Guinea, a leatherback mother — heavier than a grand piano — drags herself up the sand to lay her eggs, just as her mother did, and hers before her.",
    fact: "Leatherbacks have swum Earth's oceans for over 100 million years — since the dinosaurs.",
    miles: 900,
    parallel:
      "Every big journey starts with one brave step onto the sand.",
  },
  {
    name: "Coral Sea",
    story:
      "The hatchlings that survive scramble to the waves. Our turtle dives deep — deeper than any other reptile on Earth — into water darker than night.",
    fact: "Leatherbacks dive deeper than 3,000 feet — deeper than a skyscraper is tall.",
    miles: 1400,
    parallel:
      "Going deep takes courage. Trying something hard, even when it's dark, is brave.",
  },
  {
    name: "The Open Pacific",
    story:
      "Now comes the loneliest part: thousands of miles of open ocean, no land in any direction. Just the turtle, the currents, and the stars.",
    fact: "A leatherback's front flippers can span 9 feet — wider than a grown-up is tall.",
    miles: 1300,
    parallel:
      "Doing things on your own can feel lonely — and it can also feel powerful. Both are true.",
  },
  {
    name: "Equator Crossing",
    story:
      "She crosses the equator, swimming through water warm as a bath. Sea birds follow her now — the ocean is waking up around her.",
    fact: "Leatherbacks navigate using Earth's magnetic field — a built-in compass in their heads.",
    miles: 1500,
    parallel:
      "You have an inner compass too. It points toward kind, brave, and true.",
  },
  {
    name: "Jellyfish Feast",
    story:
      "Off the coast of California, the water blooms with jellyfish — her favorite food. After months of swimming, she feasts. She earned this.",
    fact: "A leatherback can eat its own body weight in jellyfish every single day.",
    miles: 1400,
    parallel:
      "Rest and celebration are part of the journey — not a break from it.",
  },
  {
    name: "The Long Swim Home",
    story:
      "Full and strong, she turns toward home. In a few years she'll return to the very beach where she was born, to lay her own eggs in the moonlight.",
    fact: "Leatherbacks return to their birth beach to nest — across an entire ocean, they find one stretch of sand.",
    miles: 1000,
    parallel:
      "Growing up doesn't mean leaving home behind. It means carrying it with you.",
  },
];

const TERN_LEGS: JourneyLeg[] = [
  {
    name: "Arctic Cliffs",
    story:
      "On a windy cliff in Greenland, an Arctic tern chick takes its first flight. Ahead of it: the longest journey any animal on Earth ever makes.",
    fact: "The Arctic tern flies about 44,000 miles every year — the longest migration on the planet.",
    miles: 3500,
    parallel:
      "Every expert was once a beginner flapping at the edge of a cliff.",
  },
  {
    name: "North Atlantic",
    story:
      "The tern skims the waves of the North Atlantic, snatching tiny fish. Storms roll through — she flies around them, patient and clever.",
    fact: "Arctic terns see more daylight than any other creature — they chase summer around the world.",
    miles: 3800,
    parallel:
      "Storms don't stop her — she just finds another way around. Problems are like that too.",
  },
  {
    name: "African Coast",
    story:
      "Down the coast of West Africa she glides, past deserts and deltas. Other birds join for a while, then peel away. She keeps going.",
    fact: "Some terns fly 60,000 miles in a year — farther than three trips around the Earth.",
    miles: 3600,
    parallel:
      "Friends come and go on long journeys. Keep being kind — your flock finds you.",
  },
  {
    name: "Equator Crossing",
    story:
      "She crosses the equator into a whole new ocean. The stars are different here. Everything is unfamiliar — and she is exactly where she belongs.",
    fact: "Terns navigate by the stars, the sun, and Earth's magnetic field — all at once.",
    miles: 3200,
    parallel:
      "New places can feel strange and right at the same time. That's called growing.",
  },
  {
    name: "Southern Ocean",
    story:
      "The wildest water on Earth: huge waves, screaming wind. The tern rides it like a surfer, light as a feather, utterly at home.",
    fact: "An Arctic tern weighs about as much as a tennis ball — yet crosses the fiercest ocean alive.",
    miles: 4200,
    parallel:
      "Being small doesn't mean being fragile. You are lighter and stronger than you know.",
  },
  {
    name: "Antarctica",
    story:
      "She arrives at the edge of Antarctica as its summer begins — six months of endless daylight, glittering ice, and fish flashing silver. She'll rest, and feast, and then fly all the way back.",
    fact: "In its lifetime, an Arctic tern flies far enough to reach the Moon and back — three times.",
    miles: 3700,
    parallel:
      "She chased summer all the way around the world — and found it. Keep chasing yours.",
  },
];

const WILDEBEEST_LEGS: JourneyLeg[] = [
  {
    name: "Calving Grounds",
    story:
      "In February, the southern Serengeti turns into the world's biggest nursery: half a million wildebeest calves are born within three weeks. Our calf stands within minutes of birth.",
    fact: "About 1.5 million wildebeests migrate together — the largest herd migration on Earth.",
    miles: 200,
    parallel:
      "Everyone starts wobbly. Standing up fast isn't the goal — standing up at all is.",
  },
  {
    name: "Western Corridor",
    story:
      "The rains end in the south, and the great herd begins to move. A million hooves drum the earth as they head west, following the smell of rain.",
    fact: "Wildebeests can smell rain from miles away — and march toward it.",
    miles: 150,
    parallel:
      "Moving toward good things takes energy. It's okay to be tired and keep going.",
  },
  {
    name: "Grumeti River",
    story:
      "The first river crossing! Crocodiles wait in the muddy water. The herd bunches tight, calves in the middle, and charges through together.",
    fact: "Wildebeest calves can run with the herd within days of being born.",
    miles: 200,
    parallel:
      "Scary things are easier with your herd around you. Who's in yours?",
  },
  {
    name: "The Mara Crossing",
    story:
      "The most famous river crossing on Earth. Thousands of wildebeests plunge into the churning Mara River while crocodiles slide off the banks. Our calf stays close to its mother — and makes it.",
    fact: "The Mara crossing has been filmed more than almost any other wildlife event in history.",
    miles: 250,
    parallel:
      "The bravest thing isn't having no fear — it's crossing anyway, close to the ones you love.",
  },
  {
    name: "Maasai Mara",
    story:
      "Safe in Kenya's green Maasai Mara, the herd spreads out to graze. Lions watch from the grass, but the herd is too big, too alert, too together to fear.",
    fact: "Zebras and gazelles migrate alongside the wildebeests — different species, one journey.",
    miles: 400,
    parallel:
      "Belonging doesn't require being the same. Different stripes, same journey.",
  },
  {
    name: "Full Circle",
    story:
      "The rains call them south again. The herd turns as one — back toward the calving grounds where it all began. The circle is complete, and a new one is already starting.",
    fact: "The migration never truly ends — it's a circle the herd walks every single year.",
    miles: 600,
    parallel:
      "Growing isn't a straight line — it's a circle. Every ending is a beginning wearing a disguise.",
  },
];

export const JOURNEY_ANIMALS: JourneyAnimal[] = [
  {
    id: "monarch",
    emoji: "🦋",
    name: "Mara the Monarch",
    species: "Monarch butterfly",
    hook: "3,000 miles on wings thinner than paper.",
    totalDistanceMi: 3000,
    traits: ["perseverance"],
    legs: MONARCH_LEGS,
  },
  {
    id: "leatherback",
    emoji: "🐢",
    name: "Tilly the Leatherback",
    species: "Leatherback sea turtle",
    hook: "Swims an entire ocean. Alone. On purpose.",
    totalDistanceMi: 7500,
    traits: ["perseverance", "confidence"],
    legs: LEATHERBACK_LEGS,
  },
  {
    id: "tern",
    emoji: "🐦",
    name: "Suki the Tern",
    species: "Arctic tern",
    hook: "Chases summer around the whole planet.",
    totalDistanceMi: 22000,
    traits: ["optimism", "curiosity"],
    legs: TERN_LEGS,
  },
  {
    id: "wildebeest",
    emoji: "🦬",
    name: "Jabari the Wildebeest",
    species: "Wildebeest",
    hook: "Crosses crocodile rivers with a million friends.",
    totalDistanceMi: 1800,
    traits: ["empathy", "perseverance"],
    legs: WILDEBEEST_LEGS,
  },
];

export function getJourneyAnimal(id: string): JourneyAnimal | undefined {
  return JOURNEY_ANIMALS.find((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// Shelter animal journeys — rescue → home (for the "can't have pets" track)
// ---------------------------------------------------------------------------

export interface ShelterStage {
  name: string;
  story: string;
  /** What the kid's missions do at this stage. */
  kidRole: string;
}

export interface ShelterAnimal {
  id: string;
  emoji: string;
  name: string;
  species: string;
  age: string;
  /** Their story — honest, hopeful, never traumatic. */
  story: string;
  personality: string;
  stages: ShelterStage[];
}

const RESCUE_STAGES: ShelterStage[] = [
  {
    name: "Intake",
    story: "A new arrival at the shelter. Everything smells strange. The lights are bright. It's okay to be scared on day one.",
    kidRole: "Your kindness missions send calm, gentle energy their way.",
  },
  {
    name: "Trust",
    story: "Slowly, carefully — a first sniff of a volunteer's hand. A first purr, a first tail wag. Trust is growing, one gentle moment at a time.",
    kidRole: "Your patience missions help them learn that people can be safe.",
  },
  {
    name: "Play",
    story: "Look! They're playing! A toy, a game, a zoom around the room — the real personality is coming out to shine.",
    kidRole: "Your joy missions remind them that life is fun.",
  },
  {
    name: "Health",
    story: "Check-ups, good food, warm beds. They're getting stronger and healthier every single day.",
    kidRole: "Your responsibility missions help keep them healthy and strong.",
  },
  {
    name: "Home",
    story: "The best day: a family falls in love and takes them home forever. Your kindness helped make this happen.",
    kidRole: "You did this. Your missions were part of their journey home.",
  },
];

export const SHELTER_ANIMALS: ShelterAnimal[] = [
  {
    id: "luna",
    emoji: "🐱",
    name: "Luna",
    species: "Tabby cat",
    age: "2 years old",
    story:
      "Luna was found as a tiny stray kitten, hiding under a porch during a rainstorm. She's shy with new people — but once she trusts you, she'll curl up in your lap and purr like a tiny engine.",
    personality: "Shy, gentle, secretly cuddly",
    stages: RESCUE_STAGES,
  },
  {
    id: "rocky",
    emoji: "🐶",
    name: "Rocky",
    species: "Beagle mix",
    age: "8 months old",
    story:
      "Rocky's family had to move far away and couldn't take him along. He's a bouncy, happy puppy who loves everyone instantly — sometimes a little too much! He's learning his manners.",
    personality: "Bouncy, joyful, learning calm",
    stages: RESCUE_STAGES,
  },
  {
    id: "willow",
    emoji: "🐰",
    name: "Willow",
    species: "Holland lop rabbit",
    age: "4 years old",
    story:
      "Willow was the classroom pet at a school that closed down. She's calm, wise, and loves quiet company — the perfect reading buddy. She just needs a peaceful home.",
    personality: "Calm, wise, gentle",
    stages: RESCUE_STAGES,
  },
];

export function getShelterAnimal(id: string): ShelterAnimal | undefined {
  return SHELTER_ANIMALS.find((a) => a.id === id);
}
