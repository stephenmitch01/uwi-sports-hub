import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATASET_ID = "ush-demo-v1";
const CURRENT_SEASON = "2026";
let preservedStephenRef = null;
const SPORTS = [
  { slug: "cricket", name: "Cricket", team: "UWI Blackbirds Cricket Team", division: "BCA 3-Day", roster: 13 },
  { slug: "track-and-field", name: "Track and Field", team: "UWI Blackbirds Track and Field Team", division: "Intercollegiate", roster: 14 },
  { slug: "football", name: "Football", team: "UWI Blackbirds Football Team", division: "Premier Division", roster: 16 },
  { slug: "basketball", name: "Basketball", team: "UWI Blackbirds Basketball Team", division: "League One", roster: 10 },
  { slug: "netball", name: "Netball", team: "UWI Blackbirds Netball Team", division: "Elite Division", roster: 10 },
  { slug: "volleyball", name: "Volleyball", team: "UWI Blackbirds Volleyball Team", division: "Championship", roster: 10 },
  { slug: "hockey", name: "Hockey", team: "UWI Blackbirds Hockey Team", division: "Open League", roster: 10 },
  { slug: "swimming", name: "Swimming", team: "UWI Blackbirds Swimming Team", division: "Aquatic Meet", roster: 8 },
  { slug: "badminton", name: "Badminton", team: "UWI Blackbirds Badminton Team", division: "Open", roster: 5 },
  { slug: "table-tennis", name: "Table Tennis", team: "UWI Blackbirds Table Tennis Team", division: "Open", roster: 5 },
  { slug: "lawn-tennis", name: "Lawn Tennis", team: "UWI Blackbirds Tennis Team", division: "Open", roster: 5 },
  { slug: "taekwondo", name: "Taekwondo", team: "UWI Blackbirds Taekwondo Team", division: "Poomsae", roster: 5 },
  { slug: "chess", name: "Chess", team: "UWI Blackbirds Chess Team", division: "Board League", roster: 5 }
];

const FIRST_NAMES = [
  "Aaliyah", "Akil", "Amara", "Andre", "Anika", "Ari", "Brianna", "Caleb", "Camille", "Dante",
  "Elena", "Imani", "Jabari", "Jalen", "Janelle", "Kai", "Keisha", "Kemar", "Leah", "Malik",
  "Maya", "Micah", "Nadia", "Naomi", "Nia", "Omar", "Priya", "Rafael", "Renee", "Sasha",
  "Selena", "Tariq", "Tiana", "Zara", "Mateo", "Lucia", "Diego", "Sofia", "Noah", "Isla"
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

function buildAthletes(campus, multiplier) {
  const athletes = [];
  let index = 0;
  for (const sport of SPORTS) {
    const count = sport.roster * multiplier;
    for (let i = 0; i < count; i += 1) {
      index += 1;
      const firstName = FIRST_NAMES[(index + i) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(index * 3 + i) % LAST_NAMES.length];
      const fullName = `${firstName} ${lastName}`;
      const missingOptional = index % 29 === 0;
      athletes.push({
        id: idFor("athlete", `${sport.slug}-${i}`),
        campus,
        sport: sport.slug,
        firstName,
        lastName,
        status: i % 37 === 0 ? "inactive" : "active",
        data: {
          seedDataset: DATASET_ID,
          firstName,
          lastName,
          fullName,
          athleteType: "Student-Athlete",
          dateOfBirth: missingOptional ? "" : `${1999 + (index % 7)}-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 26)).padStart(2, "0")}`,
          gender: index % 2 === 0 ? "female" : "male",
          email: missingOptional ? "" : `${firstName}.${lastName}.${index}@athletes.ush.test`.toLowerCase(),
          phone: missingOptional ? "" : `246-555-${String(1000 + index).slice(-4)}`,
          studentId: `UWID${String(2026000 + index)}`,
          yearOfStudy: String(1 + (index % 4)),
          faculty: ["Science and Technology", "Social Sciences", "Humanities and Education", "Medical Sciences"][index % 4],
          program: ["Management", "Computer Science", "Kinesiology", "Economics", "Biology"][index % 5],
          facultyProgram: "",
          nationality: ["Barbadian", "Trinidadian", "Jamaican", "Vincentian", "Guyanese", "Grenadian"][index % 6],
          hometown: ["Bridgetown", "Speightstown", "Port of Spain", "Kingston", "Georgetown", "Castries"][index % 6],
          status: i % 37 === 0 ? "inactive" : "active",
          campus,
          primarySport: sport.slug,
          sport: sport.slug,
          sportSlug: sport.slug,
          sports: [sport.slug],
          position: positionForSport(sport.slug, index),
          events: eventsForSport(sport.slug, index),
          imageUrl: index % 17 === 0 ? "" : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(fullName)}`,
          bio: missingOptional ? "" : `${fullName} is a fictional demo ${sport.name.toLowerCase()} athlete used for development and presentation testing.`,
          profile: {
            sportSlug: sport.slug,
            position: positionForSport(sport.slug, index),
            eventsSpecialties: eventsForSport(sport.slug, index).join(", "),
            heightCm: 162 + (index % 32),
            weightKg: 56 + (index % 38),
            dominantHand: index % 3 === 0 ? "Left" : "Right",
            dominantLeg: index % 4 === 0 ? "Left" : "Right",
            dateOfBirth: missingOptional ? "" : `${1999 + (index % 7)}-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 26)).padStart(2, "0")}`,
            gender: index % 2 === 0 ? "female" : "male",
            faculty: ["Science and Technology", "Social Sciences", "Humanities and Education", "Medical Sciences"][index % 4],
            program: ["Management", "Computer Science", "Kinesiology", "Economics", "Biology"][index % 5],
            nationality: ["Barbadian", "Trinidadian", "Jamaican", "Vincentian", "Guyanese", "Grenadian"][index % 6],
            hometown: ["Bridgetown", "Speightstown", "Port of Spain", "Kingston", "Georgetown", "Castries"][index % 6]
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
  SPORTS.forEach((sport, index) => {
    const completedId = idFor("competition", `${sport.slug}-completed`);
    const upcomingId = idFor("competition", `${sport.slug}-upcoming`);
    const completedName = `${sport.name} Campus Series ${CURRENT_SEASON}`;
    const upcomingName = `${sport.name} Invitational Fixture`;
    const opponent = OPPONENTS[index % OPPONENTS.length];
    const venue = VENUES[index % VENUES.length];

    competitions.push(competitionRow({ id: completedId, campus, sport, name: completedName, status: "completed", startDate: day(3 + (index % 5), 4 + index), opponent, venue }));
    competitions.push(competitionRow({ id: upcomingId, campus, sport, name: upcomingName, status: "scheduled", startDate: day(9 + (index % 3), 8 + index), opponent: OPPONENTS[(index + 2) % OPPONENTS.length], venue }));

    units.push(unitRow(campus, completedId, sport, "Round 1", 1));
    units.push(unitRow(campus, upcomingId, sport, "Scheduled Fixture", 1));
    participants.push(participantRow(campus, completedId, idFor("team", sport.slug), "team", sport.team));
    participants.push(participantRow(campus, upcomingId, idFor("team", sport.slug), "team", sport.team));
    results.push(resultRow(campus, completedId, idFor("team", sport.slug), sport, opponent, index));
    statLines.push(...scorecardRowsForSport(campus, completedId, sport, opponent, venue, index));

    if (multiplier > 1) {
      for (let extra = 1; extra < multiplier; extra += 1) {
        const extraId = idFor("competition", `${sport.slug}-extra-${extra}`);
        competitions.push(competitionRow({ id: extraId, campus, sport, name: `${sport.name} Development Meet ${extra}`, status: "completed", startDate: day(2 + ((index + extra) % 6), 12 + extra), opponent: OPPONENTS[(index + extra) % OPPONENTS.length], venue }));
        units.push(unitRow(campus, extraId, sport, `Round ${extra + 1}`, extra + 1));
        participants.push(participantRow(campus, extraId, idFor("team", sport.slug), "team", sport.team));
        results.push(resultRow(campus, extraId, idFor("team", sport.slug), sport, OPPONENTS[(index + extra) % OPPONENTS.length], index + extra));
        statLines.push(...scorecardRowsForSport(campus, extraId, sport, OPPONENTS[(index + extra) % OPPONENTS.length], venue, index + extra));
      }
    }
  });
  return { competitions, units, participants, results, statLines };
}

function competitionRow({ id, campus, sport, name, status, startDate, opponent, venue }) {
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
      format: sport.division,
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

function resultRow(campus, competitionId, teamId, sport, opponent, index) {
  const uwi = 62 + (index * 7) % 55;
  const opp = 48 + (index * 5) % 45;
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
      result: `Blackbirds won ${uwi}-${opp}`,
      score: { uwi, opponent: opp },
      date: day(4 + (index % 4), 5 + index)
    }
  };
}

function scorecardRowsForSport(campus, competitionId, sport, opponent, venue, index) {
  const teamId = idFor("team", sport.slug);
  const title = `${sport.name} Campus Series ${CURRENT_SEASON}`;
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
  if (sport.slug === "cricket") return [scorecardRow(common, cricketScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "football") return [scorecardRow(common, footballScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "basketball") return [scorecardRow(common, basketballScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "track-and-field") return trackFieldScorecards(campus, competitionId, teamId, title, venue).map(wrapScorecardRow);
  if (sport.slug === "swimming") return [scorecardRow(common, swimmingScorecard(competitionId, teamId, title, venue))];
  if (sport.slug === "netball") return [scorecardRow(common, netballScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "volleyball") return [scorecardRow(common, volleyballScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "hockey") return [scorecardRow(common, hockeyScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "badminton") return [scorecardRow(common, badmintonScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "table-tennis") return [scorecardRow(common, tableTennisScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "lawn-tennis") return [scorecardRow(common, tennisScorecard(competitionId, teamId, title, opponent, venue))];
  if (sport.slug === "taekwondo") {
    const athlete = athleteRef("taekwondo", 0);
    return [scorecardRow(common, taekwondoScorecard(competitionId, teamId, title, athlete, venue), { subjectId: athlete.athleteId, subjectType: "athlete", athleteId: athlete.athleteId, teamId })];
  }
  if (sport.slug === "chess") {
    const athlete = athleteRef("chess", 0);
    return [scorecardRow(common, chessScorecard(competitionId, teamId, title, athlete, opponent, venue), { subjectId: athlete.athleteId, subjectType: "athlete", athleteId: athlete.athleteId, teamId })];
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
  const firstName = FIRST_NAMES[(1 + index) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(3 + index) % LAST_NAMES.length];
  return { athleteId: id, id, name: `${firstName} ${lastName}` };
}

function teamAthletes(sport, count) {
  const rows = Array.from({ length: count }, (_, index) => athleteRef(sport, index));
  if (preservedStephenRef && ["cricket", "track-and-field"].includes(sport)) rows.unshift(preservedStephenRef);
  return rows.slice(0, count);
}

function cricketScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("cricket", 11);
  const batting = players.map((player, index) => ({
    ...player,
    runs: [72, 44, 31, 18, 10, 6, 23, 4, 0, 12, 1][index],
    balls: [96, 60, 45, 20, 12, 7, 28, 9, 2, 19, 4][index],
    fours: index < 4 ? 2 + index : 0,
    sixes: index === 0 ? 3 : index === 1 ? 1 : 0,
    dismissalMode: index === 0 ? "caught" : index === 10 ? "" : "bowled",
    fielderAthleteId: index === 0 ? players[7].athleteId : "",
    bowlerAthleteId: ""
  }));
  const bowling = players.slice(5, 10).map((player, index) => ({
    ...player,
    overs: [8, 7, 6, 5, 4][index],
    maidens: index === 0 ? 1 : 0,
    runs: [32, 28, 23, 21, 18][index],
    wickets: [3, 2, 1, 1, 0][index],
    wides: index,
    noBalls: 0
  }));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "cricket",
    sportSlug: "cricket",
    title,
    date: day(4, 30),
    venue,
    format: "BCA 3-Day",
    uwiTeamId: teamId,
    teamId,
    uwiTeamName: "UWI Blackbirds Cricket Team",
    opponentName,
    inningsCount: 2,
    startingXi: players,
    innings: [
      { innings: 1, side: "uwi", team: "UWI Blackbirds Cricket Team", runs: 260, wickets: 4, overs: "20", batting, bowling: [] },
      { innings: 2, side: "opponent", team: opponentName, runs: 159, wickets: 8, overs: "20", batting: [], bowling }
    ],
    result: "Blackbirds won by 101 runs",
    summary: { uwiRuns: 260, opponentRuns: 159, wickets: 8 }
  };
}

function footballScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("football", 11);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "football",
    sportSlug: "football",
    title,
    date: day(4, 18),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Football Team",
    opponentName,
    score: { uwi: 3, opponent: 1 },
    result: "Blackbirds won 3-1",
    playerStats: players.map((player, index) => ({
      ...player,
      goals: index < 2 ? 1 + (index === 0 ? 1 : 0) : 0,
      assists: index > 1 && index < 4 ? 1 : 0,
      shots: index < 5 ? 2 + index : 0,
      shotsOnTarget: index < 4 ? 1 + index : 0,
      saves: index === 10 ? 5 : 0,
      minutes: index < 8 ? 90 : 24 + index,
      tackles: index > 4 ? 2 + index : 1,
      interceptions: index > 5 ? 2 : 0
    })),
    goals: [
      { minute: 18, scorerAthleteId: players[0].athleteId, scorerName: players[0].name, assistAthleteId: players[2].athleteId, assistName: players[2].name },
      { minute: 52, scorerAthleteId: players[1].athleteId, scorerName: players[1].name, assistAthleteId: players[3].athleteId, assistName: players[3].name },
      { minute: 77, scorerAthleteId: players[0].athleteId, scorerName: players[0].name, assistAthleteId: "", assistName: "" }
    ]
  };
}

function basketballScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("basketball", 10);
  const stats = players.map((player, index) => ({
    ...player,
    points: [24, 18, 14, 11, 8, 6, 5, 4, 3, 2][index],
    rebounds: [7, 5, 9, 3, 6, 2, 4, 2, 1, 1][index],
    assists: [4, 7, 2, 5, 1, 2, 1, 0, 0, 0][index],
    steals: index < 4 ? 1 : 0,
    blocks: index === 2 ? 3 : index === 4 ? 1 : 0,
    turnovers: index % 3,
    fouls: 1 + (index % 4),
    minutes: index < 5 ? 28 + index : 10 + index,
    twoMade: 2 + (index % 5),
    threeMade: index < 3 ? 2 : 0,
    freeThrowsMade: index < 5 ? 2 : 1
  }));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "basketball",
    sportSlug: "basketball",
    title,
    date: day(5, 2),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Basketball Team",
    opponentName,
    score: { uwi: 95, opponent: 82 },
    result: "Blackbirds won 95-82",
    playerStats: stats,
    teamTotals: { points: 95, rebounds: 40, assists: 22, steals: 5, blocks: 4 }
  };
}

function trackFieldScorecards(campus, competitionId, teamId, title, venue) {
  const trackEntries = teamAthletes("track-and-field", 8).map((athlete, index) => ({
    entryType: index < 6 ? "uwi" : "opponent",
    ...athlete,
    time: (10.52 + index * 0.14).toFixed(2),
    timeNumber: 10.52 + index * 0.14,
    place: index + 1,
    lane: 2 + index,
    reactionTime: (0.132 + index * 0.004).toFixed(3),
    wind: "1.1",
    points: [10, 8, 6, 5, 4, 3, 2, 1][index]
  }));
  const fieldEntries = teamAthletes("track-and-field", 8).map((athlete, index) => ({
    entryType: index < 6 ? "uwi" : "opponent",
    ...athlete,
    best: (6.85 - index * 0.08).toFixed(2),
    bestNumber: 6.85 - index * 0.08,
    finalRank: index + 1,
    attempts: ["6.52", "6.68", "X", (6.85 - index * 0.08).toFixed(2)],
    wind: "0.8",
    points: [10, 8, 6, 5, 4, 3, 2, 1][index]
  }));
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
        eventName: "100m",
        round: "Final",
        division: "Open",
        date: day(5, 6),
        venue,
        teamId,
        uwiTeamId: teamId,
        uwiTeamName: "UWI Blackbirds Track and Field Team",
        entries: trackEntries,
        summary: { eventWinner: trackEntries[0].name, winningTime: trackEntries[0].time, uwiPoints: 36 }
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
        disciplineType: "horizontal-jump",
        title,
        eventName: "Long Jump",
        round: "Final",
        division: "Open",
        date: day(5, 6),
        venue,
        teamId,
        uwiTeamId: teamId,
        uwiTeamName: "UWI Blackbirds Track and Field Team",
        entries: fieldEntries,
        summary: { eventWinner: fieldEntries[0].name, winningMark: fieldEntries[0].best, uwiPoints: 36 }
      }
    }
  ];
}

function swimmingScorecard(competitionId, teamId, title, venue) {
  const lanes = teamAthletes("swimming", 8).map((athlete, index) => ({
    entryType: index < 6 ? "uwi" : "opponent",
    lane: index + 1,
    ...athlete,
    seedTime: `25.${80 + index}`,
    finalTime: `24.${90 + index}`,
    place: index + 1,
    points: [10, 8, 6, 5, 4, 3, 2, 1][index],
    dq: false,
    exhibition: false
  }));
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "swimming",
    sportSlug: "swimming",
    title,
    eventName: "50m Freestyle",
    round: "Final",
    course: "SCM",
    date: day(5, 9),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Swimming Team",
    lanes,
    summary: { winningTime: lanes[0].finalTime, uwiPoints: 36 }
  };
}

function netballScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("netball", 10);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "netball",
    sportSlug: "netball",
    title,
    date: day(4, 22),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Netball Team",
    opponentName,
    score: { uwi: 58, opponent: 46 },
    result: "Blackbirds won 58-46",
    playerStats: players.map((player, index) => ({ ...player, goals: index < 2 ? 28 - index * 6 : 0, attempts: index < 2 ? 33 - index * 6 : 0, goalAssists: index < 5 ? 3 + index : 0, feeds: index < 6 ? 8 + index : 1, gains: index > 5 ? 3 : 1, penalties: 2 + index })),
    teamTotals: { goals: 58, attempts: 69, feeds: 72, gains: 15 }
  };
}

function volleyballScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("volleyball", 10);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "volleyball",
    sportSlug: "volleyball",
    title,
    date: day(4, 24),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Volleyball Team",
    opponentName,
    result: "Blackbirds won 3-1",
    finalSets: { uwi: 3, opponent: 1 },
    sets: [{ uwi: 25, opponent: 20 }, { uwi: 23, opponent: 25 }, { uwi: 25, opponent: 19 }, { uwi: 25, opponent: 22 }],
    playerStats: players.map((player, index) => ({ ...player, kills: 5 + index, aces: index % 3, blocks: index % 4, assists: index === 1 ? 34 : 2, digs: 4 + index }))
  };
}

function hockeyScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("hockey", 10);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "hockey",
    sportSlug: "hockey",
    title,
    date: day(4, 27),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Hockey Team",
    opponentName,
    score: { uwi: 4, opponent: 2 },
    result: "Blackbirds won 4-2",
    scoring: [
      { period: 1, scorerAthleteId: players[0].athleteId, scorerName: players[0].name, assist1AthleteId: players[2].athleteId, assist1Name: players[2].name },
      { period: 2, scorerAthleteId: players[1].athleteId, scorerName: players[1].name, assist1AthleteId: players[3].athleteId, assist1Name: players[3].name },
      { period: 3, scorerAthleteId: players[4].athleteId, scorerName: players[4].name, assist1AthleteId: "", assist1Name: "" },
      { period: 4, scorerAthleteId: players[0].athleteId, scorerName: players[0].name, assist1AthleteId: players[5].athleteId, assist1Name: players[5].name }
    ],
    penalties: [{ athleteId: players[6].athleteId, name: players[6].name, minutes: 2, infraction: "Stick obstruction" }]
  };
}

function badmintonScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("badminton", 2);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "badminton",
    sportSlug: "badminton",
    title,
    date: day(5, 3),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Badminton Team",
    opponentName,
    discipline: "Doubles",
    matchType: "Best of 3",
    uwiPlayers: players,
    games: [{ uwi: 21, opponent: 16 }, { uwi: 18, opponent: 21 }, { uwi: 21, opponent: 17 }],
    summary: { uwiGamesWon: 2, opponentGamesWon: 1, pointDifferential: 6 },
    result: "Blackbirds won 2-1"
  };
}

function tableTennisScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("table-tennis", 3);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "table-tennis",
    sportSlug: "table-tennis",
    title,
    date: day(5, 4),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Table Tennis Team",
    opponentTeamName: opponentName,
    category: "Open",
    rubbers: players.map((player, index) => ({ label: `Rubber ${index + 1}`, type: "singles", uwiPlayers: [player], games: [{ uwi: 11, opponent: 8 }, { uwi: 11, opponent: 9 }, { uwi: 8, opponent: 11 }, { uwi: 11, opponent: 7 }], uwiGames: 3, opponentGames: 1, winner: "UWI" })),
    summary: { uwiRubbers: 3, opponentRubbers: 0 },
    result: "Blackbirds won 3-0"
  };
}

function tennisScorecard(competitionId, teamId, title, opponentName, venue) {
  const players = teamAthletes("lawn-tennis", 3);
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "lawn-tennis",
    sportSlug: "lawn-tennis",
    title,
    date: day(5, 5),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiTeamName: "UWI Blackbirds Tennis Team",
    opponentTeamName: opponentName,
    category: "Open",
    matches: players.map((player, index) => ({ label: `Match ${index + 1}`, type: "singles", uwiPlayers: [player], setScores: [{ raw: "6-3", uwi: 6, opponent: 3 }, { raw: "6-4", uwi: 6, opponent: 4 }], uwiSets: 2, opponentSets: 0, winner: "UWI" })),
    summary: { uwiMatches: 3, opponentMatches: 0 },
    result: "Blackbirds won 3-0"
  };
}

function taekwondoScorecard(competitionId, teamId, title, athlete, venue) {
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "taekwondo",
    sportSlug: "taekwondo",
    title,
    date: day(5, 7),
    venue,
    teamId,
    uwiTeamId: teamId,
    athlete,
    division: "Senior Poomsae",
    round: "Final",
    poomsae: "Taegeuk 8",
    judges: [{ score: 7.8 }, { score: 7.9 }, { score: 8.1 }, { score: 7.7 }, { score: 8.0 }],
    summary: { finalScore: 7.9, rank: 2, judgeCount: 5 },
    result: "Silver medal"
  };
}

function chessScorecard(competitionId, teamId, title, athlete, opponentName, venue) {
  return {
    seedDataset: DATASET_ID,
    eventType: "scorecard",
    competitionId,
    sport: "chess",
    sportSlug: "chess",
    title,
    date: day(5, 8),
    venue,
    teamId,
    uwiTeamId: teamId,
    uwiPlayer: athlete,
    opponent: { name: `${opponentName} Board 1` },
    round: "Round 3",
    board: 1,
    timeControl: "90+30",
    opening: "Queen's Gambit Declined",
    moves: 42,
    summary: { uwiScore: 1, resultLabel: "Win", moveCount: 42 },
    result: "1-0"
  };
}

function buildDirectAthleteStats(campus, stephenId, fictionalAthletes) {
  const rows = [];
  const selected = fictionalAthletes.filter((_, index) => index % 5 === 0).slice(0, 30);
  selected.push({ id: stephenId, sport: "cricket", firstName: "Stephen", lastName: "Mitchel" });
  selected.forEach((athlete, index) => {
    const sport = athlete.sport || "cricket";
    rows.push({
      id: idFor("athlete-stat", `${athlete.id}-${index}`),
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
        statName: sport === "cricket" ? "Training Runs" : sport === "track-and-field" ? "Training Time" : "Match Rating",
        statValue: sport === "track-and-field" ? "10.98" : String(20 + (index % 40)),
        unit: sport === "track-and-field" ? "s" : "",
        eventName: sport === "track-and-field" ? "100m" : "Season preparation",
        eventType: sport === "track-and-field" ? "track" : "training",
        performance: sport === "track-and-field" ? "10.98 s" : `${20 + (index % 40)} recorded`,
        competitionName: "Training and Assessment",
        date: day(2, 10 + (index % 14)),
        verified: true,
        notes: "Fictional direct athlete stat used to demonstrate manual stat entry."
      }
    });
  });
  return rows;
}

function buildPersonalBests(campus, stephenId, fictionalAthletes) {
  const selected = fictionalAthletes.filter((_, index) => index % 8 === 0).slice(0, 18);
  selected.push({ id: stephenId, sport: "cricket" });
  return selected.map((athlete, index) => {
    const sport = athlete.sport || "cricket";
    const eventName = sport === "track-and-field" ? "100m" : sport === "cricket" ? "Highest Score" : "Best Match Performance";
    const performance = sport === "track-and-field" ? `${(10.71 + index * 0.05).toFixed(2)} s` : sport === "cricket" ? `${62 + index} runs` : `${15 + index} impact points`;
    return {
      id: idFor("personal-best", `${athlete.id}-${eventName}`),
      athleteId: athlete.id,
      campus,
      sport,
      eventName,
      data: {
        seedDataset: DATASET_ID,
        athleteId: athlete.id,
        sport,
        sportSlug: sport,
        eventName,
        performance,
        season: CURRENT_SEASON,
        competitionName: "Training and Assessment",
        date: day(3, 10 + (index % 15)),
        verified: true,
        notes: "Fictional personal best for presentation data."
      }
    };
  });
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
  if (args.dryRun) {
    console.log("Dry run complete. No rows were changed.");
    return;
  }

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
  }, { maxWait: 10000, timeout: 60000 });

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
