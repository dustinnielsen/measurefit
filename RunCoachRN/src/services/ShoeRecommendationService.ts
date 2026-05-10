import { RunningGoal, RunningAbility, TrainingStyle } from '../types/enums';

// ── Affiliate config ──────────────────────────────────────
// Sign up at:
//   Running Warehouse → shareasale.com (search "Running Warehouse")
//   Amazon Associates → affiliate-program.amazon.com
// Replace the placeholder IDs below with your real affiliate IDs.
const AFFILIATE = {
  runningWarehouse: 'YOUR_RW_AFFILIATE_ID',   // ShareASale affiliate ID
  amazon:           'cinder-app-20',           // Amazon Associate tag
};

function rwLink(slug: string): string {
  return `https://www.runningwarehouse.com/${slug}`;
}
function amazonLink(asin: string): string {
  return `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE.amazon}`;
}

// ── Shoe database ─────────────────────────────────────────

export type ShoeCategory =
  | 'daily'       // workhorse daily trainer
  | 'long'        // max cushion for long runs
  | 'speed'       // tempo/interval trainer
  | 'race'        // carbon-plated race shoe
  | 'trail'       // off-road
  | 'recovery'    // plush recovery
  | 'beginner'    // forgiving, stable
  | 'stability';  // motion control / overpronation

export interface Shoe {
  id: string;
  name: string;
  brand: string;
  price: number;            // USD MSRP
  categories: ShoeCategory[];
  surfaces: ('road' | 'trail' | 'track')[];
  cushion: 'minimal' | 'moderate' | 'max';
  weight: 'light' | 'moderate' | 'heavy';
  minWeeklyMiles: number;   // recommended minimum weekly mileage
  maxWeeklyMiles: number;   // recommended max before needing more cushion
  description: string;      // one-liner pitch
  whyCard: string;          // shown in the recommendation card
  shopUrl: string;          // affiliate URL
  emoji: string;
}

export const SHOE_DB: Shoe[] = [
  // ── Daily trainers ────────────────────────────────────────
  {
    id: 'brooks-ghost-16',
    name: 'Ghost 16',
    brand: 'Brooks',
    price: 140,
    categories: ['daily', 'beginner'],
    surfaces: ['road'],
    cushion: 'moderate',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 50,
    description: 'The most trusted daily trainer in running.',
    whyCard: 'Reliable, forgiving, and works for every run on your schedule — easy days to long runs.',
    shopUrl: rwLink('catpage-BRGHOSTM.html'),
    emoji: '👟',
  },
  {
    id: 'asics-gel-nimbus-26',
    name: 'Gel-Nimbus 26',
    brand: 'ASICS',
    price: 160,
    categories: ['daily', 'long', 'recovery'],
    surfaces: ['road'],
    cushion: 'max',
    weight: 'moderate',
    minWeeklyMiles: 20,
    maxWeeklyMiles: 70,
    description: 'Max cushion for high-mileage runners.',
    whyCard: 'With your mileage goals, your feet need serious cushion. The Nimbus absorbs impact mile after mile.',
    shopUrl: rwLink('catpage-ASNIMM.html'),
    emoji: '👟',
  },
  {
    id: 'hoka-clifton-9',
    name: 'Clifton 9',
    brand: 'Hoka',
    price: 145,
    categories: ['daily', 'long', 'recovery'],
    surfaces: ['road'],
    cushion: 'max',
    weight: 'light',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 60,
    description: 'Lightweight max cushion. Easy on joints, fast on feet.',
    whyCard: "Hoka's most popular shoe — pillowy soft but surprisingly light. Great for easy days and long runs.",
    shopUrl: rwLink('catpage-HKCLIFM.html'),
    emoji: '👟',
  },
  {
    id: 'nb-fresh-foam-1080v13',
    name: 'Fresh Foam X 1080v13',
    brand: 'New Balance',
    price: 165,
    categories: ['daily', 'long'],
    surfaces: ['road'],
    cushion: 'max',
    weight: 'moderate',
    minWeeklyMiles: 25,
    maxWeeklyMiles: 70,
    description: 'Plush, premium ride for serious mileage.',
    whyCard: 'One of the most luxurious daily trainers available. Built for runners logging serious miles.',
    shopUrl: rwLink('catpage-NB1080M.html'),
    emoji: '👟',
  },
  {
    id: 'saucony-ride-17',
    name: 'Ride 17',
    brand: 'Saucony',
    price: 135,
    categories: ['daily'],
    surfaces: ['road'],
    cushion: 'moderate',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 55,
    description: 'Versatile workhorse from easy to tempo.',
    whyCard: 'Balanced cushion and responsiveness — transitions well between easy runs and faster workouts.',
    shopUrl: rwLink('catpage-SARIDEM.html'),
    emoji: '👟',
  },

  // ── Speed / workout shoes ─────────────────────────────────
  {
    id: 'nike-pegasus-41',
    name: 'Pegasus 41',
    brand: 'Nike',
    price: 130,
    categories: ['daily', 'speed'],
    surfaces: ['road'],
    cushion: 'moderate',
    weight: 'light',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 50,
    description: 'Nike\'s iconic do-everything trainer.',
    whyCard: 'Responsive enough for tempo runs, cushioned enough for easy days. A true all-rounder.',
    shopUrl: amazonLink('B0CGJB22RV'),
    emoji: '👟',
  },
  {
    id: 'asics-kayano-31',
    name: 'Gel-Kayano 31',
    brand: 'ASICS',
    price: 160,
    categories: ['daily', 'stability', 'beginner'],
    surfaces: ['road'],
    cushion: 'max',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 55,
    description: 'Max cushion with stability support.',
    whyCard: 'Combines serious cushion with a stable platform — ideal if you want a forgiving, supportive daily trainer.',
    shopUrl: rwLink('catpage-ASKAYM.html'),
    emoji: '👟',
  },

  // ── Carbon race shoes ─────────────────────────────────────
  {
    id: 'nike-vaporfly-3',
    name: 'Vaporfly 3',
    brand: 'Nike',
    price: 260,
    categories: ['race'],
    surfaces: ['road', 'track'],
    cushion: 'moderate',
    weight: 'light',
    minWeeklyMiles: 20,
    maxWeeklyMiles: 999,
    description: 'The shoe that changed racing. Carbon plate, ZoomX foam.',
    whyCard: 'Save these for race day and key workouts. Studies show ~4% improvement in running economy.',
    shopUrl: amazonLink('B0C3QPKRQR'),
    emoji: '⚡',
  },
  {
    id: 'saucony-endorphin-pro-4',
    name: 'Endorphin Pro 4',
    brand: 'Saucony',
    price: 225,
    categories: ['race', 'speed'],
    surfaces: ['road'],
    cushion: 'moderate',
    weight: 'light',
    minWeeklyMiles: 15,
    maxWeeklyMiles: 999,
    description: 'Carbon-plated rocket for PRs.',
    whyCard: 'One of the fastest shoes on the market. Nylon plate + PWRRUN HG foam = serious speed.',
    shopUrl: rwLink('catpage-SAENDPM.html'),
    emoji: '⚡',
  },
  {
    id: 'hoka-rocket-x-2',
    name: 'Rocket X 2',
    brand: 'Hoka',
    price: 200,
    categories: ['race', 'speed'],
    surfaces: ['road'],
    cushion: 'moderate',
    weight: 'light',
    minWeeklyMiles: 15,
    maxWeeklyMiles: 999,
    description: "Hoka's carbon racer — fast and protective.",
    whyCard: 'More cushion than most carbon racers — great if you want speed without sacrificing comfort on longer races.',
    shopUrl: rwLink('catpage-HKRKTXM.html'),
    emoji: '⚡',
  },

  // ── Trail shoes ───────────────────────────────────────────
  {
    id: 'hoka-speedgoat-6',
    name: 'Speedgoat 6',
    brand: 'Hoka',
    price: 155,
    categories: ['trail'],
    surfaces: ['trail'],
    cushion: 'max',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 999,
    description: 'The #1 ultra trail shoe on the planet.',
    whyCard: 'Aggressive Vibram outsole, max cushion, wide toe box. Built for long days on technical terrain.',
    shopUrl: rwLink('catpage-HKSPGM.html'),
    emoji: '🏔️',
  },
  {
    id: 'brooks-cascadia-17',
    name: 'Cascadia 17',
    brand: 'Brooks',
    price: 130,
    categories: ['trail'],
    surfaces: ['trail'],
    cushion: 'moderate',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 999,
    description: 'Rugged trail workhorse. Protective and durable.',
    whyCard: 'Rock plate protects your feet on technical terrain. Reliable for everything from dirt roads to gnarly singletrack.',
    shopUrl: rwLink('catpage-BRCASCM.html'),
    emoji: '🏔️',
  },
  {
    id: 'salomon-speedcross-6',
    name: 'Speedcross 6',
    brand: 'Salomon',
    price: 140,
    categories: ['trail'],
    surfaces: ['trail'],
    cushion: 'moderate',
    weight: 'moderate',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 999,
    description: 'Aggressive grip for muddy, technical trails.',
    whyCard: 'Chevron lugs dig into soft and muddy terrain. A favorite for trail runners who go off the beaten path.',
    shopUrl: amazonLink('B0B3QPKRQR'),
    emoji: '🏔️',
  },

  // ── Recovery shoes ────────────────────────────────────────
  {
    id: 'hoka-bondi-8',
    name: 'Bondi 8',
    brand: 'Hoka',
    price: 165,
    categories: ['recovery', 'long'],
    surfaces: ['road'],
    cushion: 'max',
    weight: 'heavy',
    minWeeklyMiles: 0,
    maxWeeklyMiles: 999,
    description: 'Maximum cushion for recovery runs and big miles.',
    whyCard: 'The most cushioned road shoe made. Gives your legs a break on recovery days and back-to-back long runs.',
    shopUrl: rwLink('catpage-HKBONDM.html'),
    emoji: '☁️',
  },
];

// ── Recommendation engine ─────────────────────────────────

export interface ShoeRecommendation {
  shoe: Shoe;
  rank: 1 | 2 | 3;
  reason: string;   // personalised one-liner shown in card
  slot: 'primary' | 'workout' | 'specialty';
  slotLabel: string;
}

interface RecommendationInput {
  goal: RunningGoal;
  ability: RunningAbility;
  weeklyMileage: number;
  trainingStyle: TrainingStyle;
  ownedShoeIds?: string[];   // IDs from shoe tracker — skip these
}

export function getShoeRecommendations(input: RecommendationInput): ShoeRecommendation[] {
  const { goal, ability, weeklyMileage, trainingStyle, ownedShoeIds = [] } = input;

  const isUltra   = goal === RunningGoal.Ultra50 || goal === RunningGoal.Ultra100;
  const isTrial   = isUltra; // ultra runners need trail shoes
  const isRacer   = [RunningGoal.FiveK, RunningGoal.TenK, RunningGoal.HalfMarathon,
                     RunningGoal.Marathon].includes(goal);
  const isSpeed   = trainingStyle === TrainingStyle.Aggressive || ability === RunningAbility.Advanced;
  const highMiles = weeklyMileage >= 35;
  const beginner  = ability === RunningAbility.Beginner;

  // Score each shoe
  const scored = SHOE_DB
    .filter(s => !ownedShoeIds.includes(s.id))
    .map(s => ({ shoe: s, score: scoreShoe(s, { goal, ability, weeklyMileage, trainingStyle, isUltra, isTrial, isRacer, isSpeed, highMiles, beginner }) }))
    .sort((a, b) => b.score - a.score);

  // Pick top 3 across different slots
  const picks: ShoeRecommendation[] = [];

  // Slot 1 — Primary daily trainer
  const primary = scored.find(s =>
    s.shoe.categories.some(c => ['daily', 'long', 'recovery', 'beginner', 'stability'].includes(c)) &&
    s.shoe.surfaces.includes('road')
  );
  if (primary) {
    picks.push({
      shoe: primary.shoe,
      rank: 1,
      reason: buildReason(primary.shoe, input, 'primary'),
      slot: 'primary',
      slotLabel: '🏃 Daily Trainer',
    });
  }

  // Slot 2 — Workout / speed shoe (or trail for ultra)
  const used = new Set(picks.map(p => p.shoe.id));
  const workout = isUltra
    ? scored.find(s => s.shoe.surfaces.includes('trail') && !used.has(s.shoe.id))
    : scored.find(s =>
        s.shoe.categories.some(c => ['speed', 'race', 'daily'].includes(c)) &&
        !used.has(s.shoe.id) &&
        s.shoe.id !== primary?.shoe.id
      );
  if (workout) {
    used.add(workout.shoe.id);
    picks.push({
      shoe: workout.shoe,
      rank: 2,
      reason: buildReason(workout.shoe, input, isUltra ? 'trail' : 'workout'),
      slot: 'workout',
      slotLabel: isUltra ? '🏔️ Trail Shoe' : '⚡ Workout Shoe',
    });
  }

  // Slot 3 — Specialty (race day / recovery / second trail)
  const specialty = scored.find(s => {
    if (used.has(s.shoe.id)) return false;
    if (isUltra) return s.shoe.categories.includes('recovery') || s.shoe.surfaces.includes('trail');
    if (isRacer && isSpeed) return s.shoe.categories.includes('race');
    return s.shoe.categories.includes('recovery') || s.shoe.categories.includes('race');
  });
  if (specialty) {
    picks.push({
      shoe: specialty.shoe,
      rank: 3,
      reason: buildReason(specialty.shoe, input, 'specialty'),
      slot: 'specialty',
      slotLabel: isUltra ? '☁️ Recovery' : isRacer ? '🏆 Race Day' : '☁️ Recovery',
    });
  }

  return picks;
}

function scoreShoe(
  shoe: Shoe,
  ctx: {
    goal: RunningGoal; ability: RunningAbility; weeklyMileage: number;
    trainingStyle: TrainingStyle; isUltra: boolean; isTrial: boolean;
    isRacer: boolean; isSpeed: boolean; highMiles: boolean; beginner: boolean;
  },
): number {
  let score = 50;

  // Mileage fit
  if (ctx.weeklyMileage >= shoe.minWeeklyMiles && ctx.weeklyMileage <= shoe.maxWeeklyMiles) score += 20;

  // Goal fit
  if (ctx.isUltra && shoe.surfaces.includes('trail')) score += 30;
  if (ctx.isUltra && shoe.cushion === 'max') score += 20;
  if (ctx.isRacer && shoe.categories.includes('race')) score += 25;
  if (ctx.isRacer && shoe.categories.includes('speed')) score += 15;
  if (ctx.highMiles && shoe.cushion === 'max') score += 20;
  if (ctx.highMiles && shoe.cushion === 'minimal') score -= 20;
  if (ctx.beginner && shoe.categories.includes('beginner')) score += 25;
  if (ctx.beginner && shoe.categories.includes('race')) score -= 15;
  if (ctx.isSpeed && shoe.weight === 'light') score += 15;
  if (ctx.goal === RunningGoal.GetFit && shoe.categories.includes('daily')) score += 15;
  if (ctx.goal === RunningGoal.Marathon && shoe.cushion === 'max') score += 15;

  return score;
}

function buildReason(shoe: Shoe, input: RecommendationInput, slot: string): string {
  const { weeklyMileage, goal, ability } = input;
  const isUltra = goal === RunningGoal.Ultra50 || goal === RunningGoal.Ultra100;

  if (slot === 'primary') {
    if (weeklyMileage >= 40) return `With ${weeklyMileage}+ miles a week, your feet need the ${shoe.name}'s ${shoe.cushion} cushion to stay fresh.`;
    if (ability === RunningAbility.Beginner) return `Perfect first serious trainer — forgiving, protective, and built to last your entire plan.`;
    return `Your go-to for easy runs, long runs, and everything in between.`;
  }
  if (slot === 'trail') return `Ultra training means time on trails. The ${shoe.name} handles technical terrain and back-to-back long days.`;
  if (slot === 'workout') {
    if (shoe.categories.includes('race')) return `Save for race day — carbon plate delivers a measurable speed boost when it counts.`;
    return `Lighter and more responsive for tempo runs and intervals. Keep these fresh for quality sessions.`;
  }
  if (slot === 'specialty') {
    if (shoe.categories.includes('recovery')) return `${shoe.name}'s max cushion gives your legs a real break on recovery days and after long efforts.`;
    if (shoe.categories.includes('race')) return `Your race day weapon. Rotate with your daily trainer to keep them fresh for the starting line.`;
  }
  return shoe.whyCard;
}
