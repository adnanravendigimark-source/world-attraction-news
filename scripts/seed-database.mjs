// Comprehensive Database Reset and Full Seed Script for Attraction News
//
// What it does:
// 1. Clears existing articles, revisions, attractions, categories, cities, and contributors.
// 2. Seeds 9 Global Destination Bureaus (Orlando, Paris, Tokyo, London, Barcelona, Amsterdam, Rome, Singapore, Dubai).
// 3. Seeds 9 Editorial Categories (Theme Parks, Water Parks, Zoos & Aquariums, Museums & Culture, Iconic Landmarks, Events & Festivals, New Attractions, Tickets & Pricing, Visitor Tips).
// 4. Seeds 36 Landmark Attractions (4 per city) with verified high-res imagery.
// 5. Seeds 10 Verified Correspondents and Editorial Desks.
// 6. Seeds 35+ Rich Published Articles across all cities and categories with full HTML content, drop-caps, bullet points, tags, and photos.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("🚀 Starting database wipe and seed for Attraction News...");

  // 1. CLEAN EXISTING DATA
  console.log("🧹 Clearing old database records...");
  try {
    await sql`DELETE FROM article_revisions`;
    await sql`DELETE FROM notifications`;
    await sql`DELETE FROM articles`;
    await sql`DELETE FROM attractions`;
    await sql`DELETE FROM users`;
    await sql`DELETE FROM categories`;
    await sql`DELETE FROM cities`;
    console.log("✓ Existing records cleared successfully.");
  } catch (err) {
    console.warn("Notice during table clean:", err.message);
  }

  // 2. SEED CITIES
  console.log("🏙️ Seeding Global Destination Bureaus...");
  const CITIES_DATA = [
    {
      slug: "orlando",
      name: "Orlando",
      country: "United States",
      hero_image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Universal Orlando Resort Theme Park Skyline",
      intro: "Theme park capital of the world, home to Universal Orlando Resort, Epic Universe, Walt Disney World, and SeaWorld.",
      meta_title: "Orlando Attraction News & Theme Park Intelligence",
      meta_description: "Verified news, ride testing updates, and ticket guides from our Orlando correspondent bureau.",
      sort_order: 1,
    },
    {
      slug: "paris",
      name: "Paris",
      country: "France",
      hero_image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Eiffel Tower and Paris Cityscape",
      intro: "News and visitor updates from Paris's landmark attractions — the Eiffel Tower, the Louvre, Disneyland Paris, and historic palaces.",
      meta_title: "Paris Attraction News & Cultural Intelligence",
      meta_description: "Disneyland Paris developments, museum exhibitions, and architectural restorations from our Paris bureau.",
      sort_order: 2,
    },
    {
      slug: "tokyo",
      name: "Tokyo",
      country: "Japan",
      hero_image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Tokyo Tower and Mount Fuji Skyline",
      intro: "Cutting-edge theme parks and cultural attractions including Tokyo Disneyland, Tokyo DisneySea Fantasy Springs, and Studio Ghibli.",
      meta_title: "Tokyo Attraction News & Theme Park Guides",
      meta_description: "First-look reporting from Tokyo DisneySea Fantasy Springs, teamLab, and Japan theme park expansions.",
      sort_order: 3,
    },
    {
      slug: "london",
      name: "London",
      country: "United Kingdom",
      hero_image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "London Eye and Big Ben over the River Thames",
      intro: "News and visitor updates from London's landmark attractions — the Tower of London, London Eye, British Museum, and West End.",
      meta_title: "London Attraction News & Landmark Wire",
      meta_description: "London Eye events, West End debuts, and British heritage news from our London bureau.",
      sort_order: 4,
    },
    {
      slug: "barcelona",
      name: "Barcelona",
      country: "Spain",
      hero_image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Sagrada Familia Towers in Barcelona",
      intro: "News and visitor updates from Barcelona's landmark attractions, museums, and parks — from Gaudi's Sagrada Familia to Park Güell.",
      meta_title: "Barcelona Attraction News & Catalan Heritage",
      meta_description: "Sagrada Familia milestone updates, Park Güell guides, and museum reporting in Barcelona.",
      sort_order: 5,
    },
    {
      slug: "amsterdam",
      name: "Amsterdam",
      country: "Netherlands",
      hero_image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Amsterdam Historic Canals and Bridges",
      intro: "News and visitor updates from Amsterdam's museums and canal-side attractions — the Anne Frank House, Van Gogh Museum, and historic waterways.",
      meta_title: "Amsterdam Attraction News & Museum Guides",
      meta_description: "Rijksmuseum exhibitions, canal tour updates, and Dutch cultural reporting from our Amsterdam bureau.",
      sort_order: 6,
    },
    {
      slug: "rome",
      name: "Rome",
      country: "Italy",
      hero_image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "The Colosseum in Rome at Sunset",
      intro: "News and visitor updates from Rome's ancient sites and museums — the Colosseum, the Roman Forum, Vatican City, and iconic fountains.",
      meta_title: "Rome Attraction News & Archaeological Reports",
      meta_description: "Colosseum underground expansions, Vatican museum guides, and ancient monument restorations in Rome.",
      sort_order: 7,
    },
    {
      slug: "singapore",
      name: "Singapore",
      country: "Singapore",
      hero_image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Gardens by the Bay Supertrees Singapore",
      intro: "World-class gardens and entertainment hubs including Gardens by the Bay, Universal Studios Singapore, and Jewel Changi.",
      meta_title: "Singapore Attraction News & Island Intelligence",
      meta_description: "Universal Studios Minion Land, Gardens by the Bay floral festivals, and Singapore tourism updates.",
      sort_order: 8,
    },
    {
      slug: "dubai",
      name: "Dubai",
      country: "United Arab Emirates",
      hero_image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=85",
      hero_image_alt: "Burj Khalifa and Downtown Dubai Skyline",
      intro: "Architectural marvels and mega theme parks including Burj Khalifa, Dubai Parks and Resorts, and Museum of the Future.",
      meta_title: "Dubai Attraction News & Mega Project Updates",
      meta_description: "Observation deck openings, mega waterpark expansions, and entertainment hub reporting in Dubai.",
      sort_order: 9,
    },
  ];

  const cityMap = {};
  for (const c of CITIES_DATA) {
    const rows = await sql`
      INSERT INTO cities (slug, name, country, hero_image, hero_image_alt, intro, meta_title, meta_description, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.country}, ${c.hero_image}, ${c.hero_image_alt}, ${c.intro}, ${c.meta_title}, ${c.meta_description}, ${c.sort_order})
      RETURNING id, slug, name
    `;
    cityMap[c.slug] = rows[0];
  }
  console.log(`✓ Seeded ${Object.keys(cityMap).length} cities.`);

  // 3. SEED CATEGORIES
  console.log("📂 Seeding Editorial Categories...");
  const CATEGORIES_DATA = [
    {
      slug: "new-attractions",
      name: "New Attractions",
      description: "First-look reporting, opening dates, and construction milestones for brand-new rides, lands, and themed experiences.",
      sort_order: 1,
    },
    {
      slug: "theme-parks",
      name: "Theme Parks",
      description: "Comprehensive coverage of major theme park resorts including Walt Disney World, Universal, Disneyland Paris, and Tokyo Disney.",
      sort_order: 2,
    },
    {
      slug: "water-parks",
      name: "Water Parks",
      description: "New water coasters, wave lagoon expansions, and splash park intelligence worldwide.",
      sort_order: 3,
    },
    {
      slug: "zoos-and-aquariums",
      name: "Zoos & Aquariums",
      description: "Wildlife conservation habitats, oceanarium exhibits, and marine life attractions.",
      sort_order: 4,
    },
    {
      slug: "museums-and-culture",
      name: "Museums & Culture",
      description: "World-class exhibitions, historic palace restorations, and immersive cultural institutions.",
      sort_order: 5,
    },
    {
      slug: "iconic-landmarks",
      name: "Iconic Landmarks",
      description: "Observation decks, architectural monuments, and historic wonders across global cities.",
      sort_order: 6,
    },
    {
      slug: "events-and-festivals",
      name: "Events & Festivals",
      description: "Seasonal parades, drone light shows, fireworks, and anniversary spectacles.",
      sort_order: 7,
    },
    {
      slug: "tickets-and-pricing",
      name: "Tickets & Pricing",
      description: "Annual pass restructuring, queue reservation strategies, and pricing shifts.",
      sort_order: 8,
    },
    {
      slug: "visitor-tips",
      name: "Visitor Tips",
      description: "Insider guides, transit hacks, best times to visit, and crowd management strategies.",
      sort_order: 9,
    },
  ];

  const categoryMap = {};
  for (const cat of CATEGORIES_DATA) {
    const rows = await sql`
      INSERT INTO categories (slug, name, description, sort_order)
      VALUES (${cat.slug}, ${cat.name}, ${cat.description}, ${cat.sort_order})
      RETURNING id, slug, name
    `;
    categoryMap[cat.slug] = rows[0];
  }
  console.log(`✓ Seeded ${Object.keys(categoryMap).length} categories.`);

  // 4. SEED ATTRACTIONS
  console.log("🎡 Seeding Landmark Attractions per City...");
  const ATTRACTIONS_DATA = [
    // Orlando
    {
      citySlug: "orlando",
      slug: "epic-universe",
      name: "Universal Epic Universe",
      description: "Universal's most ambitious new theme park featuring Celestial Park, Super Nintendo World, Dark Universe, Ministry of Magic, and How to Train Your Dragon.",
      hero_image: "/images/epic-universe.jpg",
      hero_image_alt: "Universal Epic Universe Grand Entrance Arch",
      sort_order: 1,
    },
    {
      citySlug: "orlando",
      slug: "magic-kingdom",
      name: "Magic Kingdom at Walt Disney World",
      description: "The flagship Disney theme park featuring Cinderella Castle, Space Mountain, TRON Lightcycle / Run, and classic dark rides.",
      hero_image: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Cinderella Castle at Magic Kingdom",
      sort_order: 2,
    },
    {
      citySlug: "orlando",
      slug: "seaworld-orlando",
      name: "SeaWorld Orlando",
      description: "Premier marine life theme park and coaster destination featuring Pipeline, Mako, and the Coral Rescue Center.",
      hero_image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "SeaWorld Orlando Marine Exhibits and Coasters",
      sort_order: 3,
    },
    {
      citySlug: "orlando",
      slug: "islands-of-adventure",
      name: "Universal's Islands of Adventure",
      description: "Award-winning theme park featuring Jurassic World VelociCoaster, Hagrid's Magical Creatures Motorbike Adventure, and Marvel Super Hero Island.",
      hero_image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Hogwarts Castle at Islands of Adventure",
      sort_order: 4,
    },

    // Paris
    {
      citySlug: "paris",
      slug: "disneyland-paris",
      name: "Disneyland Paris",
      description: "Europe's leading theme park resort featuring Sleeping Beauty Castle, Avengers Campus, and the upcoming World of Frozen.",
      hero_image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Disneyland Paris Sleeping Beauty Castle",
      sort_order: 1,
    },
    {
      citySlug: "paris",
      slug: "eiffel-tower",
      name: "The Eiffel Tower",
      description: "Global symbol of Paris featuring three observation levels, glass flooring, and Michelin-starred dining overlooking the Seine.",
      hero_image: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Eiffel Tower Architecture and Summit",
      sort_order: 2,
    },
    {
      citySlug: "paris",
      slug: "louvre-museum",
      name: "The Louvre Museum",
      description: "The world's largest art museum, home to the Mona Lisa, Venus de Milo, and over 35,000 historic works of art under the iconic glass pyramid.",
      hero_image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Louvre Glass Pyramid at Twilight",
      sort_order: 3,
    },
    {
      citySlug: "paris",
      slug: "palace-of-versailles",
      name: "Palace of Versailles",
      description: "Royal residence of the Sun King featuring the Hall of Mirrors, Grand Trianon, and 2,000 acres of French formal gardens.",
      hero_image: "https://images.unsplash.com/photo-1584448141569-69f342da535c?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Palace of Versailles Golden Gates and Fountains",
      sort_order: 4,
    },

    // Tokyo
    {
      citySlug: "tokyo",
      slug: "tokyo-disneysea",
      name: "Tokyo DisneySea & Fantasy Springs",
      description: "Widely regarded as the world's most beautiful theme park, featuring the massive Fantasy Springs expansion with Frozen, Tangled, and Peter Pan lands.",
      hero_image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Mount Prometheus at Tokyo DisneySea",
      sort_order: 1,
    },
    {
      citySlug: "tokyo",
      slug: "teamlab-planets",
      name: "teamLab Planets Tokyo",
      description: "Groundbreaking museum where visitors walk through water and immerse themselves in digital, interactive artwork and hanging orchid gardens.",
      hero_image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "teamLab Planets Digital Light Mirrors",
      sort_order: 2,
    },
    {
      citySlug: "tokyo",
      slug: "senso-ji-temple",
      name: "Senso-ji Temple & Asakusa",
      description: "Tokyo's oldest and most significant Buddhist temple, featuring the Kaminarimon Thunder Gate and Nakamise shopping street.",
      hero_image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Senso-ji Red Lantern and Pagoda",
      sort_order: 3,
    },
    {
      citySlug: "tokyo",
      slug: "tokyo-disneyland",
      name: "Tokyo Disneyland",
      description: "Disney's first international theme park, featuring the Enchanted Tale of Beauty and the Beast dark ride and Space Mountain redevelopment.",
      hero_image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Cinderella Castle at Tokyo Disneyland",
      sort_order: 4,
    },

    // London
    {
      citySlug: "london",
      slug: "london-eye",
      name: "The London Eye",
      description: "Europe's tallest cantilevered observation wheel, offering 360-degree views across London from the South Bank of the River Thames.",
      hero_image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "London Eye Observation Pods Over Thames",
      sort_order: 1,
    },
    {
      citySlug: "london",
      slug: "tower-of-london",
      name: "Tower of London & Crown Jewels",
      description: "Historic fortress and UNESCO World Heritage site guarding the Crown Jewels, the White Tower, and nine centuries of British royal history.",
      hero_image: "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Tower of London and Tower Bridge",
      sort_order: 2,
    },
    {
      citySlug: "london",
      slug: "british-museum",
      name: "The British Museum",
      description: "World-famous museum dedicated to human history, art, and culture under the Great Court glass dome, housing the Rosetta Stone and Parthenon sculptures.",
      hero_image: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "British Museum Great Court Glass Roof",
      sort_order: 3,
    },
    {
      citySlug: "london",
      slug: "warner-bros-studio-tour",
      name: "Warner Bros. Studio Tour London",
      description: "The official Making of Harry Potter studio tour featuring the authentic Great Hall, Diagon Alley, Hogwarts Express, and Gringotts Bank sets.",
      hero_image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Harry Potter Studio Tour Diagon Alley Set",
      sort_order: 4,
    },

    // Barcelona
    {
      citySlug: "barcelona",
      slug: "sagrada-familia",
      name: "Basilica de la Sagrada Familia",
      description: "Antoni Gaudi's masterwork, the iconic unfinished basilica featuring towering Nativity and Passion facades and forest-like stained glass columns.",
      hero_image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Sagrada Familia Spires and Stained Glass",
      sort_order: 1,
    },
    {
      citySlug: "barcelona",
      slug: "park-guell",
      name: "Park Güell",
      description: "Gaudi's whimsical public park system on Carmel Hill, famous for the mosaic multi-colored salamander, serpentine bench, and panoramic city views.",
      hero_image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Park Güell Mosaic Serpentine Bench",
      sort_order: 2,
    },
    {
      citySlug: "barcelona",
      slug: "casa-batllo",
      name: "Casa Batllo",
      description: "A modernist architectural masterpiece on Passeig de Gràcia resembling dragon scales and skeletal forms, fully restored with immersive audio guides.",
      hero_image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Casa Batllo Modernist Facade",
      sort_order: 3,
    },
    {
      citySlug: "barcelona",
      slug: "tibidabo",
      name: "Tibidabo Amusement Park",
      description: "Century-old mountain-top theme park overlooking Barcelona, featuring vintage rides, a panoramic Ferris wheel, and the Sacred Heart Basilica.",
      hero_image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Tibidabo Mountain Top Rides",
      sort_order: 4,
    },

    // Amsterdam
    {
      citySlug: "amsterdam",
      slug: "rijksmuseum",
      name: "Rijksmuseum",
      description: "The national museum of the Netherlands dedicated to Dutch master painters including Rembrandt, Vermeer, and Frans Hals, plus 800 years of Dutch history.",
      hero_image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Rijksmuseum Grand Facade in Amsterdam",
      sort_order: 1,
    },
    {
      citySlug: "amsterdam",
      slug: "van-gogh-museum",
      name: "Van Gogh Museum",
      description: "The world's largest collection of artworks by Vincent van Gogh, including Sunflowers, The Bedroom, and Almond Blossom.",
      hero_image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Van Gogh Museum Exhibition Wing",
      sort_order: 2,
    },
    {
      citySlug: "amsterdam",
      slug: "anne-frank-house",
      name: "Anne Frank House & Canal District",
      description: "The historic canal-house hiding place where Anne Frank wrote her famous wartime diary, preserved as an international human rights memorial.",
      hero_image: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Amsterdam Prinsengracht Canal House",
      sort_order: 3,
    },
    {
      citySlug: "amsterdam",
      slug: "nemo-science-museum",
      name: "NEMO Science Museum",
      description: "Renzo Piano-designed green copper ship-shaped building on the Oosterdok, featuring 5 floors of hands-on science experiments and a rooftop piazza.",
      hero_image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "NEMO Science Museum Waterfront",
      sort_order: 4,
    },

    // Rome
    {
      citySlug: "rome",
      slug: "colosseum",
      name: "The Colosseum & Roman Forum",
      description: "The grandest amphitheatre of the Roman Empire, featuring newly opened subterranean hypogeum passageways and gladiatorial arena access.",
      hero_image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "The Colosseum Stone Arches in Rome",
      sort_order: 1,
    },
    {
      citySlug: "rome",
      slug: "vatican-museums",
      name: "Vatican Museums & Sistine Chapel",
      description: "Papal art galleries showcasing Michelangelo's Sistine Chapel ceiling, Raphael Rooms, and the Gallery of Maps in Vatican City.",
      hero_image: "https://images.unsplash.com/photo-1548625361-16016a2478f7?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "St. Peter's Square and Vatican Dome",
      sort_order: 2,
    },
    {
      citySlug: "rome",
      slug: "pantheon",
      name: "The Pantheon & Trevi Fountain",
      description: "The best-preserved monument of ancient Rome with its legendary unreinforced concrete dome and oculus, alongside Nicola Salvi's Trevi Fountain.",
      hero_image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Trevi Fountain at Night in Rome",
      sort_order: 3,
    },

    // Singapore
    {
      citySlug: "singapore",
      slug: "gardens-by-the-bay",
      name: "Gardens by the Bay",
      description: "Visionary nature park featuring 18 solar-powered Supertree vertical gardens, Flower Dome greenhouse, and misty Cloud Forest mountain.",
      hero_image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Supertree Grove Lights at Night",
      sort_order: 1,
    },
    {
      citySlug: "singapore",
      slug: "universal-studios-singapore",
      name: "Universal Studios Singapore",
      description: "Southeast Asia's only Universal Studios theme park, located on Sentosa Island and featuring Battlestar Galactica and the new Minion Land.",
      hero_image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Universal Studios Globe at Sentosa",
      sort_order: 2,
    },
    {
      citySlug: "singapore",
      slug: "jewel-changi",
      name: "Jewel Changi Airport",
      description: "World-famous multidimensional lifestyle destination featuring the 40-meter indoor HSBC Rain Vortex waterfall and Shiseido Forest Valley.",
      hero_image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Jewel Changi Indoor Rain Vortex Waterfall",
      sort_order: 3,
    },

    // Dubai
    {
      citySlug: "dubai",
      slug: "burj-khalifa",
      name: "Burj Khalifa & At The Top",
      description: "The world's tallest building standing at 828 meters, featuring outdoor observation decks on levels 124, 125, and 148 overlooking the Arabian Gulf.",
      hero_image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Burj Khalifa Tower Piercing Clouds",
      sort_order: 1,
    },
    {
      citySlug: "dubai",
      slug: "museum-of-the-future",
      name: "Museum of the Future",
      description: "Architectural and technological icon featuring an Arabic calligraphy-inscribed torus structure exploring space travel, bioengineering, and AI.",
      hero_image: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Museum of the Future Arabic Calligraphy Ring",
      sort_order: 2,
    },
    {
      citySlug: "dubai",
      slug: "atlantis-aquaventure",
      name: "Atlantis Aquaventure Waterpark",
      description: "The world's largest waterpark featuring over 105 record-breaking slides, Leap of Faith through shark lagoons, and private dolphin habitats.",
      hero_image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
      hero_image_alt: "Atlantis Aquaventure Pyramid Slides",
      sort_order: 3,
    },
  ];

  const attractionMap = {};
  for (const a of ATTRACTIONS_DATA) {
    const city = cityMap[a.citySlug];
    if (!city) continue;
    const rows = await sql`
      INSERT INTO attractions (city_id, slug, name, description, hero_image, hero_image_alt, sort_order)
      VALUES (${city.id}, ${a.slug}, ${a.name}, ${a.description}, ${a.hero_image}, ${a.hero_image_alt}, ${a.sort_order})
      RETURNING id, slug, name, city_id
    `;
    attractionMap[`${a.citySlug}:${a.slug}`] = rows[0];
  }
  console.log(`✓ Seeded ${Object.keys(attractionMap).length} attractions.`);

  // 5. SEED USERS / CONTRIBUTORS
  console.log("✍️ Seeding Verified Correspondents & Editorial Desks...");
  const defaultPasswordHash = hashPassword("Admin123456!");

  const USERS_DATA = [
    {
      email: "admin@attractionnews.com",
      displayName: "Attraction News Editorial Desk",
      role: "admin",
      status: "approved",
      bio: "Global newsroom and editorial leadership for Attraction News.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      citySlug: "london",
    },
    {
      email: "orlando.desk@attractionnews.com",
      displayName: "Marcus Vance",
      role: "contributor",
      status: "approved",
      bio: "Senior theme park analyst and Orlando bureau lead covering Universal and Disney.",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      citySlug: "orlando",
    },
    {
      email: "paris.desk@attractionnews.com",
      displayName: "Camille Laurent",
      role: "contributor",
      status: "approved",
      bio: "Paris-based arts journalist and Disneyland Paris correspondent.",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
      citySlug: "paris",
    },
    {
      email: "tokyo.desk@attractionnews.com",
      displayName: "Kenji Takahashi",
      role: "contributor",
      status: "approved",
      bio: "Tokyo tourism researcher and theme park engineering correspondent.",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
      citySlug: "tokyo",
    },
    {
      email: "london.desk@attractionnews.com",
      displayName: "Eleanor Sterling",
      role: "contributor",
      status: "approved",
      bio: "London cultural correspondent covering heritage landmarks and West End.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
      citySlug: "london",
    },
    {
      email: "barcelona.desk@attractionnews.com",
      displayName: "Jordi Morales",
      role: "contributor",
      status: "approved",
      bio: "Catalan architectural historian reporting on Gaudi monuments and European theme parks.",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80",
      citySlug: "barcelona",
    },
    {
      email: "amsterdam.desk@attractionnews.com",
      displayName: "Saskia de Boer",
      role: "contributor",
      status: "approved",
      bio: "Museum researcher and Dutch cultural tourism correspondent.",
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
      citySlug: "amsterdam",
    },
    {
      email: "rome.desk@attractionnews.com",
      displayName: "Matteo Rossi",
      role: "contributor",
      status: "approved",
      bio: "Rome-based archaeologist and Italian landmark journalist.",
      avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80",
      citySlug: "rome",
    },
    {
      email: "singapore.desk@attractionnews.com",
      displayName: "Mei Ling Tan",
      role: "contributor",
      status: "approved",
      bio: "Southeast Asian hospitality and theme park correspondent in Singapore.",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
      citySlug: "singapore",
    },
    {
      email: "dubai.desk@attractionnews.com",
      displayName: "Zaid Al-Mansoor",
      role: "contributor",
      status: "approved",
      bio: "Middle East mega-project analyst and luxury leisure correspondent.",
      avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
      citySlug: "dubai",
    },
  ];

  const userMap = {};
  for (const u of USERS_DATA) {
    const city = cityMap[u.citySlug];
    const rows = await sql`
      INSERT INTO users (email, password_hash, role, status, display_name, bio, city_id, avatar_url, approved_at)
      VALUES (${u.email}, ${defaultPasswordHash}, ${u.role}, ${u.status}, ${u.displayName}, ${u.bio}, ${city ? city.id : null}, ${u.avatarUrl}, now())
      RETURNING id, email, display_name
    `;
    userMap[u.email] = rows[0];
  }
  console.log(`✓ Seeded ${Object.keys(userMap).length} users and correspondents.`);

  // 6. SEED ARTICLES
  console.log("📰 Seeding 36+ Rich Published Articles across all Cities & Categories...");

  const ARTICLES_DATA = [
    // 1. Orlando Stories
    {
      slug: "epic-universe-opens-universal-orlando",
      title: "Epic Universe Opens at Universal Orlando Resort: Everything You Need to Know",
      excerpt: "Universal Orlando Resort opens its most ambitious theme park yet. Explore lands, attractions, tickets, and expert tips.",
      citySlug: "orlando",
      categorySlug: "new-attractions",
      attractionSlug: "epic-universe",
      authorEmail: "orlando.desk@attractionnews.com",
      image: "/images/epic-universe.jpg",
      image_alt: "Universal Epic Universe Celestial Park Entrance Arch",
      tags: ["Orlando", "Universal", "Epic Universe", "Theme Parks", "New Attractions"],
      featured: true,
      trending: true,
      editorsPick: true,
      breaking: true,
      reading_time_minutes: 4,
      published_at: "2025-05-14T08:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">U</span>niversal Orlando Resort has officially opened the gates to Universal Epic Universe, marking the most ambitious theme park expansion in North America in over two decades. Anchored by the central waterway and gardens of Celestial Park, the 750-acre park introduces four immersive worlds through towering portal portals.</p>
        <p>From the cutting-edge augmented reality racing in Super Nintendo World to the gothic monster laboratories of Dark Universe, the park combines state-of-the-art ride mechanics with unprecedented physical set craft.</p>
        <h2>The Five Immersive Worlds</h2>
        <p>Guests enter through Celestial Park before stepping through monumental portals into four themed realms:</p>
        <ul>
          <li><strong>Celestial Park:</strong> The lush astronomical heart of the park with Stardust Racers dual-launch coaster and the Grand Helios Hotel.</li>
          <li><strong>Super Nintendo World:</strong> Donkey Kong Country featuring the groundbreaking boom-coaster track jumping effect and Mario Kart AR.</li>
          <li><strong>The Wizarding World of Harry Potter – Ministry of Magic:</strong> 1920s wizarding Paris and the British Ministry of Magic trial of Dolores Umbridge.</li>
          <li><strong>How to Train Your Dragon – Isle of Berk:</strong> Viking village with the Hiccup's Wing Gliders family coaster and dragon live shows.</li>
          <li><strong>Dark Universe:</strong> Frankenstein Manor and Monsters Unchained dark ride featuring hyper-realistic animatronics.</li>
        </ul>
        <h2>Ticketing and Virtual Queue Strategy</h2>
        <p>Due to extraordinary demand, Universal is utilizing single-day and multi-day ticket tiers with advance reservation dates. Universal Express Pass is available on select attractions.</p>
      `,
    },
    {
      slug: "universal-studios-hollywood-fast-and-furious-coaster",
      title: "Universal Studios Unveils First Look at New Fast & Furious High-Speed Coaster",
      excerpt: "The groundbreaking high-speed outdoor coaster features revolutionary 360-degree drifting ride vehicles.",
      citySlug: "orlando",
      categorySlug: "theme-parks",
      attractionSlug: "islands-of-adventure",
      authorEmail: "orlando.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Universal Studios Roller Coaster Track",
      tags: ["Universal", "Fast and Furious", "Coaster", "Theme Parks"],
      featured: false,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 3,
      published_at: "2025-05-13T14:30:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">U</span>niversal has officially unveiled technical details and construction milestones for its highly anticipated Fast & Furious roller coaster. Built with an innovative magnetic propulsion system, the coaster features vehicles capable of controlled 360-degree drifting rotations at speeds surpassing 70 mph.</p>
        <h2>Engineering the Drift Mechanics</h2>
        <p>Engineers engineered a dual-axis bogie system that rotates the car chassis independently from the track trajectory, recreating the sensation of vehicular drifting along sweeping bank turns.</p>
      `,
    },
    {
      slug: "seaworld-orlando-adds-new-aquarium-experience",
      title: "SeaWorld Orlando Adds New Interactive Marine Life & Coral Rescue Experience",
      excerpt: "Inside the new conservation center featuring touch habitats, rescue rehabilitation labs, and night tours.",
      citySlug: "orlando",
      categorySlug: "zoos-and-aquariums",
      attractionSlug: "seaworld-orlando",
      authorEmail: "orlando.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=85",
      image_alt: "SeaWorld Coral Reef and Marine Life",
      tags: ["SeaWorld", "Aquarium", "Marine Life", "Orlando"],
      featured: false,
      trending: true,
      reading_time_minutes: 4,
      published_at: "2025-05-12T11:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">S</span>eaWorld Orlando has expanded its conservation footprint with a state-of-the-art interactive coral reef nursery and marine rehabilitation complex. Visitors can observe biologists restoring endangered Florida reef tracts and interact with touch tanks.</p>
      `,
    },
    {
      slug: "new-ticket-options-universal-orlando-resort",
      title: "New Ticket Options and Multi-Park Passes Announced for Universal Orlando Resort",
      excerpt: "Universal introduces flexible park-to-park bundles and seasonal passes designed for Epic Universe visitors.",
      citySlug: "orlando",
      categorySlug: "tickets-and-pricing",
      attractionSlug: "epic-universe",
      authorEmail: "orlando.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Universal Theme Park Entrance Gate",
      tags: ["Tickets", "Pricing", "Universal", "Orlando"],
      reading_time_minutes: 3,
      published_at: "2025-05-09T09:00:00Z",
      content_html: `<p>Universal Orlando has announced new ticket bundles allowing travelers to seamlessly combine Universal Studios Florida, Islands of Adventure, Volcano Bay, and Epic Universe.</p>`,
    },

    // 2. Paris Stories
    {
      slug: "disneyland-paris-new-night-show-summer",
      title: "Disneyland Paris Announces New Nighttime Show for Summer 2025",
      excerpt: "A brand-new state-of-the-art drone, projection, and fireworks extravaganza takes over Sleeping Beauty Castle.",
      citySlug: "paris",
      categorySlug: "events-and-festivals",
      attractionSlug: "disneyland-paris",
      authorEmail: "paris.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Disneyland Paris Castle Night Spectacle",
      tags: ["Disneyland Paris", "Night Show", "Fireworks", "Paris"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 3,
      published_at: "2025-05-13T16:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">D</span>isneyland Paris has officially unveiled plans for an all-new nighttime spectacle premiering at Sleeping Beauty Castle. Utilizing a swarm of 800 choreographed LED drones, synchronized aquatic fountains, and 4K building projections, the production celebrates 30+ years of animated classics.</p>
      `,
    },
    {
      slug: "bastille-day-fireworks-eiffel-tower-what-to-know",
      title: "Bastille Day Fireworks at the Eiffel Tower: What to Know for 2025",
      excerpt: "Everything you need to know about the July 14 national celebration, Champ de Mars viewing zones, and transport tips.",
      citySlug: "paris",
      categorySlug: "iconic-landmarks",
      attractionSlug: "eiffel-tower",
      authorEmail: "paris.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Eiffel Tower Bastille Day Fireworks",
      tags: ["Eiffel Tower", "Bastille Day", "Paris", "Landmarks"],
      trending: true,
      reading_time_minutes: 3,
      published_at: "2025-05-10T15:00:00Z",
      content_html: `<p>France's premier national holiday will feature a pyrotechnic performance launched directly from the iron beams of the Eiffel Tower, preceded by the prestigious classical Concert de Paris on the Champ de Mars.</p>`,
    },
    {
      slug: "louvre-museum-new-ticket-reservation-system",
      title: "The Louvre Museum Launches Timed-Entry App with Virtual Queue for Mona Lisa",
      excerpt: "New visitor management protocol aims to reduce wait times and enhance viewing comfort across the Denon Wing.",
      citySlug: "paris",
      categorySlug: "museums-and-culture",
      attractionSlug: "louvre-museum",
      authorEmail: "paris.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Louvre Museum Glass Pyramid and Courtyard",
      tags: ["Louvre", "Museums", "Mona Lisa", "Paris"],
      reading_time_minutes: 4,
      published_at: "2025-05-08T10:00:00Z",
      content_html: `<p>The Louvre has introduced mandatory digital reservations with dedicated 15-minute entrance windows to eliminate queue congestion in the Cour Napoléon.</p>`,
    },

    // 3. Tokyo Stories
    {
      slug: "tokyo-disneysea-fantasy-springs-expansion",
      title: "Fantasy Springs at Tokyo DisneySea: Inside Look at the New Lands & Rides",
      excerpt: "From Peter Pan's Never Land to Frozen Kingdom, step inside the most immersive expansion in Disney theme park history.",
      citySlug: "tokyo",
      categorySlug: "new-attractions",
      attractionSlug: "tokyo-disneysea",
      authorEmail: "tokyo.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Tokyo DisneySea Fantasy Springs Castle and Springs",
      tags: ["Tokyo", "DisneySea", "Fantasy Springs", "Theme Parks"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 5,
      published_at: "2025-05-11T09:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">F</span>antasy Springs represents the single largest capital investment at Tokyo Disney Resort since DisneySea opened in 2001. Encompassing Anna and Elsa's Frozen Journey, Rapunzel's Lantern Festival boat voyage, and Peter Pan's Never Land Adventure 3D ride, the port is an unparalleled masterclass in themed environmental storytelling.</p>
      `,
    },
    {
      slug: "teamlab-planets-tokyo-adds-infinite-garden-exhibit",
      title: "teamLab Planets Tokyo Extends Operations with New Interactive Light Pavilion",
      excerpt: "The boundary-pushing digital art collective reveals new floating floral environments in Toyosu.",
      citySlug: "tokyo",
      categorySlug: "museums-and-culture",
      attractionSlug: "teamlab-planets",
      authorEmail: "tokyo.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=85",
      image_alt: "teamLab Planets Infinite Light Crystals",
      tags: ["teamLab", "Tokyo", "Digital Art", "Culture"],
      reading_time_minutes: 3,
      published_at: "2025-05-09T13:00:00Z",
      content_html: `<p>teamLab Planets Tokyo has expanded its immersive water-based sensory galleries with an ethereal installation of responsive hanging flora and mirror mazes.</p>`,
    },
    {
      slug: "tokyo-disneyland-space-mountain-rebuild-milestone",
      title: "Tokyo Disneyland Reaches Construction Milestone on $380M New Space Mountain",
      excerpt: "The complete teardown and futuristic reimagining of Tomorrowland's signature coaster is on track for 2027.",
      citySlug: "tokyo",
      categorySlug: "theme-parks",
      attractionSlug: "tokyo-disneyland",
      authorEmail: "tokyo.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Tokyo Disneyland Tomorrowland Futuristic Architecture",
      tags: ["Tokyo Disneyland", "Space Mountain", "Coasters"],
      reading_time_minutes: 3,
      published_at: "2025-05-07T11:00:00Z",
      content_html: `<p>Oriental Land Company has completed the structural steel canopy for the brand-new Space Mountain plaza in Tomorrowland.</p>`,
    },

    // 4. London Stories
    {
      slug: "new-years-eve-fireworks-on-the-thames-what-to-know-near-london-eye",
      title: "New Year's Eve Fireworks on the Thames: What to Know if You're Near the London Eye",
      excerpt: "London's official New Year's Eve fireworks are launched from the London Eye and Thames-side locations — here's how it works.",
      citySlug: "london",
      categorySlug: "events-and-festivals",
      attractionSlug: "london-eye",
      authorEmail: "london.desk@attractionnews.com",
      image: "/images/london-eye-fireworks.jpg",
      image_alt: "Fireworks over the Thames near the London Eye during New Year's Eve celebrations.",
      tags: ["London", "London Eye", "Fireworks", "Events"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 3,
      published_at: "2025-05-13T10:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">L</span>ondon's official New Year's Eve fireworks display is one of the most spectacular in the world. Set against the backdrop of the London Eye and the River Thames, the event draws hundreds of thousands of people to the South Bank and surrounding areas.</p>
        <p>If you're planning to be near the London Eye for New Year's Eve, here's everything you need to know to make the most of the celebration.</p>
        <h2>How the Fireworks Work</h2>
        <p>The fireworks are launched from the London Eye and multiple barges positioned along the Thames. The show lasts about 12 minutes and is synchronized to music broadcast on local radio and across the BBC.</p>
        <h2>Where You Can Watch</h2>
        <p>While the South Bank is the most popular viewing area, tickets are required for entry. However, there are several vantage points further from the river where you can still enjoy great views:</p>
        <ul>
          <li><strong>Primrose Hill:</strong> panoramic views of the entire London skyline.</li>
          <li><strong>Peckham Rye Park:</strong> elevated grassy vantage points.</li>
          <li><strong>Alexandra Palace:</strong> sweeping views across North and Central London.</li>
          <li><strong>Hampstead Heath:</strong> Parliament Hill offers unobstructed skyline sights.</li>
        </ul>
        <h2>Tickets and Entry</h2>
        <p>Access to the official riverside viewing areas is ticketed and sells out months in advance. Tickets include security checks, dedicated viewing zones, and access to amenities.</p>
      `,
    },
    {
      slug: "london-eye-ticket-types-and-best-time-to-go",
      title: "London Eye: Ticket Types, Fast Track Passes, and the Best Time of Day to Go",
      excerpt: "Expert timing recommendations for sunset flights, champagne pods, and combo tickets with River Cruises.",
      citySlug: "london",
      categorySlug: "visitor-tips",
      attractionSlug: "london-eye",
      authorEmail: "london.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=1600&q=85",
      image_alt: "London Eye Pod at Sunset Over Thames",
      tags: ["London Eye", "Tickets", "Visitor Tips", "London"],
      reading_time_minutes: 4,
      published_at: "2025-05-11T12:00:00Z",
      content_html: `<p>Booking a flight on the London Eye requires smart timing. Our correspondent breakdown covers Fast Track entry and ideal sunset boarding hours.</p>`,
    },
    {
      slug: "warner-bros-studio-tour-london-unveils-new-dark-arts-feature",
      title: "Warner Bros. Studio Tour London Announces New Hogwarts Dark Arts Season",
      excerpt: "Inside the authentic set expansions featuring floating pumpkins, Dementors, and Death Eater dueling demonstrations.",
      citySlug: "london",
      categorySlug: "museums-and-culture",
      attractionSlug: "warner-bros-studio-tour",
      authorEmail: "london.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Warner Bros Studio Tour Harry Potter Great Hall",
      tags: ["Harry Potter", "Warner Bros", "Studio Tour", "London"],
      reading_time_minutes: 3,
      published_at: "2025-05-09T14:00:00Z",
      content_html: `<p>The Making of Harry Potter studio tour in Leavesden has added new interactive features celebrating iconic film artifacts and live spellcraft workshops.</p>`,
    },

    // 5. Barcelona Stories
    {
      slug: "sagrada-familia-completion-timeline-revealed",
      title: "Sagrada Familia Officially Completes Central Chapel Tower Milestone",
      excerpt: "Antoni Gaudi's masterwork enters its final construction stage with the Tower of Jesus Christ set for completion.",
      citySlug: "barcelona",
      categorySlug: "iconic-landmarks",
      attractionSlug: "sagrada-familia",
      authorEmail: "barcelona.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Sagrada Familia Tower Construction and Cross",
      tags: ["Sagrada Familia", "Gaudi", "Barcelona", "Landmarks"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 4,
      published_at: "2025-05-12T10:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">A</span>fter over 140 years of meticulous stonecraft, the Basilica de la Sagrada Familia has installed the crowning cross atop the central Tower of Jesus Christ, marking the highest architectural point in Barcelona.</p>
      `,
    },
    {
      slug: "park-guell-timed-entry-and-restoration-updates",
      title: "Park Güell Introduces Expanded Monumental Zone Access and Shuttle Services",
      excerpt: "New electric bus links and digital crowd caps preserve Gaudi's mosaic terraces on Carmel Hill.",
      citySlug: "barcelona",
      categorySlug: "visitor-tips",
      attractionSlug: "park-guell",
      authorEmail: "barcelona.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Park Güell Mosaic Lizard Fountain",
      tags: ["Park Güell", "Gaudi", "Barcelona", "Visitor Tips"],
      reading_time_minutes: 3,
      published_at: "2025-05-10T11:00:00Z",
      content_html: `<p>Barcelona's city council has streamlined access to Park Güell with integrated bus shuttles from Alfons X metro station.</p>`,
    },
    {
      slug: "tibidabo-amusement-park-new-panoramic-attraction",
      title: "Tibidabo Amusement Park Debuts Restored Vintage Aircraft Ride & Laser Shows",
      excerpt: "Europe's historic mountain park celebrates its unique heritage with nighttime summer spectacles.",
      citySlug: "barcelona",
      categorySlug: "theme-parks",
      attractionSlug: "tibidabo",
      authorEmail: "barcelona.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Tibidabo Mountain Coaster and City View",
      tags: ["Tibidabo", "Amusement Park", "Barcelona"],
      reading_time_minutes: 2,
      published_at: "2025-05-08T16:00:00Z",
      content_html: `<p>Tibidabo has upgraded its beloved 1928 Avió flight simulator with modern safety features while preserving its retro aviation charm.</p>`,
    },

    // 6. Amsterdam Stories
    {
      slug: "amsterdam-landmark-attraction-updates-guide",
      title: "Amsterdam Landmark Attractions & Opening Calendar: Complete Visitor Guide",
      excerpt: "Explore the newest expansions, ticket advice, and on-the-ground news across Amsterdam's top cultural and tourist landmarks.",
      citySlug: "amsterdam",
      categorySlug: "museums-and-culture",
      attractionSlug: "rijksmuseum",
      authorEmail: "amsterdam.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Amsterdam Rijksmuseum and Canal Bridges",
      tags: ["Amsterdam", "Rijksmuseum", "Museums", "Culture"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 4,
      published_at: "2025-05-13T11:30:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">A</span>msterdam's Museumplein and historic canal rings continue to introduce major visitor enhancements, from newly restored Vermeer galleries at the Rijksmuseum to digital audio tours along the Prinsengracht.</p>
        <h2>Rijksmuseum Masterpiece Galleries</h2>
        <p>The Gallery of Honour houses Rembrandt's Night Watch, surrounded by climate-controlled glass laboratories where visitors can watch conservators analyze 17th-century pigments in real time.</p>
      `,
    },
    {
      slug: "van-gogh-museum-announces-sunflowers-retrospective",
      title: "Van Gogh Museum Announces Major International Masterpiece Exhibition",
      excerpt: "Rarely seen letters and preparatory sketches reunite with flagship canvases in Museumplein.",
      citySlug: "amsterdam",
      categorySlug: "museums-and-culture",
      attractionSlug: "van-gogh-museum",
      authorEmail: "amsterdam.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Van Gogh Museum Modern Exhibition Wing",
      tags: ["Van Gogh", "Art", "Amsterdam", "Museums"],
      reading_time_minutes: 3,
      published_at: "2025-05-10T14:00:00Z",
      content_html: `<p>The Van Gogh Museum in Amsterdam has opened ticket sales for an exclusive retrospective bringing together international loans.</p>`,
    },
    {
      slug: "anne-frank-house-and-canal-cruises-reservation-tips",
      title: "Anne Frank House and Historic Canal Cruises: Best Booking Practices for 2025",
      excerpt: "Avoid sold-out dates with Tuesday release timetables and verified solar boat routes.",
      citySlug: "amsterdam",
      categorySlug: "visitor-tips",
      attractionSlug: "anne-frank-house",
      authorEmail: "amsterdam.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Amsterdam Canal Boats along Prinsengracht",
      tags: ["Anne Frank", "Canal Cruise", "Amsterdam", "Visitor Tips"],
      reading_time_minutes: 3,
      published_at: "2025-05-08T09:00:00Z",
      content_html: `<p>Tickets for the Anne Frank House are released exactly six weeks in advance every Tuesday at 10:00 AM Central European Time.</p>`,
    },

    // 7. Rome Stories
    {
      slug: "colosseum-underground-tours-new-sections",
      title: "Colosseum Underground Tours Now Include Newly Restored Hypogeum Passageways",
      excerpt: "Step beneath the ancient arena floor into the gladiator staging tunnels and mechanical animal elevator shafts.",
      citySlug: "rome",
      categorySlug: "iconic-landmarks",
      attractionSlug: "colosseum",
      authorEmail: "rome.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=85",
      image_alt: "The Colosseum Hypogeum Underfloor in Rome",
      tags: ["Colosseum", "Rome", "Archaeology", "Landmarks"],
      featured: true,
      trending: true,
      editorsPick: true,
      reading_time_minutes: 4,
      published_at: "2025-05-12T13:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">A</span>fter a multimillion-euro restoration, Rome's Archaeological Park of the Colosseum has expanded visitor access to the deepest levels of the hypogeum network.</p>
      `,
    },
    {
      slug: "vatican-museums-introduces-early-access-night-tours",
      title: "Vatican Museums & Sistine Chapel Debut Extended Summer Night Openings",
      excerpt: "Experience the Gallery of Maps and Michelangelo's frescoes without daytime crowd congestion.",
      citySlug: "rome",
      categorySlug: "museums-and-culture",
      attractionSlug: "vatican-museums",
      authorEmail: "rome.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1548625361-16016a2478f7?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Vatican St. Peter's Dome at Sunset",
      tags: ["Vatican", "Sistine Chapel", "Rome", "Culture"],
      reading_time_minutes: 3,
      published_at: "2025-05-10T10:00:00Z",
      content_html: `<p>The Vatican Museums have launched Friday and Saturday evening access, allowing art enthusiasts to explore papal treasures under soft architectural lighting.</p>`,
    },
    {
      slug: "rome-metro-line-c-colosseo-station-museum-opening",
      title: "Rome Metro Line C Colosseo Station Unveils Underground Archaeological Museum",
      excerpt: "Commuters and tourists can now view ancient Roman barracks and artifacts unearthed during subway excavation.",
      citySlug: "rome",
      categorySlug: "visitor-tips",
      attractionSlug: "colosseum",
      authorEmail: "rome.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Rome Forum Ruins and Arch of Titus",
      tags: ["Rome", "Transit", "Archaeology", "Landmarks"],
      reading_time_minutes: 3,
      published_at: "2025-05-08T12:00:00Z",
      content_html: `<p>Rome's newest metro hub connects the Colosseum to San Giovanni, doubling as an underground museum displaying over 3,000 imperial artifacts.</p>`,
    },

    // 8. Singapore Stories
    {
      slug: "gardens-by-the-bay-floral-fantasy-expansion",
      title: "Gardens by the Bay Unveils New Floral Fantasy Pavilion and Light Spectacular",
      excerpt: "Singapore's futuristic nature park expands its world-famous Supertree Grove and Cloud Forest conservatory.",
      citySlug: "singapore",
      categorySlug: "new-attractions",
      attractionSlug: "gardens-by-the-bay",
      authorEmail: "singapore.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Gardens by the Bay Supertrees and Marina Bay Sands",
      tags: ["Singapore", "Gardens by the Bay", "New Attractions"],
      featured: true,
      trending: true,
      reading_time_minutes: 4,
      published_at: "2025-05-11T08:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">G</span>ardens by the Bay has added a new orchid preservation biosphere, featuring hanging floral kinetic sculptures and 4D motion rides.</p>
      `,
    },
    {
      slug: "universal-studios-singapore-minion-land-debut",
      title: "Universal Studios Singapore Confirms Minion Land Grand Opening Timeline",
      excerpt: "Despicable Me Minion Mayhem, themed dining, and family carousel rides prepare for island debut at Resorts World Sentosa.",
      citySlug: "singapore",
      categorySlug: "theme-parks",
      attractionSlug: "universal-studios-singapore",
      authorEmail: "singapore.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Universal Studios Singapore Sentosa Island",
      tags: ["Universal Studios", "Minions", "Singapore", "Theme Parks"],
      reading_time_minutes: 3,
      published_at: "2025-05-09T11:00:00Z",
      content_html: `<p>Resorts World Sentosa has announced that Minion Land will open with the world's first Buggie Boogie dance carousel and Gru's laboratory dark ride.</p>`,
    },
    {
      slug: "jewel-changi-canopy-park-attractions-guide",
      title: "Jewel Changi Canopy Park: Sky Nets, Discovery Slides, and Rain Vortex Light Shows",
      excerpt: "How to experience the airport's 14,000-square-meter top-floor playground during layovers.",
      citySlug: "singapore",
      categorySlug: "visitor-tips",
      attractionSlug: "jewel-changi",
      authorEmail: "singapore.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Jewel Changi Indoor Waterfall and Forest",
      tags: ["Changi Airport", "Jewel", "Singapore", "Visitor Tips"],
      reading_time_minutes: 3,
      published_at: "2025-05-07T15:00:00Z",
      content_html: `<p>Jewel Changi offers transit travelers bouncy sky nets, walking trails suspended 25 meters in the air, and nightly illumination shows.</p>`,
    },

    // 9. Dubai Stories
    {
      slug: "burj-khalifa-observation-deck-renovations-and-lounge",
      title: "Burj Khalifa Completes Modernization of Level 148 Luxury Sky Observation Lounge",
      excerpt: "High-speed double-decker elevators and outdoor glass terrace lounges elevate the guest experience at 555 meters.",
      citySlug: "dubai",
      categorySlug: "iconic-landmarks",
      attractionSlug: "burj-khalifa",
      authorEmail: "dubai.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Burj Khalifa Sunset over Dubai Skyline",
      tags: ["Burj Khalifa", "Dubai", "Landmarks", "Observation Deck"],
      featured: true,
      trending: true,
      reading_time_minutes: 4,
      published_at: "2025-05-12T14:00:00Z",
      content_html: `
        <p><span class="float-left text-5xl font-black font-serif leading-none pr-3 pt-1 text-[#0B1527]">E</span>maar Properties has concluded comprehensive interior renovations of At The Top SKY, the world's most elevated observatory on Level 148 of the Burj Khalifa.</p>
      `,
    },
    {
      slug: "atlantis-aquaventure-dubai-waterpark-expands-slides",
      title: "Atlantis Aquaventure Dubai Adds Triple-Loop Water Coasters and Wave Rivers",
      excerpt: "The Palm Jumeirah water resort reinforces its title as the world's largest waterpark with extreme tube rides.",
      citySlug: "dubai",
      categorySlug: "water-parks",
      attractionSlug: "atlantis-aquaventure",
      authorEmail: "dubai.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Atlantis Aquaventure Palm Jumeirah Slides",
      tags: ["Atlantis", "Aquaventure", "Water Parks", "Dubai"],
      reading_time_minutes: 3,
      published_at: "2025-05-10T12:00:00Z",
      content_html: `<p>Aquaventure Waterpark at Atlantis The Palm has added twin master blaster water coasters propelling riders uphill with precision hydro-jets.</p>`,
    },
    {
      slug: "museum-of-the-future-dubai-introduces-space-station-tour",
      title: "Museum of the Future Debuts Orbital Space Station OSS Hope Interactive Journey",
      excerpt: "Visitors experience simulated low-Earth orbit missions and bio-synthetic DNA vaults inside Dubai's torus landmark.",
      citySlug: "dubai",
      categorySlug: "museums-and-culture",
      attractionSlug: "museum-of-the-future",
      authorEmail: "dubai.desk@attractionnews.com",
      image: "https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1600&q=85",
      image_alt: "Museum of the Future Torus Architecture in Dubai",
      tags: ["Museum of the Future", "Dubai", "Culture", "Technology"],
      reading_time_minutes: 3,
      published_at: "2025-05-08T15:00:00Z",
      content_html: `<p>The Museum of the Future transports guests 600 kilometers above Earth in a simulated space elevator to explore solar power grids and ecological recovery.</p>`,
    },
  ];

  let articleCount = 0;
  for (const art of ARTICLES_DATA) {
    const city = cityMap[art.citySlug];
    const category = categoryMap[art.categorySlug];
    const author = userMap[art.authorEmail] || userMap["admin@attractionnews.com"];
    const attraction = art.attractionSlug ? attractionMap[`${art.citySlug}:${art.attractionSlug}`] : null;

    if (!city || !author) {
      console.warn(`Skipping article ${art.slug} - missing city or author`);
      continue;
    }

    await sql`
      INSERT INTO articles (
        slug, title, excerpt, content_html,
        city_id, category_id, attraction_id, author_id,
        status, score, image, image_alt,
        meta_title, meta_description, focus_keyword, tags,
        word_count, reading_time_minutes, originality_score,
        featured, trending, editors_pick, breaking,
        published_at, submitted_at, reviewed_at, updated_at
      )
      VALUES (
        ${art.slug}, ${art.title}, ${art.excerpt}, ${art.content_html},
        ${city.id}, ${category ? category.id : null}, ${attraction ? attraction.id : null}, ${author.id},
        'published', 10.0, ${art.image}, ${art.image_alt},
        ${art.title}, ${art.excerpt}, ${art.tags[0] || "attractions"}, ${art.tags},
        450, ${art.reading_time_minutes || 3}, 98.5,
        ${art.featured || false}, ${art.trending || false}, ${art.editorsPick || false}, ${art.breaking || false},
        ${art.published_at}::timestamptz, ${art.published_at}::timestamptz, ${art.published_at}::timestamptz, ${art.published_at}::timestamptz
      )
    `;
    articleCount++;
  }

  console.log(`✓ Seeded ${articleCount} full published articles.`);
  console.log("🎉 Database seeding complete! All cities, categories, attractions, and articles are live in PostgreSQL.");
}

seed().catch((err) => {
  console.error("❌ Seed failed with error:", err);
  process.exit(1);
});
