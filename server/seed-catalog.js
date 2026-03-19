const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vqtuuncnolvkxyelapdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODU0ODQsImV4cCI6MjA4ODc2MTQ4NH0.q0HuKI3QWfih2jDdsJWwLTCfRnAJpDXG2li8vqIUsOA'
);

const MARGIN = 0.40;

function dealerCost(msrp) {
  return Math.round(msrp * (1 - MARGIN));
}

const products = [
  // ── Roller Shades ──────────────────────────────────────
  {
    name: 'Norman Essentials Roller Shade',
    category: 'Roller',
    material: 'Light Filtering Polyester',
    description: 'Clean, modern roller shade with smooth operation. Available in dozens of fabric colors. Ideal for living rooms and offices.',
    base_price_cents: 18900,
    is_motorized: false,
    colors: ['White', 'Linen', 'Stone', 'Charcoal', 'Navy', 'Ivory'],
    features: ['Cordless lift', 'Child safe', 'Inside or outside mount', 'Blackout liner available'],
  },
  {
    name: 'Norman Essentials Roller Shade — Blackout',
    category: 'Roller',
    material: 'Blackout Polyester',
    description: 'Complete light blockage for bedrooms and media rooms. Same sleek profile as the Essentials line with full blackout performance.',
    base_price_cents: 22900,
    is_motorized: false,
    colors: ['White', 'Linen', 'Charcoal', 'Black', 'Stone'],
    features: ['100% blackout', 'Cordless lift', 'Child safe', 'Inside or outside mount'],
  },
  {
    name: 'Norman Premier Roller Shade',
    category: 'Roller',
    material: 'Premium Woven Polyester',
    description: 'Elevated fabric quality with a wider color palette. Features a cassette headrail for a refined, finished look.',
    base_price_cents: 28900,
    is_motorized: false,
    colors: ['White', 'Cream', 'Warm Gray', 'Slate', 'Dusk', 'Midnight', 'Sage', 'Terracotta'],
    features: ['Cassette headrail', 'Cordless lift', 'Child safe', 'Inside or outside mount', 'Blackout liner available'],
  },
  {
    name: 'Norman Essentials Motorized Roller Shade',
    category: 'Roller',
    material: 'Light Filtering Polyester',
    description: 'Same great Essentials fabric with whisper-quiet motorization. Compatible with Alexa, Google Home, and Apple HomeKit.',
    base_price_cents: 38900,
    is_motorized: true,
    colors: ['White', 'Linen', 'Stone', 'Charcoal', 'Navy', 'Ivory'],
    features: ['Whisper-quiet motor', 'Smart home compatible', 'Rechargeable battery', 'App control', 'Scene programming'],
  },
  {
    name: 'Norman Premier Motorized Roller Shade',
    category: 'Roller',
    material: 'Premium Woven Polyester',
    description: 'Top-tier motorized roller with cassette headrail and full smart home integration. The flagship of the Norman roller line.',
    base_price_cents: 52900,
    is_motorized: true,
    colors: ['White', 'Cream', 'Warm Gray', 'Slate', 'Dusk', 'Midnight', 'Sage', 'Terracotta'],
    features: ['Cassette headrail', 'Whisper-quiet motor', 'Smart home compatible', 'Rechargeable battery', 'App control', 'Scene programming'],
  },

  // ── Wood Shutters ──────────────────────────────────────
  {
    name: 'Norman Woodlore Composite Shutter',
    category: 'Shutter',
    material: 'Engineered Wood Composite',
    description: 'The most popular shutter in the Norman line. Moisture-resistant composite construction — perfect for kitchens, bathrooms, and humid climates.',
    base_price_cents: 64900,
    is_motorized: false,
    colors: ['Bright White', 'Antique White', 'Cotton', 'Pebble', 'Driftwood'],
    features: ['Moisture resistant', 'Warp proof', '2.5" or 3.5" louvers', 'Full height or café style', 'Hidden tilt rod available'],
  },
  {
    name: 'Norman Woodlore Plus Shutter',
    category: 'Shutter',
    material: 'Premium Composite with UV Protection',
    description: 'Enhanced UV-resistant composite with a more refined finish. Ideal for south-facing windows with heavy sun exposure.',
    base_price_cents: 79900,
    is_motorized: false,
    colors: ['Bright White', 'Antique White', 'Cotton', 'Pebble', 'Driftwood', 'Linen'],
    features: ['UV resistant', 'Moisture resistant', 'Warp proof', '2.5", 3.5" or 4.5" louvers', 'Hidden tilt rod available', 'Full height, café or tier-on-tier'],
  },
  {
    name: 'Norman Hardwood Shutter',
    category: 'Shutter',
    material: 'Premium Basswood',
    description: 'Real basswood shutters with a hand-finished paint or stain. Lighter than composite, with a warm natural grain.',
    base_price_cents: 94900,
    is_motorized: false,
    colors: ['Bright White', 'Antique White', 'Custom Paint Match', 'Natural Stain', 'Espresso Stain', 'Honey Stain'],
    features: ['Real basswood', 'Hand-painted or stained', '2.5", 3.5" or 4.5" louvers', 'Hidden tilt rod available', 'Custom sizing'],
  },
  {
    name: 'Norman Motorized Woodlore Shutter',
    category: 'Shutter',
    material: 'Engineered Wood Composite',
    description: 'The classic Woodlore composite shutter with motorized louver tilt. Adjust light levels without touching the shutter.',
    base_price_cents: 119900,
    is_motorized: true,
    colors: ['Bright White', 'Antique White', 'Cotton', 'Pebble'],
    features: ['Motorized louver tilt', 'Smart home compatible', 'Moisture resistant', 'Warp proof', '3.5" or 4.5" louvers'],
  },

  // ── Cellular Shades ────────────────────────────────────
  {
    name: 'Norman Single Cell Shade',
    category: 'Cellular',
    material: 'Single Cell Polyester',
    description: 'Energy-efficient single cell construction traps air to insulate windows. Great for moderate climates and budget-conscious installs.',
    base_price_cents: 15900,
    is_motorized: false,
    colors: ['White', 'Linen', 'Almond', 'Antique', 'Slate', 'Stone'],
    features: ['Energy efficient', 'Cordless lift', 'Light filtering or blackout', 'Inside or outside mount', 'Top-down/bottom-up available'],
  },
  {
    name: 'Norman Double Cell Shade',
    category: 'Cellular',
    material: 'Double Cell Polyester',
    description: 'Superior insulation with double-cell honeycomb construction. Ideal for extreme climates — keeps heat in during winter and out during summer.',
    base_price_cents: 21900,
    is_motorized: false,
    colors: ['White', 'Linen', 'Almond', 'Antique', 'Slate', 'Stone', 'Pearl'],
    features: ['Superior insulation', 'Cordless lift', 'Light filtering or blackout', 'Top-down/bottom-up available', 'Inside or outside mount'],
  },
  {
    name: 'Norman Motorized Single Cell Shade',
    category: 'Cellular',
    material: 'Single Cell Polyester',
    description: 'Energy-saving cellular shade with smart home motorization. Program to raise and lower automatically based on time of day.',
    base_price_cents: 34900,
    is_motorized: true,
    colors: ['White', 'Linen', 'Almond', 'Antique', 'Slate', 'Stone'],
    features: ['Energy efficient', 'Whisper-quiet motor', 'Smart home compatible', 'Schedule programming', 'Rechargeable battery'],
  },
  {
    name: 'Norman Motorized Double Cell Shade',
    category: 'Cellular',
    material: 'Double Cell Polyester',
    description: 'Maximum insulation meets smart home convenience. The top choice for energy-conscious homeowners in Utah.',
    base_price_cents: 44900,
    is_motorized: true,
    colors: ['White', 'Linen', 'Almond', 'Antique', 'Slate', 'Stone', 'Pearl'],
    features: ['Superior insulation', 'Whisper-quiet motor', 'Smart home compatible', 'Schedule programming', 'Rechargeable battery'],
  },

  // ── Roman Shades ───────────────────────────────────────
  {
    name: 'Norman Classic Roman Shade',
    category: 'Roman',
    material: 'Woven Polyester Blend',
    description: 'Timeless flat-fold roman shade in a range of textured fabrics. Adds softness and elegance to any room.',
    base_price_cents: 24900,
    is_motorized: false,
    colors: ['White', 'Ivory', 'Linen', 'Warm Gray', 'Sage', 'Dusty Blue', 'Blush', 'Taupe'],
    features: ['Flat fold style', 'Cordless lift', 'Light filtering or blackout liner', 'Inside or outside mount'],
  },
  {
    name: 'Norman Relaxed Roman Shade',
    category: 'Roman',
    material: 'Soft Woven Fabric',
    description: 'Casual curved bottom hem gives a relaxed, lived-in look. Popular in bedrooms, breakfast nooks, and informal spaces.',
    base_price_cents: 27900,
    is_motorized: false,
    colors: ['White', 'Ivory', 'Linen', 'Warm Gray', 'Sage', 'Dusty Blue', 'Blush', 'Taupe', 'Natural'],
    features: ['Relaxed curved hem', 'Cordless lift', 'Light filtering or blackout liner', 'Inside or outside mount'],
  },
  {
    name: 'Norman Motorized Roman Shade',
    category: 'Roman',
    material: 'Premium Woven Fabric',
    description: 'Elegant roman style with smooth motorized operation. No cords, no hassle — perfect for hard-to-reach windows.',
    base_price_cents: 48900,
    is_motorized: true,
    colors: ['White', 'Ivory', 'Linen', 'Warm Gray', 'Sage', 'Dusty Blue', 'Blush', 'Taupe'],
    features: ['Whisper-quiet motor', 'Smart home compatible', 'No visible cords', 'Rechargeable battery', 'App control'],
  },

  // ── Natural Woven ──────────────────────────────────────
  {
    name: 'Norman Natural Woven Shade — Bamboo',
    category: 'Natural',
    material: 'Woven Bamboo',
    description: 'Organic bamboo weave brings warmth and texture to any space. Each shade has natural variation — no two are exactly alike.',
    base_price_cents: 22900,
    is_motorized: false,
    colors: ['Natural', 'Honey', 'Espresso', 'Whitewash', 'Driftwood'],
    features: ['Natural bamboo', 'Light filtering', 'Privacy liner available', 'Inside or outside mount', 'Valance included'],
  },
  {
    name: 'Norman Natural Woven Shade — Seagrass',
    category: 'Natural',
    material: 'Woven Seagrass',
    description: 'Coastal-inspired seagrass weave with a relaxed, organic texture. Pairs beautifully with neutral and beach-inspired interiors.',
    base_price_cents: 25900,
    is_motorized: false,
    colors: ['Natural', 'Bleached', 'Caramel', 'Driftwood'],
    features: ['Natural seagrass', 'Light filtering', 'Privacy liner available', 'Inside or outside mount', 'Valance included'],
  },
  {
    name: 'Norman Natural Woven Shade — Jute',
    category: 'Natural',
    material: 'Woven Jute',
    description: 'Rich, earthy jute texture with excellent light diffusion. Creates a warm, natural ambiance throughout the day.',
    base_price_cents: 23900,
    is_motorized: false,
    colors: ['Natural', 'Tan', 'Mocha', 'Chocolate'],
    features: ['Natural jute fiber', 'Light filtering', 'Privacy liner available', 'Inside or outside mount'],
  },
  {
    name: 'Norman Motorized Natural Woven Shade',
    category: 'Natural',
    material: 'Premium Woven Natural Fiber',
    description: 'The organic beauty of natural woven shades with motorized convenience. Available in bamboo, seagrass, or jute weaves.',
    base_price_cents: 46900,
    is_motorized: true,
    colors: ['Natural Bamboo', 'Honey Bamboo', 'Natural Seagrass', 'Natural Jute', 'Mocha Jute'],
    features: ['Whisper-quiet motor', 'Smart home compatible', 'Natural fiber weave', 'Privacy liner available', 'Rechargeable battery'],
  },
];

async function seedCatalog() {
  console.log('🌱 Seeding Norman Window Fashions catalog...\n');

  // Get the NSS dealer ID
  const { data: dealer, error: dealerError } = await supabase
    .from('dealers')
    .select('id, name')
    .eq('name', 'Nielsen Shades & Shutters')
    .single();

  if (dealerError || !dealer) {
    console.error('❌ Could not find Nielsen Shades & Shutters dealer:', dealerError);
    return;
  }

  console.log(`✅ Found dealer: ${dealer.name} (${dealer.id})\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    const dealerPriceCents = dealerCost(product.base_price_cents);

    // Insert into global products table
    const { data: globalProduct, error: productError } = await supabase
      .from('products')
      .insert({
        name: product.name,
        category: product.category,
        material: product.material,
        description: product.description,
        base_price_cents: product.base_price_cents,
        is_motorized: product.is_motorized,
        colors: product.colors,
        features: product.features,
        is_active: true,
      })
      .select('id')
      .single();

    if (productError) {
      console.error(`❌ Failed to insert ${product.name}:`, productError.message);
      errorCount++;
      continue;
    }

    // Link to dealer catalog with dealer pricing
    const { error: catalogError } = await supabase
      .from('dealer_products')
      .insert({
        dealer_id: dealer.id,
        product_id: globalProduct.id,
        dealer_price_cents: dealerPriceCents,
        is_visible: true,
      });

    if (catalogError) {
      console.error(`❌ Failed to link ${product.name} to dealer:`, catalogError.message);
      errorCount++;
      continue;
    }

    console.log(`✅ ${product.name} — MSRP $${(product.base_price_cents / 100).toFixed(0)} · Dealer $${(dealerPriceCents / 100).toFixed(0)}`);
    successCount++;
  }

  console.log(`\n🎉 Done! ${successCount} products seeded, ${errorCount} errors.`);
}

seedCatalog();