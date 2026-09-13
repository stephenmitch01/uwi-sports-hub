import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATASET_ID = "ush-demo-v1";
const CURRENT_SEASON = "2026";
let preservedStephenRef = null;
const SPORTS = [
  { slug: "cricket", name: "Cricket", team: "UWI Blackbirds Cricket Team", division: "BCA 3-Day", roster: 24, genderPolicy: "male" },
  { slug: "track-and-field", name: "Track and Field", team: "UWI Blackbirds Track and Field Team", division: "Intercollegiate", roster: 30, genderPolicy: "mixed" },
  { slug: "football", name: "Football", team: "UWI Blackbirds Football Team", division: "Premier Division", roster: 28, genderPolicy: "male" },
  { slug: "basketball", name: "Basketball", team: "UWI Blackbirds Basketball Team", division: "League One", roster: 18, genderPolicy: "male" },
  { slug: "netball", name: "Netball", team: "UWI Blackbirds Netball Team", division: "Elite Division", roster: 18, genderPolicy: "female" },
  { slug: "volleyball", name: "Volleyball", team: "UWI Blackbirds Volleyball Team", division: "Championship", roster: 18, genderPolicy: "female" },
  { slug: "hockey", name: "Hockey", team: "UWI Blackbirds Hockey Team", division: "Open League", roster: 22, genderPolicy: "mixed" },
  { slug: "swimming", name: "Swimming", team: "UWI Blackbirds Swimming Team", division: "Aquatic Meet", roster: 18, genderPolicy: "mixed" },
  { slug: "badminton", name: "Badminton", team: "UWI Blackbirds Badminton Team", division: "Open", roster: 12, genderPolicy: "mixed" },
  { slug: "table-tennis", name: "Table Tennis", team: "UWI Blackbirds Table Tennis Team", division: "Open", roster: 12, genderPolicy: "mixed" },
  { slug: "lawn-tennis", name: "Lawn Tennis", team: "UWI Blackbirds Tennis Team", division: "Open", roster: 12, genderPolicy: "mixed" },
  { slug: "taekwondo", name: "Taekwondo", team: "UWI Blackbirds Taekwondo Team", division: "Poomsae", roster: 12, genderPolicy: "mixed" },
  { slug: "chess", name: "Chess", team: "UWI Blackbirds Chess Team", division: "Board League", roster: 12, genderPolicy: "mixed" }
];

const MALE_FIRST_NAMES = [
  "Akil", "Andre", "Ari", "Caleb", "Dante", "Jabari", "Jalen", "Kai", "Kemar", "Malik",
  "Micah", "Omar", "Rafael", "Tariq", "Mateo", "Diego", "Noah", "Nathan", "Jevon", "Dario",
  "Nikolai", "Shamar", "Kadeem", "Xavier", "Adrian", "Marcus", "Liam", "Ethan", "Joel", "Rohan"
];
const FEMALE_FIRST_NAMES = [
  "Aaliyah", "Amara", "Anika", "Brianna", "Camille", "Elena", "Imani", "Janelle", "Keisha", "Leah",
  "Maya", "Nadia", "Naomi", "Nia", "Priya", "Renee", "Sasha", "Selena", "Tiana", "Zara",
  "Lucia", "Sofia", "Isla", "Gabrielle", "Arielle", "Mikayla", "Serena", "Thalia", "Kiara", "Jada"
];
const LAST_NAMES = [
  "Alleyne", "Baptiste", "Best", "Browne", "Clarke", "Dacosta", "Forde", "Francis", "Gittens", "Grant",
  "Griffith", "Haynes", "Holder", "James", "Joseph", "King", "Lewis", "Marshall", "Mendes", "Morgan",
  "Narine", "Nurse", "Phillips", "Pierre", "Ramdin", "Richards", "Roberts", "Samuels", "Scott", "Sealy",
  "Singh", "Smith", "Taylor", "Thomas", "Williams", "Wilson", "Yarde", "Young", "Campbell", "Bennett"
];
const COACH_FIRST_NAMES = ["Marcia", "Dwayne", "Althea", "Gavin", "Nerissa", "Julian", "Petra", "Ricardo", "Simone", "Trevor", "Ansel", "Monique", "Devon", "Camila", "Evan"];
const COACH_LAST_NAMES = ["Bishop", "Cumberbatch", "Walcott", "Prescod", "Weekes", "Brathwaite", "Small", "Roach", "Chase", "Hinds", "Browne", "Charles", "Hope", "Maharaj", "Gray"];
const OPPONENTS = ["Gladiola", "Wanderers", "Empire", "Carlton", "YMPC", "Lodge School", "Spartans", "Titans", "Mavericks", "Hurricanes", "Royals", "Cavaliers", "Rangers"];
const VENUES = ["3Ws Oval", "Usain Bolt Sports Complex", "Sir Garfield Sobers Gymnasium", "Cave Hill Courts", "UWI Aquatic Centre", "Paradise Park", "National Stadium"];
const SPORT_INDEX = new Map(SPORTS.map((sport, index) => [sport.slug, index]));
const COMPETITION_SERIES = ["Campus Series", "League Round", "Championship Match", "Inter-Campus Meet", "Open Invitational", "Knockout Round", "Ranking Event", "Season Showcase"];
const CRICKET_FORMATS = ["T20", "40 Over", "50 Over", "BCA 3-Day", "Other Format"];

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const sizeArg = process.argv.find((arg) => arg.startsWith("--size="));
  return {
    reset: args.has("--reset"),
    dryRun: args.has("--dry-run"),
    size: sizeArg ? sizeArg.split("=")[1] : process.env.USH_DEMO_SEED_SIZE || "presentation"
  };
}

function idFor(kind, key) {
  const hash = crypto.createHash("sha1").update(`${DATASET_ID}:${kind}:${key}`).digest("hex");
  const variant = ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function seededRandom(seed) {
  let value = crypto.createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const rand = seededRandom(DATASET_ID);
const pick = (items, offset = 0) => items[Math.floor((rand() * items.length + offset) % items.length)];
const iso = (date) => new Date(date).toISOString();
const day = (month, date) => iso(`2026-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}T15:00:00.000Z`);
const seasonDate = (offset, hour = 15) => {
  const date = new Date(Date.UTC(2026, 1, 1 + offset, hour, 0, 0));
  return date.toISOString();
};

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}

function getData(record) {
  return record?.data && typeof record.data === "object" ? record.data : {};
}

function getFullName(record) {
  const data = getData(record);
  return data.fullName || [record?.firstName || data.firstName, record?.lastName || data.lastName].filter(Boolean).join(" ");
}

async function validateSeedTarget() {
  const allowedSizes = new Set(["presentation", "large"]);
  const requestedSize = parseArgs().size;
  if (!allowedSizes.has(requestedSize)) {
    throw new Error(`Refusing to seed: unsupported dataset size "${requestedSize}". Use "presentation" or "large".`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production.");
  }
  if (process.env.USH_DEMO_SEED_ALLOW !== "true") {
    throw new Error("Refusing to seed: set USH_DEMO_SEED_ALLOW=true for this one command.");
  }
  const databasePurpose = String(process.env.USH_DEMO_DATABASE_PURPOSE || "").trim().toLowerCase();
  if (!["demo", "development", "local"].includes(databasePurpose)) {
    throw new Error('Refusing to seed: set USH_DEMO_DATABASE_PURPOSE to "demo", "development", or "local".');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("Refusing to seed: DATABASE_URL is not configured.");
  }
  if (!process.env.USH_DEMO_DATABASE_REF) {
    throw new Error("Refusing to seed: set USH_DEMO_DATABASE_REF to the Supabase project ref you intend to reset.");
  }

  const databaseRef = extractProjectRef(process.env.DATABASE_URL);
  const supabaseRef = extractSupabaseRef(process.env.SUPABASE_URL || "");
  const expectedRef = String(process.env.USH_DEMO_DATABASE_REF || "").trim();
  const isLocalDatabase = isLocalDatabaseUrl(process.env.DATABASE_URL);
  if (!databaseRef && !isLocalDatabase) {
    throw new Error("Refusing to seed: DATABASE_URL is not a recognized Supabase or local development database URL.");
  }
  if (isLocalDatabase && expectedRef !== "local") {
    throw new Error('Refusing to seed: local database URLs must use USH_DEMO_DATABASE_REF="local".');
  }
  if (databaseRef && databaseRef !== expectedRef) {
    throw new Error(`Refusing to seed: DATABASE_URL project ref "${databaseRef}" does not match USH_DEMO_DATABASE_REF "${expectedRef}".`);
  }
  if (supabaseRef && supabaseRef !== expectedRef) {
    throw new Error(`Refusing to seed: SUPABASE_URL project ref "${supabaseRef}" does not match USH_DEMO_DATABASE_REF "${expectedRef}".`);
  }
  if (/prod|production/i.test(process.env.DATABASE_URL) && process.env.USH_DEMO_ALLOW_PRODUCTION_LIKE_URL !== "true") {
    throw new Error("Refusing to seed: DATABASE_URL contains production-like wording.");
  }
}

function extractProjectRef(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const username = decodeURIComponent(url.username || "");
    const userMatch = username.match(/^postgres\.([a-z0-9]+)$/i);
    if (userMatch) return userMatch[1];
    const hostMatch = url.hostname.match(/(?:db|pooler)\.([a-z0-9]+)\.supabase\.(?:co|com)$/i);
    if (hostMatch) return hostMatch[1];
    return "";
  } catch {
    return "";
  }
}

function extractSupabaseRef(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

function isLocalDatabaseUrl(databaseUrl) {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Finds the one real athlete the demo seed is allowed to preserve.
 *
 * The lookup accepts Mitchel/Mitchell spelling variations but deliberately
 * requires exactly one match before any destructive reset can run.
 */
async function findStephenAthlete() {
  const athletes = await prisma.athlete.findMany();
  const matches = athletes.filter((athlete) => {
    const first = normalizeName(athlete.firstName || getData(athlete).firstName);
    const last = normalizeName(athlete.lastName || getData(athlete).lastName);
    const full = normalizeName(getFullName(athlete));
    return (first === "stephen" && ["mitchel", "mitchell"].includes(last)) || ["stephenmitchel", "stephenmitchell"].includes(full);
  });
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one Stephen Mitchel athlete record to preserve; found ${matches.length}. No data was changed.`);
  }
  return matches[0];
}

async function resetDemoDatabase(db, campus, stephenId) {
  // The schema intentionally stores loose application relationships without
  // database-level foreign keys, so reset order mirrors the logical dependency
  // graph used by the frontend: stats/results, assignments, events, people.
  await db.athletePersonalBest.deleteMany({});
  await db.athleteStatLine.deleteMany({});
  await db.competitionStatLine.deleteMany({});
  await db.competitionResult.deleteMany({});
  await db.competitionParticipant.deleteMany({});
  await db.competitionUnit.deleteMany({});
  await db.teamRosterAssignment.deleteMany({});
  await db.teamStaffAssignment.deleteMany({});
  await db.supportRequest.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.competition.deleteMany({});
  await db.team.deleteMany({});
  await db.coach.deleteMany({});
  await db.athlete.deleteMany({ where: { id: { not: stephenId } } });
  await db.userProfile.deleteMany({
    where: {
      email: {
        in: ["demo.admin@ush.test", "demo.manager@ush.test", "demo.viewer@ush.test"]
      }
    }
  });
  console.log(`Reset complete for demo campus ${campus}; preserved athlete ${stephenId}.`);
}

function buildTeams(campus) {
  return SPORTS.map((sport) => ({
    id: idFor("team", sport.slug),
    campus,
    sport: sport.slug,
    name: sport.team,
    status: "active",
    data: {
      seedDataset: DATASET_ID,
      name: sport.team,
      teamName: sport.team,
      campus,
      sport: sport.slug,
      sportSlug: sport.slug,
      division: sport.slug === "badminton" ? "" : sport.division,
      season: CURRENT_SEASON,
      seasonLabel: CURRENT_SEASON,
      status: "active",
      homeVenue: sport.slug === "swimming" ? "UWI Aquatic Centre" : "Cave Hill Campus",
      notes: sport.slug === "chess" ? "" : `Presentation-ready ${sport.name.toLowerCase()} squad for the ${CURRENT_SEASON} season.`
    }
  }));
}

function genderForSport(sportSlug, index) {
  const policy = SPORTS.find((sport) => sport.slug === sportSlug)?.genderPolicy || "mixed";
  if (policy === "male" || policy === "female") return policy;
  return index % 2 === 0 ? "female" : "male";
}

function athleteSeedProfile(sportSlug, index) {
  const gender = genderForSport(sportSlug, index);
  const sportOffset = SPORT_INDEX.get(sportSlug) || 0;
  const firstPool = gender === "female" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES;
  const firstName = firstPool[(index * 3 + sportOffset) % firstPool.length];
  const lastName = LAST_NAMES[(index * 5 + sportOffset * 2) % LAST_NAMES.length];
  return { firstName, lastName, fullName: `${firstName} ${lastName}`, gender };
}

function buildAthletes(campus, multiplier) {
  const athletes = [];
  let sequence = 0;
  for (const sport of SPORTS) {
    const count = sport.roster * multiplier;
    for (let i = 0; i < count; i += 1) {
      sequence += 1;
      const { firstName, lastName, fullName, gender } = athleteSeedProfile(sport.slug, i);
      const missingOptional = sequence % 47 === 0;
      athletes.push({
        id: idFor("athlete", `${sport.slug}-${i}`),
        campus,
        sport: sport.slug,
        firstName,
        lastName,
        status: i > sport.roster - 4 ? "reserve" : "active",
        data: {
          seedDataset: DATASET_ID,
          firstName,
          lastName,
          fullName,
          athleteType: "Student-Athlete",
          dateOfBirth: missingOptional ? "" : `${1999 + (sequence % 7)}-${String(1 + (sequence % 12)).padStart(2, "0")}-${String(1 + (sequence % 26)).padStart(2, "0")}`,
          gender,
          sex: gender.charAt(0).toUpperCase() + gender.slice(1),
          email: missingOptional ? "" : `${firstName}.${lastName}.${sequence}@athletes.ush.test`.toLowerCase(),
          phone: missingOptional ? "" : `246-555-${String(1000 + sequence).slice(-4)}`,
          studentId: `UWID${String(2026000 + sequence)}`,
          yearOfStudy: String(1 + (sequence % 4)),
          faculty: ["Science and Technology", "Social Sciences", "Humanities and Education", "Medical Sciences"][sequence % 4],
          program: ["Management", "Computer Science", "Kinesiology", "Economics", "Biology"][sequence % 5],
          facultyProgram: "",
          nationality: ["Barbadian", "Trinidadian", "Jamaican", "Vincentian", "Guyanese", "Grenadian"][sequence % 6],
          hometown: ["Bridgetown", "Speightstown", "Port of Spain", "Kingston", "Georgetown", "Castries"][sequence % 6],
          status: i > sport.roster - 4 ? "reserve" : "active",
          campus,
          primarySport: sport.slug,
          sport: sport.slug,
          sportSlug: sport.slug,
          sports: [sport.slug],
          position: positionForSport(sport.slug, i),
          events: eventsForSport(sport.slug, i),
          imageUrl: sequence % 31 === 0 ? "" : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
          bio: missingOptional ? "" : `${fullName} is a fictional demo ${sport.name.toLowerCase()} athlete used for development and presentation testing.`,
          profile: {
            sportSlug: sport.slug,
            position: positionForSport(sport.slug, i),
            eventsSpecialties: eventsForSport(sport.slug, i).join(", "),
            heightCm: gender === "female" ? 158 + (sequence % 26) : 170 + (sequence % 28),
            weightKg: gender === "female" ? 52 + (sequence % 26) : 64 + (sequence % 34),
            dominantHand: sequence % 3 === 0 ? "Left" : "Right",
            dominantLeg: sequence % 4 === 0 ? "Left" : "Right",
            dateOfBirth: missingOptional ? "" : `${1999 + (sequence % 7)}-${String(1 + (sequence % 12)).padStart(2, "0")}-${String(1 + (sequence % 26)).padStart(2, "0")}`,
            gender,
            sex: gender.charAt(0).toUpperCase() + gender.slice(1),
            faculty: ["Science and Technology", "Social Sciences", "Humanities and Education", "Medical Sciences"][sequence % 4],
            program: ["Management", "Computer Science", "Kinesiology", "Economics", "Biology"][sequence % 5],
            nationality: ["Barbadian", "Trinidadian", "Jamaican", "Vincentian", "Guyanese", "Grenadian"][sequence % 6],
            hometown: ["Bridgetown", "Speightstown", "Port of Spain", "Kingston", "Georgetown", "Castries"][sequence % 6]
          }
        }
      });
    }
  }
  return athletes;
}

function positionForSport(sport, index) {
  const positions = {
    cricket: ["Batter", "Bowler", "All-rounder", "Wicketkeeper"],
    football: ["Forward", "Midfielder", "Defender", "Goalkeeper"],
    basketball: ["Guard", "Forward", "Center"],
    netball: ["GS", "GA", "WA", "C", "WD", "GD", "GK"],
    volleyball: ["Outside Hitter", "Setter", "Middle Blocker", "Libero"],
    hockey: ["Forward", "Midfielder", "Defender", "Goalkeeper"],
    swimming: ["Freestyle", "Butterfly", "Backstroke", "Breaststroke"],
    badminton: ["Singles", "Doubles"],
    "table-tennis": ["Singles", "Doubles"],
    "lawn-tennis": ["Singles", "Doubles"],
    taekwondo: ["Poomsae", "Sparring"],
    chess: ["Board Player", "Captain"],
    "track-and-field": ["Sprinter", "Jumper", "Thrower", "Middle Distance"]
  };
  return (positions[sport] || ["Athlete"])[index % (positions[sport] || ["Athlete"]).length];
}

function eventsForSport(sport, index) {
  const events = {
    "track-and-field": [["100m", "200m"], ["400m", "4x400m"], ["Long Jump", "Triple Jump"], ["Shot Put", "Discus"]],
    swimming: [["50m Freestyle", "100m Freestyle"], ["100m Butterfly"], ["200m IM"], ["100m Backstroke"]],
    taekwondo: [["Poomsae"], ["Sparring"]],
    chess: [["Classical", "Rapid"]],
    cricket: [["T20", "3-Day"]],
    football: [["League", "Cup"]],
    basketball: [["League"]],
    netball: [["League"]],
    volleyball: [["League"]],
    hockey: [["League"]],
    badminton: [["Singles", "Doubles"]],
    "table-tennis": [["Singles", "Doubles"]],
    "lawn-tennis": [["Singles", "Doubles"]]
  };
  return (events[sport] || [["Competition"]])[index % (events[sport] || [["Competition"]]).length];
}

function buildCoaches(campus) {
  return SPORTS.flatMap((sport, sportIndex) => [0, 1].map((slot) => {
    const firstName = COACH_FIRST_NAMES[(sportIndex + slot) % COACH_FIRST_NAMES.length];
    const lastName = COACH_LAST_NAMES[(sportIndex * 2 + slot) % COACH_LAST_NAMES.length];
    const role = slot === 0 ? "head_coach" : "assistant_coach";
    return {
      id: idFor("coach", `${sport.slug}-${slot}`),
      campus,
      sport: sport.slug,
      firstName,
      lastName,
      status: "active",
      data: {
        seedDataset: DATASET_ID,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName}.${lastName}.${sport.slug}@coaches.ush.test`.toLowerCase(),
        phone: `246-555-${String(5000 + sportIndex * 10 + slot)}`,
        campus,
        primarySport: sport.slug,
        sportSlug: sport.slug,
        role,
        primaryRole: role,
        status: "active",
        qualifications: slot === 0 ? "Level 2 coaching certification" : "Assistant coaching certification",
        bio: `Fictional demo ${sport.name.toLowerCase()} ${slot === 0 ? "lead" : "assistant"} coach.`
      }
    };
  }));
}

function buildRosterAssignments(campus, stephen, fictionalAthletes) {
  const rows = [];
  const athleteBySport = groupBy(fictionalAthletes, (athlete) => athlete.sport);
  const stephenSports = inferStephenSports(stephen);
  for (const sport of SPORTS) {
    const teamId = idFor("team", sport.slug);
    const sportAthletes = athleteBySport.get(sport.slug) || [];
    const includeStephen = stephenSports.includes(sport.slug) || ["cricket", "track-and-field"].includes(sport.slug);
    const roster = includeStephen ? [stephen, ...sportAthletes] : sportAthletes;
    roster.slice(0, Math.max(5, sport.roster)).forEach((athlete, index) => {
      const athleteId = athlete.id;
      const roleLabel = athlete.id === stephen.id ? stephenRoleForSport(sport.slug) : positionForSport(sport.slug, index + 1);
      rows.push({
        id: idFor("roster", `${sport.slug}-${athleteId}`),
        teamId,
        athleteId,
        campus,
        data: {
          seedDataset: DATASET_ID,
          teamId,
          athleteId,
          teamName: sport.team,
          sportSlug: sport.slug,
          roleLabel,
          jerseyNumber: sport.slug === "track-and-field" || sport.slug === "swimming" ? "" : String(1 + index),
          isCaptain: index === 0,
          status: "ACTIVE"
        }
      });
    });
  }
  return rows;
}

function inferStephenSports(stephen) {
  const data = getData(stephen);
  const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
  const values = [
    stephen.sport,
    data.sport,
    data.sportSlug,
    data.primarySport,
    profile.sportSlug,
    ...(Array.isArray(data.sports) ? data.sports : [])
  ].filter(Boolean);
  const known = new Set(SPORTS.map((sport) => sport.slug));
  const normalized = values.map(normalizeSport).filter((sport) => known.has(sport));
  return Array.from(new Set(normalized.length ? normalized : ["cricket", "track-and-field"]));
}

function normalizeSport(value) {
  const slug = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (slug === "track" || slug === "track-field" || slug === "trackandfield") return "track-and-field";
  if (slug === "soccer") return "football";
  if (slug === "tennis") return "lawn-tennis";
  return slug;
}

function stephenRoleForSport(sport) {
  if (sport === "cricket") return "Top-order batter";
  if (sport === "track-and-field") return "Sprinter";
  return "Athlete";
}

function buildStaffAssignments(campus) {
  return SPORTS.flatMap((sport) => [0, 1].map((slot) => ({
    id: idFor("staff", `${sport.slug}-${slot}`),
    teamId: idFor("team", sport.slug),
    coachId: idFor("coach", `${sport.slug}-${slot}`),
    campus,
    data: {
      seedDataset: DATASET_ID,
      teamId: idFor("team", sport.slug),
      coachId: idFor("coach", `${sport.slug}-${slot}`),
      role: slot === 0 ? "head_coach" : "assistant_coach",
      isPrimary: slot === 0,
      status: "active"
    }
  })));
}

function buildCompetitions(campus, multiplier) {
  const competitions = [];
  const units = [];
  const participants = [];
  const results = [];
  const statLines = [];
  const completedCount = multiplier > 1 ? 40 : 16;
  const upcomingCount = multiplier > 1 ? 8 : 4;

  SPORTS.forEach((sport, sportIndex) => {
    const teamId = idFor("team", sport.slug);

    for (let matchIndex = 0; matchIndex < completedCount; matchIndex += 1) {
      const competitionId = idFor("competition", `${sport.slug}-completed-${matchIndex}`);
      const opponent = OPPONENTS[(sportIndex + matchIndex) % OPPONENTS.length];
      const venue = VENUES[(sportIndex + matchIndex) % VENUES.length];
      const sequence = sportIndex * 100 + matchIndex;
      const startDate = seasonDate(sportIndex * 3 + matchIndex * 9);
      const name = `${sport.name} ${COMPETITION_SERIES[matchIndex % COMPETITION_SERIES.length]} ${matchIndex + 1}`;
      const format = sport.slug === "cricket" ? CRICKET_FORMATS[matchIndex % CRICKET_FORMATS.length] : sport.division;

      competitions.push(competitionRow({ id: competitionId, campus, sport, name, status: "completed", startDate, opponent, venue, format }));
      units.push(unitRow(campus, competitionId, sport, `Round ${matchIndex + 1}`, matchIndex + 1));
      participants.push(participantRow(campus, competitionId, teamId, "team", sport.team));
      participants.push(participantRow(campus, competitionId, idFor("opponent", `${sport.slug}-${matchIndex}`), "team", opponent));
      results.push(resultRow(campus, competitionId, teamId, sport, opponent, sequence, startDate));
      const scorecardRows = scorecardRowsForSport(campus, competitionId, sport, opponent, venue, sequence, name, startDate, format);
      statLines.push(...scorecardRows, ...playerSummaryLinesForScorecards(campus, sport, competitionId, teamId, scorecardRows, sequence));
    }

    for (let fixtureIndex = 0; fixtureIndex < upcomingCount; fixtureIndex += 1) {
      const competitionId = idFor("competition", `${sport.slug}-upcoming-${fixtureIndex}`);
      const opponent = OPPONENTS[(sportIndex + completedCount + fixtureIndex) % OPPONENTS.length];
      const venue = VENUES[(sportIndex + fixtureIndex + 2) % VENUES.length];
      const startDate = seasonDate(230 + sportIndex * 3 + fixtureIndex * 14);
      const name = `${sport.name} Upcoming Fixture ${fixtureIndex + 1}`;

      competitions.push(competitionRow({ id: competitionId, campus, sport, name, status: "scheduled", startDate, opponent, venue, format: sport.slug === "cricket" ? CRICKET_FORMATS[(completedCount + fixtureIndex) % CRICKET_FORMATS.length] : sport.division }));
      units.push(unitRow(campus, competitionId, sport, "Scheduled Fixture", fixtureIndex + 1));
      participants.push(participantRow(campus, competitionId, teamId, "team", sport.team));
      participants.push(participantRow(campus, competitionId, idFor("opponent", `${sport.slug}-upcoming-${fixtureIndex}`), "team", opponent));
    }
  });
  return { competitions, units, participants, results, statLines };
}

function competitionRow({ id, campus, sport, name, status, startDate, opponent, venue, format }) {
  return {
    id,
    campus,
    sport: sport.slug,
    name,
    status,
    startDate: new Date(startDate),
    endDate: new Date(startDate),
    data: {
      seedDataset: DATASET_ID,
      name,
      title: name,
      campus,
      campusOwner: campus,
      sport: sport.slug,
      sportSlug: sport.slug,
      format: format || sport.division,
      status,
      startDate,
      endDate: startDate,
      season: CURRENT_SEASON,
      teamId: idFor("team", sport.slug),
      teamName: sport.team,
      opponentName: opponent,
      venue,
      description: status === "scheduled" ? "Upcoming demo fixture with no result yet." : `Completed demo ${sport.name.toLowerCase()} competition.`
    }
  };
}

function unitRow(campus, competitionId, sport, label, sequence) {
  return {
    id: idFor("unit", `${competitionId}-${label}`),
    competitionId,
    campus,
    data: {
      seedDataset: DATASET_ID,
      name: label,
      label,
      type: sport.slug === "track-and-field" || sport.slug === "swimming" ? "event" : "round",
      sequence,
      sportSlug: sport.slug
    }
  };
}

function participantRow(campus, competitionId, subjectId, subjectType, name) {
  return {
    id: idFor("participant", `${competitionId}-${subjectId}`),
    competitionId,
    subjectId,
    subjectType,
    campus,
    data: { seedDataset: DATASET_ID, subjectId, subjectType, name, status: "confirmed" }
  };
}

function resultRow(campus, competitionId, teamId, sport, opponent, index, date = seasonDate(index + 20)) {
  const score = scoreForSport(sport.slug, index);
  return {
    id: idFor("result", competitionId),
    competitionId,
    teamId,
    athleteId: null,
    campus,
    sport: sport.slug,
    data: {
      seedDataset: DATASET_ID,
      competitionId,
      teamId,
      sport: sport.slug,
      sportSlug: sport.slug,
      opponentName: opponent,
      result: score.result,
      score: { uwi: score.uwi, opponent: score.opponent },
      date
    }
  };
}

function scoreForSport(sportSlug, index) {
  const close = index % 5 === 0;
  if (sportSlug === "cricket") {
    const uwi = 138 + (index * 17) % 155;
    const opponent = Math.max(80, uwi - (close ? 8 + (index % 9) : 24 + (index % 65)));
    return { uwi, opponent, result: `Blackbirds won by ${uwi - opponent} runs` };
  }
  if (sportSlug === "football" || sportSlug === "hockey") {
    const uwi = 1 + (index % 4);
    const opponent = close ? Math.max(0, uwi - 1) : index % 3;
    return { uwi, opponent, result: `Blackbirds won ${uwi}-${opponent}` };
  }
  if (sportSlug === "basketball") {
    const uwi = 72 + (index * 5) % 34;
    const opponent = Math.max(58, uwi - (6 + (index % 18)));
    return { uwi, opponent, result: `Blackbirds won ${uwi}-${opponent}` };
  }
  if (sportSlug === "netball") {
    const uwi = 44 + (index * 4) % 25;
    const opponent = Math.max(31, uwi - (4 + (index % 12)));
    return { uwi, opponent, result: `Blackbirds won ${uwi}-${opponent}` };
  }
  if (sportSlug === "volleyball") return { uwi: 3, opponent: close ? 2 : 1, result: `Blackbirds won 3-${close ? 2 : 1}` };
  return { uwi: 1, opponent: 0, result: "Blackbirds result recorded" };
}

function playerSummaryLinesForScorecards(campus, sport, competitionId, teamId, scorecardRows, index) {
  if (["cricket", "football", "basketball", "track-and-field"].includes(sport.slug)) return [];
  const lines = [];
  scorecardRows.forEach((row, rowIndex) => {
    const data = row.data?.statData || row.data || {};
    const addLine = (athlete, values, suffix) => {
      if (!athlete?.athleteId) return;
      lines.push({
        id: idFor("scorecard-athlete-summary", `${competitionId}-${athlete.athleteId}-${suffix}`),
        competitionId,
        subjectId: athlete.athleteId,
        subjectType: "athlete",
        teamId,
        athleteId: athlete.athleteId,
        campus,
        sport: sport.slug,
        data: {
          seedDataset: DATASET_ID,
          competitionId,
          teamId,
          athleteId: athlete.athleteId,
          playerName: athlete.name,
          sport: sport.slug,
          sportSlug: sport.slug,
          title: data.title,
          eventName: data.eventName || data.title,
          competitionName: data.title,
          date: data.date,
          result: data.result,
          ...values
        }
      });
    };

    (data.playerStats || []).forEach((player, playerIndex) => addLine(player, {
      goals: Number(player.goals || 0),
      assists: Number(player.goalAssists || player.assists || 0),
      saves: Number(player.saves || 0),
      points: Number(player.points || player.goals || player.kills || 0),
      rebounds: Number(player.rebounds || 0),
      kills: Number(player.kills || 0),
      aces: Number(player.aces || 0),
      blocks: Number(player.blocks || 0),
      wins: /won|win/i.test(String(data.result || "")) ? 1 : 0,
      entries: 1
    }, `${rowIndex}-player-${playerIndex}`));

    (data.lanes || []).forEach((lane, laneIndex) => addLine(lane, {
      points: Number(lane.points || 0),
      wins: Number(lane.place || 0) === 1 ? 1 : 0,
      entries: 1,
      resultTime: lane.finalTime
    }, `${rowIndex}-lane-${laneIndex}`));

    (data.uwiPlayers || []).forEach((player, playerIndex) => addLine(player, {
      wins: Number(data.summary?.uwiGamesWon || 0) > Number(data.summary?.opponentGamesWon || 0) ? 1 : 0,
      points: Number(data.summary?.pointDifferential || 0),
      entries: 1
    }, `${rowIndex}-racket-${playerIndex}`));

    (data.rubbers || []).forEach((rubber, rubberIndex) => {
      (rubber.uwiPlayers || []).forEach((player, playerIndex) => addLine(player, {
        wins: rubber.winner === "UWI" ? 1 : 0,
        points: Number(rubber.uwiGames || 0),
        entries: 1
      }, `${rowIndex}-rubber-${rubberIndex}-${playerIndex}`));
    });

    (data.matches || []).forEach((match, matchIndex) => {
      (match.uwiPlayers || []).forEach((player, playerIndex) => addLine(player, {
        wins: match.winner === "UWI" ? 1 : 0,
        points: Number(match.uwiSets || 0),
        entries: 1
      }, `${rowIndex}-match-${matchIndex}-${playerIndex}`));
    });

    if (data.athlete) addLine(data.athlete, { points: Number(data.summary?.finalScore || 0), wins: Number(data.summary?.rank || 0) === 1 ? 1 : 0, entries: 1 }, `${rowIndex}-taekwondo`);
    if (data.uwiPlayer) addLine(data.uwiPlayer, { points: Number(data.summary?.uwiScore || 0), wins: /win/i.test(String(data.summary?.resultLabel || "")) ? 1 : 0, entries: 1 }, `${rowIndex}-chess`);
  });
  return lines;
}

function scorecardRowsForSport(campus, competitionId, sport, opponent, venue, index, title = `${sport.name} Campus Series ${CURRENT_SEASON}`, startDate = day(4, 1), format = sport.division) {
  const teamId = idFor("team", sport.slug);
  const common = {
    id: idFor("scorecard", `${competitionId}-${sport.slug}`),
    competitionId,
    subjectId: teamId,
    subjectType: "team",
    teamId,
    athleteId: null,
    campus,
    sport: sport.slug
  };
  if (sport.slug === "cricket") return [scorecardRow(common, cricketScorecard(competitionId, teamId, title, opponent, venue, index, startDate, format))];
  if (sport.slug === "football") return [scorecardRow(common, footballScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "basketball") return [scorecardRow(common, basketballScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "track-and-field") return trackFieldScorecards(campus, competitionId, teamId, title, venue, index, startDate).map(wrapScorecardRow);
  if (sport.slug === "swimming") return [scorecardRow(common, swimmingScorecard(competitionId, teamId, title, venue, index, startDate))];
  if (sport.slug === "netball") return [scorecardRow(common, netballScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "volleyball") return [scorecardRow(common, volleyballScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "hockey") return [scorecardRow(common, hockeyScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "badminton") return [scorecardRow(common, badmintonScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "table-tennis") return [scorecardRow(common, tableTennisScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "lawn-tennis") return [scorecardRow(common, tennisScorecard(competitionId, teamId, title, opponent, venue, index, startDate))];
  if (sport.slug === "taekwondo") {
    const athlete = athleteRef("taekwondo", index % (SPORTS.find((item) => item.slug === "taekwondo")?.roster || 1));
    return [scorecardRow(common, taekwondoScorecard(competitionId, teamId, title, athlete, venue, index, startDate), { subjectId: athlete.athleteId, subjectType: "athlete", athleteId: athlete.athleteId, teamId })];
  }
  if (sport.slug === "chess") {
    const athlete = athleteRef("chess", index % (SPORTS.find((item) => item.slug === "chess")?.roster || 1));
    return [scorecardRow(common, chessScorecard(competitionId, teamId, title, athlete, opponent, venue, index, startDate), { subjectId: athlete.athleteId, subjectType: "athlete", athleteId: athlete.athleteId, teamId })];
  }
  return [];
}

function scorecardRow(common, data, overrides = {}) {
  return { ...common, ...overrides, data: withStatData(data) };
}

function wrapScorecardRow(row) {
  return { ...row, data: withStatData(row.data || {}) };
}

function withStatData(data) {
  // Frontend pages consume flattened fields, while report aggregators also look
  // for `statData`; keeping both shapes makes seeded records match saved forms.
  return { ...data, statData: data };
}

function athleteRef(sport, index) {
  const id = idFor("athlete", `${sport}-${index}`);
  const { fullName } = athleteSeedProfile(sport, index);
  return { athleteId: id, id, name: fullName };
}

function teamAthletes(sport, count, offset = 0) {
  const rosterSize = SPORTS.find((item) => item.slug === sport)?.roster || count;
  const rows = Array.from({ length: count }, (_, index) => athleteRef(sport, (offset + index) % rosterSize));
  if (preservedStephenRef && ["cricket", "track-and-field"].includes(sport)) rows.unshift(preservedStephenRef);
  return rows.slice(0, count);
}

function sumStats(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function splitTotal(total, parts, variance = 0) {
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => Math.max(0, base + (index < remainder ? 1 : 0) + (index % 2 === 0 ? variance : -variance)));
}

function percent(made, attempts) {
  return attempts ? `${Math.round((made / attempts) * 100)}%` : "";
}

function opponentRoster(opponentName, count, label = "Player") {
  return Array.from({ length: count }, (_, index) => ({ name: `${opponentName} ${label} ${index + 1}`, slot: index + 1 }));
}

function cricketScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(4, 30), format = "BCA 3-Day") {
  const players = teamAthletes("cricket", 11, index);
  const opponentPlayers = Array.from({ length: 11 }, (_, playerIndex) => ({
    athleteId: null,
    id: "",
    name: `${opponentName} Player ${playerIndex + 1}`,
    side: "opponent"
  }));
  const oversLabel = format.includes("50") ? "50" : format.includes("40") ? "40" : format.includes("3-Day") ? "82.4" : "20";
  const batting = players.map((player, rowIndex) => ({
    ...player,
    side: "uwi",
    runs: Math.max(0, [72, 44, 31, 18, 10, 6, 23, 4, 0, 12, 1][rowIndex] + ((competitionId.charCodeAt(0) + rowIndex) % 9) - 4),
    minutes: 18 + rowIndex * 9 + (index % 8),
    balls: [96, 60, 45, 20, 12, 7, 28, 9, 2, 19, 4][rowIndex] + (rowIndex % 3),
    fours: rowIndex < 5 ? 1 + ((rowIndex + competitionId.length) % 5) : 0,
    sixes: rowIndex < 3 ? (rowIndex + competitionId.length) % 3 : 0,
    dismissalMode: rowIndex === 10 ? "not out" : ["caught", "bowled", "lbw", "run out", "stumped"][rowIndex % 5],
    dismissalLabel: rowIndex === 10 ? "Not out" : ["Caught", "Bowled", "LBW", "Run out", "Stumped"][rowIndex % 5],
    fielderAthleteId: "",
    fielderName: rowIndex % 2 === 0 ? opponentPlayers[(rowIndex + 5) % opponentPlayers.length].name : "",
    bowlerAthleteId: "",
    bowlerName: opponentPlayers[(rowIndex + 6) % opponentPlayers.length].name,
    strikeRate: ""
  }));
  batting.forEach((player) => {
    player.strikeRate = player.balls ? ((player.runs / player.balls) * 100).toFixed(2) : "";
  });
  const opponentBatting = opponentPlayers.map((player, rowIndex) => ({
    ...player,
    role: "batter",
    runs: Math.max(0, [38, 26, 19, 41, 8, 14, 22, 5, 3, 11, 0][rowIndex] + (index % 7) - 3),
    minutes: 12 + rowIndex * 7 + (index % 6),
    balls: [44, 35, 28, 51, 11, 22, 30, 9, 6, 18, 2][rowIndex],
    fours: rowIndex < 4 ? 1 + ((rowIndex + index) % 4) : 0,
    sixes: rowIndex < 2 ? rowIndex % 2 : 0,
    dismissalMode: rowIndex === 10 ? "not out" : ["caught", "bowled", "lbw", "caught", "run out"][rowIndex % 5],
    dismissalLabel: rowIndex === 10 ? "Not out" : ["Caught", "Bowled", "LBW", "Caught", "Run out"][rowIndex % 5],
    bowlerAthleteId: players[(rowIndex + 5) % players.length].athleteId,
    bowlerName: players[(rowIndex + 5) % players.length].name,
    fielderAthleteId: rowIndex % 2 === 0 ? players[(rowIndex + 3) % players.length].athleteId : "",
    fielderName: rowIndex % 2 === 0 ? players[(rowIndex + 3) % players.length].name : "",
    strikeRate: ""
  }));
  opponentBatting.forEach((player) => {
    player.strikeRate = player.balls ? ((player.runs / player.balls) * 100).toFixed(2) : "";
  });
  const bowling = players.slice(5, 11).map((player, rowIndex) => ({
    ...player,
    side: "uwi",
    overs: [8, 7, 6, 5, 4, 3][rowIndex],
    maidens: rowIndex === 0 ? 1 : 0,
    runs: [32, 28, 23, 21, 18, 15][rowIndex] + (competitionId.length % 7),
    wickets: [3, 2, 1, 1, 0, 1][(rowIndex + competitionId.length) % 6],
    wides: rowIndex % 3,
    noBalls: rowIndex === 4 ? 1 : 0,
    dots: 14 + rowIndex,
    economy: Number((([32, 28, 23, 21, 18, 15][rowIndex] + (competitionId.length % 7)) / [8, 7, 6, 5, 4, 3][rowIndex]).toFixed(2)),
    notes: rowIndex === 0 ? "New ball spell" : ""
  }));
  const opponentBowling = opponentPlayers.slice(0, 6).map((player, rowIndex) => ({
    ...player,
    role: "bowler",
    overs: [8, 7, 6, 5, 4, 3][rowIndex],
    maidens: rowIndex === 1 ? 1 : 0,
    runs: [42, 36, 29, 28, 22, 18][rowIndex] + (index % 6),
    wickets: [2, 1, 2, 1, 1, 0][rowIndex],
    economy: Number((([42, 36, 29, 28, 22, 18][rowIndex] + (index % 6)) / [8, 7, 6, 5, 4, 3][rowIndex]).toFixed(2)),
    notes: rowIndex === 0 ? "Opened the bowling" : ""
  }));
  const uwiExtras = 12 + (competitionId.length % 10);
  const opponentExtras = 8 + (index % 8);
  const uwiRuns = batting.reduce((total, player) => total + Number(player.runs || 0), uwiExtras);
  const opponentRuns = opponentBatting.reduce((total, player) => total + Number(player.runs || 0), opponentExtras);
  const opponentWickets = opponentBatting.filter((player) => player.dismissalMode && player.dismissalMode !== "not out").length;
  const uwiWickets = batting.filter((player) => player.dismissalMode && player.dismissalMode !== "not out").length;
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "cricket",
    sportSlug: "cricket",
    title,
    date,
    venue,
    format,
    uwiTeamId: teamId,
    teamId,
    uwiTeamName: "UWI Blackbirds Cricket Team",
    opponentName,
    inningsCount: 2,
    startingXi: players,
    innings: [
      { innings: 1, battingSide: "uwi", side: "uwi", team: "UWI Blackbirds Cricket Team", overs: oversLabel, declared: false, target: "", runRate: (uwiRuns / Number.parseFloat(oversLabel)).toFixed(2), extras: `b 2, lb 4, w ${uwiExtras - 6}`, extrasRuns: uwiExtras, runs: uwiRuns, total: uwiRuns, wickets: uwiWickets, didNotBat: [], fallOfWickets: fallOfWickets(batting), batting, bowling: opponentBowling },
      { innings: 2, battingSide: "opponent", side: "opponent", team: opponentName, overs: oversLabel, declared: false, target: String(uwiRuns + 1), runRate: (opponentRuns / Number.parseFloat(oversLabel)).toFixed(2), extras: `b 1, lb 3, w ${opponentExtras - 4}`, extrasRuns: opponentExtras, runs: opponentRuns, total: opponentRuns, wickets: opponentWickets, didNotBat: [], fallOfWickets: fallOfWickets(opponentBatting), batting: opponentBatting, bowling }
    ],
    result: `Blackbirds won by ${uwiRuns - opponentRuns} runs`,
    summary: { uwiRuns, opponentRuns, wickets: opponentWickets }
  };
}

function fallOfWickets(batting) {
  let total = 0;
  let wickets = 0;
  return batting
    .map((player) => {
      total += Number(player.runs || 0);
      if (!player.dismissalMode || player.dismissalMode === "not out") return null;
      wickets += 1;
      return `${wickets}-${total}`;
    })
    .filter(Boolean);
}

function footballScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(4, 18)) {
  const players = teamAthletes("football", 18, index);
  const uwiGoals = 1 + (index % 4);
  const opponentGoals = Math.max(0, uwiGoals - 1 - (index % 2));
  const scorers = players.slice(0, uwiGoals);
  const uwiHalves = splitTotal(uwiGoals, 2);
  const opponentHalves = splitTotal(opponentGoals, 2);
  const playerStats = players.map((player, playerIndex) => ({
    ...player,
    number: playerIndex + 1,
    goals: playerIndex < uwiGoals ? 1 : 0,
    assists: playerIndex >= 2 && playerIndex < 2 + uwiGoals ? 1 : 0,
    shots: playerIndex < 7 ? 1 + ((playerIndex + index) % 5) : 0,
    shotsOnTarget: playerIndex < 7 ? 1 + ((playerIndex + index) % 3) : 0,
    goalsConceded: playerIndex === 10 ? opponentGoals : 0,
    saves: playerIndex === 10 ? 3 + (index % 5) : 0,
    fouls: playerIndex % 4,
    offside: playerIndex < 3 ? playerIndex % 2 : 0,
    offsides: playerIndex < 3 ? playerIndex % 2 : 0,
    yellowCards: playerIndex === 6 && index % 3 === 0 ? 1 : 0,
    redCards: 0,
    minutes: playerIndex < 11 ? 90 : 18 + ((playerIndex + index) % 25),
    tackles: playerIndex > 4 ? 2 + ((playerIndex + index) % 6) : 1,
    interceptions: playerIndex > 5 ? 1 + ((playerIndex + index) % 4) : 0
  }));
  const uwiMatchStats = {
    shots: 12 + (index % 8),
    shotsOnTarget: 5 + (index % 5),
    possession: 52 + (index % 12),
    fouls: 9 + (index % 7),
    corners: 4 + (index % 5),
    freeKicks: 8 + (index % 5),
    passesCompletedPct: 78 + (index % 12),
    crosses: 11 + (index % 8),
    interceptions: 9 + (index % 7),
    tackles: 22 + (index % 12),
    offside: 1 + (index % 3),
    offsides: 1 + (index % 3),
    saves: 3 + (index % 5)
  };
  const opponentMatchStats = {
    shots: Math.max(5, uwiMatchStats.shots - 3),
    shotsOnTarget: Math.max(2, uwiMatchStats.shotsOnTarget - 2),
    possession: 100 - uwiMatchStats.possession,
    fouls: 8 + (index % 6),
    corners: 2 + (index % 4),
    freeKicks: 7 + (index % 4),
    passesCompletedPct: 70 + (index % 10),
    crosses: 8 + (index % 6),
    interceptions: 7 + (index % 6),
    tackles: 19 + (index % 10),
    offside: index % 2,
    offsides: index % 2,
    saves: Math.max(1, uwiMatchStats.shotsOnTarget - uwiGoals)
  };
  const uwiGoalEvents = scorers.map((player, goalIndex) => ({
    team: "uwi",
    minute: 12 + goalIndex * 21 + (index % 6),
    scorerAthleteId: player.athleteId,
    scorerName: player.name,
    assistAthleteId: players[(goalIndex + 2) % players.length].athleteId,
    assistName: players[(goalIndex + 2) % players.length].name,
    type: "goal"
  }));
  const opponentGoalEvents = Array.from({ length: opponentGoals }, (_, goalIndex) => ({
    team: "opponent",
    minute: 24 + goalIndex * 27 + (index % 5),
    scorerAthleteId: "",
    scorerName: `${opponentName} Forward ${goalIndex + 1}`,
    assistAthleteId: "",
    assistName: `${opponentName} Midfielder ${goalIndex + 1}`,
    type: "goal"
  }));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "football",
    sportSlug: "football",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Football Team",
    opponentName,
    score: {
      uwi: { firstHalf: uwiHalves[0], secondHalf: uwiHalves[1], overtime: 0, total: uwiGoals },
      opponent: { firstHalf: opponentHalves[0], secondHalf: opponentHalves[1], overtime: 0, total: opponentGoals }
    },
    result: `Blackbirds ${uwiGoals >= opponentGoals ? "won" : "lost"} ${uwiGoals}-${opponentGoals}`,
    squad: players,
    playerStats,
    goals: [...uwiGoalEvents, ...opponentGoalEvents],
    teamTotals: { shots: sumStats(playerStats, "shots"), assists: sumStats(playerStats, "assists"), saves: sumStats(playerStats, "saves"), yellowCards: sumStats(playerStats, "yellowCards"), redCards: sumStats(playerStats, "redCards") },
    matchStats: { uwi: uwiMatchStats, opponent: opponentMatchStats }
  };
}

function basketballScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(5, 2)) {
  const players = teamAthletes("basketball", 15, index);
  const stats = players.map((player, playerIndex) => {
    const twoMade = 1 + ((playerIndex + index) % 6);
    const threeMade = playerIndex < 6 ? (playerIndex + index) % 4 : 0;
    const freeThrowsMade = playerIndex < 10 ? 1 + ((playerIndex + index) % 5) : 0;
    const points = twoMade * 2 + threeMade * 3 + freeThrowsMade;
    const quarters = splitTotal(points, 4);
    return {
      ...player,
      number: playerIndex + 1,
      fouls: 1 + ((playerIndex + index) % 4),
      q1: quarters[0],
      q2: quarters[1],
      q3: quarters[2],
      q4: quarters[3],
      points,
      twoMade,
      twoAttempts: twoMade + 2 + ((playerIndex + index) % 3),
      threeMade,
      threeAttempts: threeMade + (playerIndex < 6 ? 2 + ((playerIndex + index) % 2) : 0),
      freeThrowsMade,
      freeThrowsAttempted: freeThrowsMade + (playerIndex % 3),
      rebounds: [7, 5, 9, 3, 6, 2, 4, 2, 1, 1, 5, 3, 2, 1, 1][playerIndex],
      assists: [4, 7, 2, 5, 1, 2, 1, 0, 0, 0, 3, 2, 1, 0, 0][playerIndex],
      steals: playerIndex < 7 ? (playerIndex + index) % 3 : 0,
      blocks: playerIndex === 2 ? 3 : playerIndex === 4 ? 1 : playerIndex % 7 === 0 ? 1 : 0,
      turnovers: (playerIndex + index) % 4,
      minutes: playerIndex < 10 ? 18 + ((playerIndex + index) % 16) : 7 + (playerIndex % 8)
    };
  });
  const uwiPoints = stats.reduce((total, player) => total + player.points, 0);
  const opponentPoints = Math.max(58, uwiPoints - (6 + (index % 18)));
  const uwiQuarters = splitTotal(uwiPoints, 4);
  const opponentQuarters = splitTotal(opponentPoints, 4);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "basketball",
    sportSlug: "basketball",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Basketball Team",
    opponentName,
    playedAt: venue,
    gameTime: `${18 + (index % 4)}:00`,
    coachName: "Coach Demo",
    score: {
      uwi: { q1: uwiQuarters[0], q2: uwiQuarters[1], q3: uwiQuarters[2], q4: uwiQuarters[3], overtime: 0, total: uwiPoints },
      opponent: { q1: opponentQuarters[0], q2: opponentQuarters[1], q3: opponentQuarters[2], q4: opponentQuarters[3], overtime: 0, total: opponentPoints }
    },
    result: `Blackbirds won ${uwiPoints}-${opponentPoints}`,
    roster: players,
    playerStats: stats,
    gameAdmin: { teamFouls: sumStats(stats, "fouls"), fullTimeouts: 3, shortTimeouts: 2, otTimeouts: 0, warnings: index % 2, possessionStart: "UWI", possessionSequence: "UWI-Opponent-UWI-Opponent" },
    teamTotals: { points: uwiPoints, rebounds: sumStats(stats, "rebounds"), assists: sumStats(stats, "assists"), steals: sumStats(stats, "steals"), blocks: sumStats(stats, "blocks"), turnovers: sumStats(stats, "turnovers"), fouls: sumStats(stats, "fouls") }
  };
}

function trackFieldScorecards(campus, competitionId, teamId, title, venue, index = 0, date = day(5, 6)) {
  const trackEvents = [
    { eventName: "100m", base: 10.52, step: 0.14, unit: "s" },
    { eventName: "200m", base: 21.21, step: 0.27, unit: "s" },
    { eventName: "400m", base: 48.65, step: 0.48, unit: "s" },
    { eventName: "800m", base: 114.4, step: 1.25, unit: "s" },
    { eventName: "1500m", base: 247.2, step: 2.4, unit: "s" },
    { eventName: "110m Hurdles", base: 14.22, step: 0.18, unit: "s" }
  ];
  const fieldEvents = [
    { eventName: "Long Jump", base: 6.85, step: 0.08, disciplineType: "horizontal-jump" },
    { eventName: "Triple Jump", base: 14.18, step: 0.13, disciplineType: "horizontal-jump" },
    { eventName: "High Jump", base: 2.03, step: 0.03, disciplineType: "vertical-jump" },
    { eventName: "Shot Put", base: 14.9, step: 0.16, disciplineType: "throw" },
    { eventName: "Discus", base: 44.5, step: 0.42, disciplineType: "throw" },
    { eventName: "Javelin", base: 58.2, step: 0.55, disciplineType: "throw" }
  ];
  const trackEvent = trackEvents[index % trackEvents.length];
  const fieldEvent = fieldEvents[index % fieldEvents.length];
  const trackUwi = teamAthletes("track-and-field", 6, index);
  const trackOpponents = opponentRoster("Regional Club", 2, "Sprinter");
  const trackEntries = [...trackUwi, ...trackOpponents].map((athlete, rowIndex) => {
    const isUwi = rowIndex < trackUwi.length;
    const timeNumber = Number((trackEvent.base + rowIndex * trackEvent.step + (index % 4) * 0.03).toFixed(2));
    return {
      rowNumber: rowIndex + 1,
      place: rowIndex + 1,
      entryType: isUwi ? "uwi" : "opponent",
      athleteId: isUwi ? athlete.athleteId : "",
      id: isUwi ? athlete.id : "",
      name: athlete.name,
      bib: `${100 + index}${rowIndex + 1}`,
      club: isUwi ? "UWI Blackbirds" : "Regional Club",
      lane: 2 + rowIndex,
      time: formatTrackTime(timeNumber),
      timeNumber,
      ab: "",
      heat: 1 + (index % 3),
      reactionTime: (0.132 + rowIndex * 0.004 + (index % 3) * 0.002).toFixed(3),
      wind: trackEvent.eventName.includes("100") || trackEvent.eventName.includes("200") ? "1.1" : "N/A",
      points: [10, 8, 6, 5, 4, 3, 2, 1][rowIndex]
    };
  });
  const fieldUwi = teamAthletes("track-and-field", 6, index + 8);
  const fieldOpponents = opponentRoster("Regional Club", 2, "Jumper");
  const fieldEntries = [...fieldUwi, ...fieldOpponents].map((athlete, rowIndex) => {
    const isUwi = rowIndex < fieldUwi.length;
    const best = fieldEvent.base - rowIndex * fieldEvent.step + (index % 3) * 0.03;
    return {
      rowNumber: rowIndex + 1,
      rank: rowIndex + 1,
      entryType: isUwi ? "uwi" : "opponent",
      athleteId: isUwi ? athlete.athleteId : "",
      id: isUwi ? athlete.id : "",
      name: athlete.name,
      bib: `${200 + index}${rowIndex + 1}`,
      club: isUwi ? "UWI Blackbirds" : "Regional Club",
      best1: (best - 0.11).toFixed(2),
      best1Number: Number((best - 0.11).toFixed(2)),
      best: best.toFixed(2),
      bestNumber: Number(best.toFixed(2)),
      rank1: rowIndex + 1,
      finalRank: rowIndex + 1,
      attempts: [(best - 0.22).toFixed(2), (best - 0.11).toFixed(2), "X", best.toFixed(2), (best - 0.05).toFixed(2), "X"],
      wind: "0.8",
      points: [10, 8, 6, 5, 4, 3, 2, 1][rowIndex]
    };
  });
  return [
    {
      id: idFor("scorecard", `${competitionId}-track-100m`),
      competitionId,
      subjectId: teamId,
      subjectType: "team",
      teamId,
      athleteId: null,
      campus,
      sport: "track-and-field",
      data: {
        seedDataset: DATASET_ID,
        eventType: "scorecard",
        competitionId,
        sport: "track-and-field",
        sportSlug: "track-and-field",
        resultType: "track",
        disciplineType: "track",
        title,
        eventName: trackEvent.eventName,
        eventNumber: `${10 + (index % 30)}`,
        round: "Final",
        division: "Open",
        date,
        venue,
        teamId,
        uwiTeamId: teamId,
        uwiTeamName: "UWI Blackbirds Track and Field Team",
        track: { heatNumber: String(1 + (index % 3)), semiFinalNumber: "", recordNotes: index % 5 === 0 ? "Wind legal season best." : "", windDirection: "Tailwind", wind: trackEvent.eventName.includes("100") || trackEvent.eventName.includes("200") ? 1.1 : null },
        field: null,
        entries: trackEntries,
        summary: { eventWinner: trackEntries[0].name, winningTime: trackEntries[0].time, uwiEntries: trackUwi.length, completedEntries: trackEntries.length, uwiPoints: 36, topUwiResult: `${trackEntries[0].name} ${trackEntries[0].time}`, winningResult: trackEntries[0].time }
      }
    },
    {
      id: idFor("scorecard", `${competitionId}-field-long-jump`),
      competitionId,
      subjectId: teamId,
      subjectType: "team",
      teamId,
      athleteId: null,
      campus,
      sport: "track-and-field",
      data: {
        seedDataset: DATASET_ID,
        eventType: "scorecard",
        competitionId,
        sport: "track-and-field",
        sportSlug: "track-and-field",
        resultType: "field",
        disciplineType: fieldEvent.disciplineType,
        title,
        eventName: fieldEvent.eventName,
        eventNumber: `${40 + (index % 30)}`,
        round: "Final",
        division: "Open",
        date,
        venue,
        teamId,
        uwiTeamId: teamId,
        uwiTeamName: "UWI Blackbirds Track and Field Team",
        track: null,
        field: { fieldEventType: fieldEvent.disciplineType, fieldStandard: "Open", wind: fieldEvent.disciplineType === "horizontal-jump" ? 0.8 : null, remarks: "Best legal marks recorded from the seeded official sheet." },
        entries: fieldEntries,
        summary: { eventWinner: fieldEntries[0].name, winningMark: fieldEntries[0].best, uwiEntries: fieldUwi.length, completedEntries: fieldEntries.length, uwiPoints: 36, topUwiResult: `${fieldEntries[0].name} ${fieldEntries[0].best}`, winningResult: fieldEntries[0].best }
      }
    }
  ];
}

function formatTrackTime(seconds) {
  return seconds >= 60 ? `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}` : seconds.toFixed(2);
}

function swimmingScorecard(competitionId, teamId, title, venue, index = 0, date = day(5, 9)) {
  const eventNames = ["50m Freestyle", "100m Freestyle", "100m Butterfly", "100m Backstroke", "200m Individual Medley", "400m Freestyle"];
  const eventName = eventNames[index % eventNames.length];
  const uwiLanes = teamAthletes("swimming", 7, index);
  const opponentLanes = opponentRoster("Regional Aquatics", 3, "Swimmer");
  const lanes = [...uwiLanes, ...opponentLanes].map((athlete, rowIndex) => {
    const isUwi = rowIndex < uwiLanes.length;
    return {
      entryType: isUwi ? "uwi" : "opponent",
      lane: rowIndex + 1,
      athleteId: isUwi ? athlete.athleteId : "",
      id: isUwi ? athlete.id : "",
      name: athlete.name,
      year: String(1 + (rowIndex % 4)),
      school: isUwi ? "UWI Cave Hill" : "Regional Aquatics",
      seedTime: formatTrackTime(25.8 + rowIndex * 0.35 + (index % 4) * 0.1),
      finalTime: formatTrackTime(24.9 + rowIndex * 0.31 + (index % 4) * 0.08),
      split50: formatTrackTime(24.9 + rowIndex * 0.31),
      place: rowIndex + 1,
      points: [10, 8, 6, 5, 4, 3, 2, 1, 0, 0][rowIndex],
      dq: false,
      exhibition: rowIndex === 9 && index % 4 === 0
    };
  });
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "swimming",
    sportSlug: "swimming",
    title,
    session: `S${1 + (index % 4)}`,
    eventName,
    eventNumber: `${20 + (index % 30)}`,
    round: "Final",
    course: "SCM",
    ageGroup: "Open",
    schoolName: "UWI Cave Hill",
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Swimming Team",
    lanes,
    summary: { winningTime: lanes[0].finalTime, uwiPoints: 36 }
  };
}

function netballScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(4, 22)) {
  const players = teamAthletes("netball", 12, index);
  const positions = ["GS", "GA", "WA", "C", "WD", "GD", "GK", "GS", "GA", "WA", "GD", "GK"];
  const playerStats = players.map((player, playerIndex) => ({
    ...player,
    number: playerIndex + 1,
    position: positions[playerIndex],
    goals: playerIndex < 2 ? 24 - playerIndex * 7 + (index % 5) : 0,
    attempts: playerIndex < 2 ? 29 - playerIndex * 7 + (index % 5) : 0,
    shootingPercentage: playerIndex < 2 ? percent(24 - playerIndex * 7 + (index % 5), 29 - playerIndex * 7 + (index % 5)) : "",
    goalAssists: playerIndex < 5 ? 3 + ((playerIndex + index) % 6) : 0,
    feeds: playerIndex < 7 ? 8 + ((playerIndex + index) % 12) : 1,
    centrePassReceives: playerIndex >= 2 && playerIndex <= 4 ? 7 + ((playerIndex + index) % 10) : 1,
    intercepts: playerIndex > 5 ? 1 + ((playerIndex + index) % 4) : 0,
    gains: playerIndex > 5 ? 2 + ((playerIndex + index) % 5) : 1,
    deflections: playerIndex > 4 ? 2 + ((playerIndex + index) % 6) : 0,
    rebounds: playerIndex < 2 ? 2 + (index % 3) : 0,
    turnovers: (playerIndex + index) % 4,
    penalties: 2 + ((playerIndex + index) % 7),
    minutes: playerIndex < 7 ? 60 : 12 + ((playerIndex + index) % 20)
  }));
  const goals = sumStats(playerStats, "goals");
  const opponentGoals = Math.max(31, goals - (4 + (index % 12)));
  const uwiQuarters = splitTotal(goals, 4);
  const opponentQuarters = splitTotal(opponentGoals, 4);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "netball",
    sportSlug: "netball",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Netball Team",
    opponentName,
    score: {
      uwi: { q1: uwiQuarters[0], q2: uwiQuarters[1], q3: uwiQuarters[2], q4: uwiQuarters[3], overtime: 0, total: goals },
      opponent: { q1: opponentQuarters[0], q2: opponentQuarters[1], q3: opponentQuarters[2], q4: opponentQuarters[3], overtime: 0, total: opponentGoals }
    },
    result: `Blackbirds won ${goals}-${opponentGoals}`,
    squad: players,
    startingSeven: players.slice(0, 7).map((player, playerIndex) => ({ position: positions[playerIndex], athleteId: player.athleteId, name: player.name })),
    playerStats,
    substitutions: players.slice(7, 10).map((player, subIndex) => ({ period: `Q${2 + subIndex}`, playerOffAthleteId: players[subIndex + 2].athleteId, playerOffName: players[subIndex + 2].name, playerOnAthleteId: player.athleteId, playerOnName: player.name, position: positions[subIndex + 2], notes: "Rotation minutes" })),
    teamTotals: { shootingPercentage: percent(goals, sumStats(playerStats, "attempts")), goals, attempts: sumStats(playerStats, "attempts"), feeds: sumStats(playerStats, "feeds"), gains: sumStats(playerStats, "gains"), penalties: sumStats(playerStats, "penalties"), intercepts: sumStats(playerStats, "intercepts"), deflections: sumStats(playerStats, "deflections") }
  };
}

function volleyballScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(4, 24)) {
  const players = teamAthletes("volleyball", 14, index);
  const playerStats = players.map((player, playerIndex) => ({
    ...player,
    serveOrder: ["I", "II", "III", "IV", "V", "VI"][playerIndex % 6],
    number: playerIndex + 1,
    kills: playerIndex < 8 ? 4 + ((playerIndex + index) % 10) : 0,
    aces: (playerIndex + index) % 4,
    blocks: playerIndex < 6 ? (playerIndex + index) % 5 : 0,
    assists: playerIndex === 1 ? 24 + (index % 18) : 1 + (playerIndex % 4),
    digs: 3 + ((playerIndex + index) % 13),
    serveReceive: playerIndex < 8 ? 6 + ((playerIndex + index) % 12) : 1,
    receptions: playerIndex < 8 ? 6 + ((playerIndex + index) % 12) : 1,
    errors: (playerIndex % 5 === 0 ? 1 : 0) + (playerIndex % 4 === 0 ? 2 : 0),
    substitutions: playerIndex > 6 ? 1 : 0,
    timeouts: playerIndex === 0 ? 1 : 0,
    captain: playerIndex === 0,
    libero: playerIndex === 12,
    minutes: playerIndex < 7 ? 70 : 18 + ((playerIndex + index) % 25)
  }));
  const close = index % 4 === 0;
  const sets = close
    ? [{ set: 1, uwiScore: 25, opponentScore: 22, uwi: 25, opponent: 22 }, { set: 2, uwiScore: 22, opponentScore: 25, uwi: 22, opponent: 25 }, { set: 3, uwiScore: 25, opponentScore: 21, uwi: 25, opponent: 21 }, { set: 4, uwiScore: 23, opponentScore: 25, uwi: 23, opponent: 25 }, { set: 5, uwiScore: 15, opponentScore: 11, uwi: 15, opponent: 11 }]
    : [{ set: 1, uwiScore: 25, opponentScore: 20, uwi: 25, opponent: 20 }, { set: 2, uwiScore: 23, opponentScore: 25, uwi: 23, opponent: 25 }, { set: 3, uwiScore: 25, opponentScore: 19, uwi: 25, opponent: 19 }, { set: 4, uwiScore: 25, opponentScore: 22, uwi: 25, opponent: 22 }];
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "volleyball",
    sportSlug: "volleyball",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Volleyball Team",
    opponentName,
    site: venue,
    level: "Varsity",
    startTime: "18:30",
    endTime: close ? "20:42" : "20:05",
    firstServe: index % 2 ? "opponent" : "uwi",
    result: `Blackbirds won 3-${close ? 2 : 1}`,
    finalSets: { uwi: 3, opponent: close ? 2 : 1 },
    sets,
    roster: players,
    playerStats,
    matchAdmin: { uwiTimeouts: 2, opponentTimeouts: 2, uwiSubs: 8 + (index % 4), opponentSubs: 7 + (index % 4), penaltyPoints: index % 2, replays: 3 + (index % 5) },
    teamTotals: { kills: sumStats(playerStats, "kills"), aces: sumStats(playerStats, "aces"), blocks: sumStats(playerStats, "blocks"), assists: sumStats(playerStats, "assists"), digs: sumStats(playerStats, "digs") },
    comments: "Seeded varsity scoresheet with linked UWI roster stats.",
    officialNotes: "Officials confirmed lineups before first serve."
  };
}

function hockeyScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(4, 27)) {
  const players = teamAthletes("hockey", 16, index);
  const uwiGoals = 2 + (index % 4);
  const opponentGoals = Math.max(0, uwiGoals - 1 - (index % 2));
  const uwiPeriods = splitTotal(uwiGoals, 3);
  const opponentPeriods = splitTotal(opponentGoals, 3);
  const scoring = Array.from({ length: uwiGoals }, (_, goalIndex) => ({
    side: "uwi",
    period: `P${1 + (goalIndex % 3)}`,
    number: players[goalIndex].number || goalIndex + 1,
    goal: 1,
    scorerAthleteId: players[goalIndex].athleteId,
    scorerName: players[goalIndex].name,
    assist1AthleteId: players[(goalIndex + 2) % players.length].athleteId,
    assist1Name: players[(goalIndex + 2) % players.length].name,
    assist2AthleteId: goalIndex % 2 ? players[(goalIndex + 4) % players.length].athleteId : "",
    assist2Name: goalIndex % 2 ? players[(goalIndex + 4) % players.length].name : ""
  }));
  const playerStats = players.map((player, playerIndex) => ({ ...player, number: playerIndex + 1, shots: playerIndex < 8 ? 1 + ((playerIndex + index) % 5) : 0, saves: playerIndex === 15 ? 4 + (index % 5) : 0, tackles: playerIndex > 4 ? 3 + ((playerIndex + index) % 7) : 1, interceptions: playerIndex > 5 ? 1 + ((playerIndex + index) % 4) : 0, minutes: playerIndex < 11 ? 60 : 10 + ((playerIndex + index) % 20) }));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "hockey",
    sportSlug: "hockey",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Hockey Team",
    opponentName,
    league: "BUC League",
    arena: venue,
    score: {
      uwi: { p1: uwiPeriods[0], p2: uwiPeriods[1], p3: uwiPeriods[2], overtime: 0, total: uwiGoals },
      opponent: { p1: opponentPeriods[0], p2: opponentPeriods[1], p3: opponentPeriods[2], overtime: 0, total: opponentGoals }
    },
    result: `Blackbirds won ${uwiGoals}-${opponentGoals}`,
    roster: players,
    scoring,
    penalties: [{ side: "uwi", period: "P2", time: "12:18", athleteId: players[6].athleteId, name: players[6].name, minutes: 2, infraction: "Stick obstruction" }],
    goalieSaves: playerStats[15].saves,
    teamTotals: { goals: uwiGoals, assists: scoring.reduce((sum, goal) => sum + (goal.assist1AthleteId ? 1 : 0) + (goal.assist2AthleteId ? 1 : 0), 0), penalties: 1, penaltyMinutes: 2 },
    playerStats
  };
}

function badmintonScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(5, 3)) {
  const players = teamAthletes("badminton", 2, index);
  const close = index % 3 === 0;
  const games = close ? [{ game: 1, uwi: 21, opponent: 19 }, { game: 2, uwi: 19, opponent: 21 }, { game: 3, uwi: 23, opponent: 21 }] : [{ game: 1, uwi: 21, opponent: 16 }, { game: 2, uwi: 21, opponent: 18 }];
  const pointsFor = games.reduce((total, game) => total + game.uwi, 0);
  const pointsAgainst = games.reduce((total, game) => total + game.opponent, 0);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "badminton",
    sportSlug: "badminton",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Badminton Team",
    opponentName,
    discipline: "MD",
    matchType: "doubles",
    matchNumber: `${1 + (index % 6)}`,
    court: `Court ${1 + (index % 4)}`,
    status: "completed",
    uwiPlayers: players,
    opponentPlayers: opponentRoster(opponentName, 2, "Shuttler"),
    games,
    summary: { uwiGamesWon: 2, opponentGamesWon: close ? 1 : 0, pointsFor, pointsAgainst, pointDifferential: pointsFor - pointsAgainst, winner: "UWI Blackbirds Badminton Team" },
    officials: { umpire: "Marcia Holder", serviceJudge: "Andre Lewis" },
    timing: { startTime: "15:00", finishTime: close ? "16:12" : "15:46", durationMinutes: close ? 72 : 46 },
    notes: "Seeded completed rubber with linked UWI doubles pair.",
    result: `Blackbirds won 2-${close ? 1 : 0}`
  };
}

function tableTennisScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(5, 4)) {
  const players = teamAthletes("table-tennis", 4, index);
  const rubbers = players.map((player, rubberIndex) => {
    const games = [{ game: 1, uwi: 11, opponent: 8 + (rubberIndex % 3) }, { game: 2, uwi: 11, opponent: 7 + (index % 4) }, { game: 3, uwi: 9, opponent: 11 }, { game: 4, uwi: 11, opponent: 6 + rubberIndex }];
    return {
      number: rubberIndex + 1,
      label: `Rubber ${rubberIndex + 1}`,
      type: rubberIndex === 3 ? "doubles" : "singles",
      status: "played",
      uwiPlayers: rubberIndex === 3 ? [{ ...player, slot: 1 }, { ...players[0], slot: 2 }] : [{ ...player, slot: 1 }],
      opponentPlayers: rubberIndex === 3 ? opponentRoster(opponentName, 2, "Paddler") : opponentRoster(opponentName, 1, "Paddler"),
      games,
      uwiGames: 3,
      opponentGames: 1,
      uwiPoints: games.reduce((sum, game) => sum + game.uwi, 0),
      opponentPoints: games.reduce((sum, game) => sum + game.opponent, 0),
      winner: "UWI"
    };
  });
  const summary = rubbers.reduce((acc, rubber) => {
    acc.uwiRubbers += rubber.winner === "UWI" ? 1 : 0;
    acc.opponentRubbers += rubber.winner === "Opponent" ? 1 : 0;
    acc.uwiGames += rubber.uwiGames;
    acc.opponentGames += rubber.opponentGames;
    acc.pointsFor += rubber.uwiPoints;
    acc.pointsAgainst += rubber.opponentPoints;
    return acc;
  }, { uwiRubbers: 0, opponentRubbers: 0, uwiGames: 0, opponentGames: 0, pointsFor: 0, pointsAgainst: 0 });
  summary.pointDifferential = summary.pointsFor - summary.pointsAgainst;
  summary.winner = "UWI Blackbirds Table Tennis Team";
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "table-tennis",
    sportSlug: "table-tennis",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Table Tennis Team",
    opponentTeamName: opponentName,
    category: "Open",
    status: "completed",
    matchNumber: `${1 + (index % 8)}`,
    venue,
    rubbers,
    summary,
    officials: { referee: "Anika Best", umpire: "Dwayne Joseph" },
    timing: { startTime: "17:30", finishTime: "19:06", durationMinutes: 96 },
    notes: "Seeded tie sheet with singles and doubles rubbers.",
    result: "Blackbirds won 4-0"
  };
}

function tennisScorecard(competitionId, teamId, title, opponentName, venue, index = 0, date = day(5, 5)) {
  const players = teamAthletes("lawn-tennis", 4, index);
  const matches = players.map((player, matchIndex) => {
    const setScores = [{ set: 1, raw: "6-3", uwi: 6, opponent: 3 }, { set: 2, raw: index % 2 ? "7-5" : "6-4", uwi: index % 2 ? 7 : 6, opponent: index % 2 ? 5 : 4 }];
    return {
      number: matchIndex + 1,
      label: `Match ${matchIndex + 1}`,
      type: matchIndex === 3 ? "doubles" : "singles",
      status: "played",
      uwiPlayers: matchIndex === 3 ? [{ ...player, slot: 1 }, { ...players[0], slot: 2 }] : [{ ...player, slot: 1 }],
      opponentPlayers: matchIndex === 3 ? opponentRoster(opponentName, 2, "Player") : opponentRoster(opponentName, 1, "Player"),
      setScores,
      uwiSets: 2,
      opponentSets: 0,
      uwiGames: setScores.reduce((sum, set) => sum + set.uwi, 0),
      opponentGames: setScores.reduce((sum, set) => sum + set.opponent, 0),
      winner: "UWI"
    };
  });
  const summary = matches.reduce((acc, match) => {
    acc.uwiMatches += match.winner === "UWI" ? 1 : 0;
    acc.opponentMatches += match.winner === "Opponent" ? 1 : 0;
    acc.uwiSets += match.uwiSets;
    acc.opponentSets += match.opponentSets;
    acc.gamesFor += match.uwiGames;
    acc.gamesAgainst += match.opponentGames;
    return acc;
  }, { uwiMatches: 0, opponentMatches: 0, uwiSets: 0, opponentSets: 0, gamesFor: 0, gamesAgainst: 0 });
  summary.gameDifferential = summary.gamesFor - summary.gamesAgainst;
  summary.winner = "UWI Blackbirds Tennis Team";
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "lawn-tennis",
    sportSlug: "lawn-tennis",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Tennis Team",
    opponentTeamName: opponentName,
    category: "Open",
    status: "completed",
    matchNumber: `${1 + (index % 8)}`,
    time: "16:00",
    weather: "Clear",
    courtConditions: "Dry hard court",
    matches,
    summary,
    officials: { referee: "Kirk Alleyne" },
    timing: { startTime: "16:00", finishTime: "18:15", durationMinutes: 135 },
    notes: "Seeded tennis tie with linked roster athletes.",
    result: "Blackbirds won 4-0"
  };
}

function taekwondoScorecard(competitionId, teamId, title, athlete, venue, index = 0, date = day(5, 7)) {
  const judges = Array.from({ length: 5 }, (_, judgeIndex) => {
    const deductions = { basic: 0.1 + (judgeIndex % 2) * 0.05, individual: judgeIndex === 2 ? 0.1 : 0, balance: judgeIndex === 4 ? 0.05 : 0 };
    const presentation = { powerSpeed: 1.75 + (judgeIndex % 2) * 0.05, rhythmTempo: 1.78 + (index % 3) * 0.03, energy: 1.82 + (judgeIndex % 3) * 0.04 };
    const accuracyScore = Math.max(0, 4 - deductions.basic - deductions.individual - deductions.balance);
    const presentationScore = Math.min(6, presentation.powerSpeed + presentation.rhythmTempo + presentation.energy);
    const penalty = judgeIndex === 3 && index % 5 === 0 ? 0.1 : 0;
    const total = Number(Math.max(0, Math.min(10, accuracyScore + presentationScore - penalty)).toFixed(2));
    return {
      number: judgeIndex + 1,
      name: ["Judge Clarke", "Judge Baptiste", "Judge Singh", "Judge Moore", "Judge Hinds"][judgeIndex],
      position: judgeIndex === 0 ? "Head Judge" : "Corner Judge",
      active: true,
      deductions,
      presentation,
      accuracyScore: Number(accuracyScore.toFixed(2)),
      presentationScore: Number(presentationScore.toFixed(2)),
      penalty,
      total,
      hasScore: true,
      comments: judgeIndex === 0 ? "Controlled rhythm and clean stances." : ""
    };
  });
  const finalScore = Number((judges.reduce((sum, judge) => sum + judge.total, 0) / judges.length).toFixed(2));
  const rank = 1 + (index % 4);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "taekwondo",
    sportSlug: "taekwondo",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    athlete,
    format: "poomsae",
    court: `Court ${1 + (index % 3)}`,
    division: "Senior Poomsae",
    round: "Final",
    poomsae: "Taegeuk 8",
    rank,
    judges,
    summary: { finalScore, rank, judgeCount: 5, averageScore: finalScore, bestJudgeScore: Math.max(...judges.map((judge) => judge.total)) },
    result: index % 4 === 0 ? "Gold medal" : index % 4 === 1 ? "Silver medal" : index % 4 === 2 ? "Bronze medal" : "Finalist"
  };
}

function chessScorecard(competitionId, teamId, title, athlete, opponentName, venue, index = 0, date = day(5, 8)) {
  const resultLabel = index % 5 === 0 ? "Draw" : "Win";
  const score = resultLabel === "Draw" ? 0.5 : 1;
  const color = index % 2 ? "black" : "white";
  const resultCode = resultLabel === "Draw" ? "draw" : color;
  const moves = chessMoves(24 + (index % 12));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "chess",
    sportSlug: "chess",
    title,
    date,
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Chess Team",
    uwiPlayer: { ...athlete, color, ranking: String(1740 + (index % 120)) },
    opponent: { name: `${opponentName} Board 1`, color: color === "white" ? "black" : "white", ranking: String(1690 + (index % 140)) },
    round: "Round 3",
    board: 1,
    section: "Open",
    pairingNumber: `${index + 1}`,
    timeControl: "90+30",
    opening: "Queen's Gambit Declined",
    duration: "3h 08m",
    moves,
    summary: { uwiScore: score, opponentScore: 1 - score, resultCode, resultLabel: resultLabel === "Draw" ? "Draw" : "UWI won", moveCount: moves.length, color },
    signatures: { arbiter: "Peter Jordan", player: athlete.name },
    notes: "Seeded board result with a short algebraic move record.",
    result: resultLabel === "Draw" ? "1/2-1/2" : "1-0"
  };
}

function chessMoves(count) {
  const pairs = [
    ["d4", "Nf6"], ["c4", "e6"], ["Nc3", "d5"], ["Bg5", "Be7"], ["e3", "O-O"], ["Nf3", "h6"],
    ["Bh4", "b6"], ["cxd5", "Nxd5"], ["Bxe7", "Qxe7"], ["Nxd5", "exd5"], ["Rc1", "Be6"], ["Qa4", "c5"],
    ["Qa3", "Rc8"], ["Bb5", "a6"], ["dxc5", "bxc5"], ["O-O", "Ra7"], ["Be2", "Nd7"], ["Rc3", "Qd6"],
    ["Rfc1", "Rac7"], ["Nd4", "Nf6"], ["Bf3", "g6"], ["h3", "Kg7"], ["Qa5", "Nd7"], ["b4", "c4"],
    ["b5", "axb5"], ["Nxb5", "Rc5"], ["Nd4", "Rxa5"], ["Nxe6+", "fxe6"], ["Rxa5", "Ne5"], ["Be2", "Qb4"],
    ["Ra7+", "Kf6"], ["f4", "Nc6"], ["Rc7", "Qd2"], ["Kf2", "Nb4"], ["g4", "Nd3+"], ["Kf3", "Qe1"]
  ];
  return pairs.slice(0, count).map(([white, black], index) => ({ number: index + 1, white, black }));
}

function buildDirectAthleteStats(campus, stephenId, fictionalAthletes) {
  const rows = [];
  const selected = [
    ...fictionalAthletes,
    { id: stephenId, sport: "cricket", firstName: "Stephen", lastName: "Mitchel" },
    { id: stephenId, sport: "track-and-field", firstName: "Stephen", lastName: "Mitchel" }
  ];
  selected.forEach((athlete, index) => {
    const sport = athlete.sport || "cricket";
    sportDirectMetrics(sport, index).forEach((metric, metricIndex) => rows.push({
      id: idFor("athlete-stat", `${athlete.id}-${sport}-${metric.statName}-${metricIndex}`),
      athleteId: athlete.id,
      campus,
      sport,
      season: CURRENT_SEASON,
      data: {
        seedDataset: DATASET_ID,
        athleteId: athlete.id,
        sport,
        sportSlug: sport,
        season: CURRENT_SEASON,
        ...metric,
        competitionName: metric.competitionName || "Training and Assessment",
        date: seasonDate(15 + (index % 80) + metricIndex),
        verified: true,
        notes: athlete.id === stephenId ? "Demo direct stat linked to the preserved Stephen Mitchel athlete record." : "Fictional direct athlete stat used to demonstrate manual stat entry."
      }
    }));
  });
  return rows;
}

function sportDirectMetrics(sport, index) {
  if (sport === "cricket") return [
    { statName: "Runs", statValue: String(24 + (index % 76)), eventName: "Batting assessment", eventType: "batting", performance: `${24 + (index % 76)} runs`, runs: 24 + (index % 76), balls: 30 + (index % 55), fours: 2 + (index % 6), sixes: index % 4 },
    { statName: "Wickets", statValue: String(index % 5), eventName: "Bowling assessment", eventType: "bowling", performance: `${index % 5} wickets`, wickets: index % 5, overs: 4 + (index % 6), runsConceded: 18 + (index % 34), maidens: index % 2 },
    { statName: "Fielding", statValue: String(1 + (index % 4)), eventName: "Fielding assessment", eventType: "fielding", performance: `${1 + (index % 4)} dismissals`, catches: index % 3, stumpings: index % 4 === 0 ? 1 : 0, runOuts: index % 5 === 0 ? 1 : 0 }
  ];
  if (sport === "track-and-field") return [
    { statName: "100m", statValue: (10.85 + (index % 12) * 0.05).toFixed(2), unit: "s", eventName: "100m", eventType: "track", performance: `${(10.85 + (index % 12) * 0.05).toFixed(2)} s`, time: (10.85 + (index % 12) * 0.05).toFixed(2), timeNumber: Number((10.85 + (index % 12) * 0.05).toFixed(2)), points: 5 + (index % 6) },
    { statName: "Long Jump", statValue: (6.1 + (index % 14) * 0.06).toFixed(2), unit: "m", eventName: "Long Jump", eventType: "field", performance: `${(6.1 + (index % 14) * 0.06).toFixed(2)} m`, best: (6.1 + (index % 14) * 0.06).toFixed(2), bestNumber: Number((6.1 + (index % 14) * 0.06).toFixed(2)), points: 4 + (index % 6) },
    { statName: "400m", statValue: (49.8 + (index % 16) * 0.22).toFixed(2), unit: "s", eventName: "400m", eventType: "track", performance: `${(49.8 + (index % 16) * 0.22).toFixed(2)} s`, time: (49.8 + (index % 16) * 0.22).toFixed(2), timeNumber: Number((49.8 + (index % 16) * 0.22).toFixed(2)), points: 3 + (index % 6) }
  ];
  if (sport === "football") return [
    { statName: "Match Goals", statValue: String(index % 3), eventName: "Football match", eventType: "match", performance: `${index % 3} goals`, goals: index % 3, assists: (index + 1) % 3, shots: 2 + (index % 5), shotsOnTarget: 1 + (index % 3), minutes: 70 + (index % 21), tackles: 2 + (index % 7), interceptions: index % 4 },
    { statName: "Defensive Work", statValue: String(4 + (index % 8)), eventName: "Football match", eventType: "match", performance: `${4 + (index % 8)} defensive actions`, saves: index % 9 === 0 ? 5 : 0, goalsConceded: index % 9 === 0 ? 1 : 0, fouls: index % 4, offsides: index % 2, yellowCards: index % 7 === 0 ? 1 : 0, redCards: 0 }
  ];
  if (sport === "basketball") return [
    { statName: "Scoring", statValue: String(8 + (index % 24)), eventName: "Basketball game", eventType: "match", performance: `${8 + (index % 24)} points`, points: 8 + (index % 24), twoMade: 2 + (index % 6), threeMade: index % 5, freeThrowsMade: 1 + (index % 6), minutes: 18 + (index % 18) },
    { statName: "All-around", statValue: String(12 + (index % 18)), eventName: "Basketball game", eventType: "match", performance: `${12 + (index % 18)} combined rebounds/assists`, rebounds: 3 + (index % 10), assists: 2 + (index % 8), steals: index % 4, blocks: index % 3, turnovers: index % 4, fouls: 1 + (index % 4) }
  ];
  if (sport === "netball") return [
    { statName: "Shooting", statValue: String(14 + (index % 30)), eventName: "Netball match", eventType: "match", performance: `${14 + (index % 30)} goals`, goals: 14 + (index % 30), attempts: 18 + (index % 34), goalAssists: 2 + (index % 8), feeds: 8 + (index % 18), gains: index % 5, penalties: 2 + (index % 10), minutes: 45 + (index % 16) }
  ];
  if (sport === "volleyball") return [
    { statName: "Attack", statValue: String(6 + (index % 13)), eventName: "Volleyball match", eventType: "match", performance: `${6 + (index % 13)} kills`, kills: 6 + (index % 13), aces: index % 4, blocks: index % 5, assists: index % 7 === 0 ? 28 : 2 + (index % 5), digs: 5 + (index % 14) }
  ];
  return [
    { statName: "Competition Points", statValue: String(1 + (index % 10)), eventName: "Competition appearance", eventType: "match", performance: `${1 + (index % 10)} points`, points: 1 + (index % 10), wins: index % 3 === 0 ? 1 : 0, entries: 1 }
  ];
}

function buildPersonalBests(campus, stephenId, fictionalAthletes) {
  const selected = [
    ...fictionalAthletes,
    { id: stephenId, sport: "cricket" },
    { id: stephenId, sport: "track-and-field" }
  ];
  return selected.flatMap((athlete, index) => {
    const sport = athlete.sport || "cricket";
    return personalBestMetrics(sport, index).map((metric) => ({
      id: idFor("personal-best", `${athlete.id}-${sport}-${metric.eventName}`),
      athleteId: athlete.id,
      campus,
      sport,
      eventName: metric.eventName,
      data: {
        seedDataset: DATASET_ID,
        athleteId: athlete.id,
        sport,
        sportSlug: sport,
        ...metric,
        season: CURRENT_SEASON,
        competitionName: metric.competitionName || "Season Best Register",
        date: seasonDate(40 + (index % 90)),
        verified: true,
        notes: athlete.id === stephenId ? "Demo personal best linked to the preserved Stephen Mitchel athlete record." : "Fictional personal best for presentation data."
      }
    }));
  });
}

function personalBestMetrics(sport, index) {
  if (sport === "cricket") return [
    { eventName: "Highest Score", performance: `${62 + (index % 58)} runs`, statValue: String(62 + (index % 58)), runs: 62 + (index % 58) },
    { eventName: "Best Bowling Figures", performance: `${2 + (index % 5)}/${18 + (index % 32)}`, wickets: 2 + (index % 5), runsConceded: 18 + (index % 32) }
  ];
  if (sport === "track-and-field") return [
    { eventName: "100m", performance: `${(10.71 + (index % 12) * 0.04).toFixed(2)} s`, time: (10.71 + (index % 12) * 0.04).toFixed(2), timeNumber: Number((10.71 + (index % 12) * 0.04).toFixed(2)) },
    { eventName: "Long Jump", performance: `${(6.25 + (index % 16) * 0.05).toFixed(2)} m`, best: (6.25 + (index % 16) * 0.05).toFixed(2), bestNumber: Number((6.25 + (index % 16) * 0.05).toFixed(2)) }
  ];
  if (sport === "football") return [{ eventName: "Most Goal Contributions", performance: `${2 + (index % 4)} G+A`, goals: index % 3, assists: 1 + (index % 3) }];
  if (sport === "basketball") return [{ eventName: "Highest Points", performance: `${18 + (index % 24)} points`, points: 18 + (index % 24) }];
  if (sport === "netball") return [{ eventName: "Best Shooting Game", performance: `${25 + (index % 20)} goals`, goals: 25 + (index % 20), attempts: 30 + (index % 22) }];
  if (sport === "volleyball") return [{ eventName: "Most Kills", performance: `${10 + (index % 12)} kills`, kills: 10 + (index % 12) }];
  return [{ eventName: "Best Competition Result", performance: `${1 + (index % 10)} points`, points: 1 + (index % 10), wins: index % 3 === 0 ? 1 : 0 }];
}

function buildSupportRequests(campus) {
  return [
    { id: idFor("support", "import-help"), campus, email: "demo.manager@ush.test", category: "Data import", status: "open", data: { seedDataset: DATASET_ID, topic: "Data import", message: "Need help reviewing one imported roster file.", status: "open" } },
    { id: idFor("support", "report-question"), campus, email: "demo.viewer@ush.test", category: "Reports", status: "resolved", data: { seedDataset: DATASET_ID, topic: "Reports", message: "Confirmed report filters after seed refresh.", status: "resolved" } }
  ];
}

function buildAuditLogs(campus) {
  return [
    { id: idFor("audit", "seed-rosters"), campus, actorId: idFor("user", "manager"), actorEmail: "demo.manager@ush.test", action: "seed", entityType: "teamRosterAssignment", entityId: null, summary: "Seeded fictional roster assignments", data: { seedDataset: DATASET_ID }, createdAt: new Date(day(5, 15)) },
    { id: idFor("audit", "seed-scorecards"), campus, actorId: idFor("user", "manager"), actorEmail: "demo.manager@ush.test", action: "seed", entityType: "competitionStatLine", entityId: null, summary: "Seeded fictional scorecards and result sheets", data: { seedDataset: DATASET_ID }, createdAt: new Date(day(5, 16)) }
  ];
}

function buildDemoUserProfiles(campus) {
  return [
    { id: idFor("user", "admin"), authUserId: null, email: "demo.admin@ush.test", fullName: "Demo Administrator", campus, role: "admin", status: "active", data: { seedDataset: DATASET_ID, note: "App profile only; no Supabase Auth user is created." } },
    { id: idFor("user", "manager"), authUserId: null, email: "demo.manager@ush.test", fullName: "Demo Manager", campus, role: "manager", status: "active", data: { seedDataset: DATASET_ID, note: "App profile only; no Supabase Auth user is created." } },
    { id: idFor("user", "viewer"), authUserId: null, email: "demo.viewer@ush.test", fullName: "Demo Viewer", campus, role: "viewer", status: "active", data: { seedDataset: DATASET_ID, note: "App profile only; no Supabase Auth user is created." } }
  ];
}

function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

async function createMany(db, model, rows) {
  if (!rows.length) return;
  await db[model].createMany({ data: rows, skipDuplicates: true });
  console.log(`Seeded ${rows.length} ${model} rows.`);
}

async function main() {
  const args = parseArgs();
  await validateSeedTarget();
  const stephen = await findStephenAthlete();
  const campus = process.env.USH_DEMO_CAMPUS || stephen.campus || "cavehill";
  const multiplier = args.size === "large" ? 4 : 1;
  const stephenId = stephen.id;
  preservedStephenRef = { athleteId: stephen.id, id: stephen.id, name: getFullName(stephen) || "Stephen Mitchel" };

  console.log(`Preparing ${args.size} demo dataset for ${campus}.`);
  console.log(`Stephen Mitchel preserved as athlete ${stephenId}.`);

  const teams = buildTeams(campus);
  const fictionalAthletes = buildAthletes(campus, multiplier);
  const coaches = buildCoaches(campus);
  const rosterAssignments = buildRosterAssignments(campus, stephen, fictionalAthletes);
  const staffAssignments = buildStaffAssignments(campus);
  const competitionBundle = buildCompetitions(campus, multiplier);
  const athleteStats = buildDirectAthleteStats(campus, stephenId, fictionalAthletes);
  const personalBests = buildPersonalBests(campus, stephenId, fictionalAthletes);
  const supportRequests = buildSupportRequests(campus);
  const auditLogs = buildAuditLogs(campus);
  const userProfiles = buildDemoUserProfiles(campus);

  if (args.dryRun) {
    console.log(`Dry-run summary: ${fictionalAthletes.length} fictional athletes, ${coaches.length} fictional coaches, ${teams.length} teams, ${competitionBundle.competitions.length} competitions, ${competitionBundle.statLines.length} competition/stat rows, ${athleteStats.length} direct athlete stats, ${personalBests.length} personal bests.`);
    console.log("Dry run complete. No rows were changed.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await resetDemoDatabase(tx, campus, stephenId);
    await createMany(tx, "userProfile", userProfiles);
    await createMany(tx, "team", teams);
    await createMany(tx, "athlete", fictionalAthletes);
    await preserveStephenRelationships(tx, stephen, campus);
    await createMany(tx, "coach", coaches);
    await createMany(tx, "teamRosterAssignment", rosterAssignments);
    await createMany(tx, "teamStaffAssignment", staffAssignments);
    await createMany(tx, "competition", competitionBundle.competitions);
    await createMany(tx, "competitionUnit", competitionBundle.units);
    await createMany(tx, "competitionParticipant", competitionBundle.participants);
    await createMany(tx, "competitionResult", competitionBundle.results);
    await createMany(tx, "competitionStatLine", competitionBundle.statLines);
    await createMany(tx, "athleteStatLine", athleteStats);
    await createMany(tx, "athletePersonalBest", personalBests);
    await createMany(tx, "supportRequest", supportRequests);
    await createMany(tx, "auditLog", auditLogs);
  }, { maxWait: 15000, timeout: 120000 });

  console.log("Demo seed complete.");
  console.log(`Summary: 1 preserved real athlete, ${fictionalAthletes.length} fictional athletes, ${coaches.length} fictional coaches, ${teams.length} teams, ${competitionBundle.competitions.length} competitions.`);
}

async function preserveStephenRelationships(db, stephen, campus) {
  const data = getData(stephen);
  const sports = Array.from(new Set([...inferStephenSports(stephen), "cricket", "track-and-field"]));
  const primarySport = sports[0] || "cricket";
  const teamId = idFor("team", primarySport);
  const team = SPORTS.find((sport) => sport.slug === primarySport);
  await db.athlete.update({
    where: { id: stephen.id },
    data: {
      campus,
      sport: stephen.sport || primarySport,
      data: {
        ...data,
        campus,
        sports,
        sportSlug: data.sportSlug || primarySport,
        primarySport: data.primarySport || primarySport,
        activeRosterAssignment: {
          ...(data.activeRosterAssignment && typeof data.activeRosterAssignment === "object" ? data.activeRosterAssignment : {}),
          teamId,
          teamName: team?.team || "UWI Blackbirds Team",
          sportSlug: primarySport,
          roleLabel: stephenRoleForSport(primarySport),
          status: "ACTIVE"
        }
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
