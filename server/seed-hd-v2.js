const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vqtuuncnolvkxyelapdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODU0ODQsImV4cCI6MjA4ODc2MTQ4NH0.q0HuKI3QWfih2jDdsJWwLTCfRnAJpDXG2li8vqIUsOA'
);

const NSS_DEALER_ID = '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c';
const HD_DEALER_ID = '6a256284-4f68-413d-be57-66039c73c33f';

const products = [
  // SHADES - Silhouette
  { name: 'Silhouette Window Shadings - Ivory Sheer', category: 'Roller', description: 'Signature S-curved vanes in ivory sheer fabric. LiteRise cordless lift. UV protection while preserving the view.', price: 48500, lead_time_days: 14 },
  { name: 'Silhouette Window Shadings - White Sheer', category: 'Roller', description: 'Signature S-curved vanes in crisp white sheer fabric. Cordless LiteRise operation. Light filtering with full privacy option.', price: 48500, lead_time_days: 14 },
  { name: 'Silhouette Window Shadings - Linen PowerView', category: 'Roller', description: 'Silhouette in warm linen sheer with PowerView Gen 3 Bluetooth motorization. Alexa, Google, and Apple HomeKit compatible.', price: 82000, lead_time_days: 16 },
  // SHADES - Pirouette
  { name: 'Pirouette Window Shadings - Natural Linen', category: 'Roller', description: 'Soft horizontal fabric vanes attached to a sheer backing. Natural linen colorway. Cordless UltraGlide retractable cord.', price: 51000, lead_time_days: 14 },
  { name: 'Pirouette Window Shadings - Warm White PowerView', category: 'Roller', description: 'Pirouette in warm white with PowerView motorization. Quiet motor, app and voice control, scheduled automation.', price: 86000, lead_time_days: 16 },
  // SHADES - Duette Honeycomb
  { name: 'Duette Honeycomb - Architella Double Cell White', category: 'Cellular', description: 'Honeycomb-within-honeycomb construction for maximum insulation. Double cell white fabric. LiteRise cordless. Top-Down/Bottom-Up available.', price: 39000, lead_time_days: 14 },
  { name: 'Duette Honeycomb - Single Cell Light Filtering Linen', category: 'Cellular', description: 'Energy-efficient single cell honeycomb in light filtering linen. Cordless operation. Ideal for living areas and bedrooms.', price: 29500, lead_time_days: 12 },
  { name: 'Duette Honeycomb - Blackout Double Cell PowerView', category: 'Cellular', description: 'Double cell blackout cellular shade with PowerView motorization. Full room darkening. Smart home compatible.', price: 69500, lead_time_days: 16 },
  { name: 'Duette Architella - Top-Down/Bottom-Up Ivory', category: 'Cellular', description: 'Architella double cell in ivory with Top-Down/Bottom-Up operation. Privacy and natural light simultaneously. Cordless.', price: 44500, lead_time_days: 14 },
  // SHADES - Vignette Roman
  { name: 'Vignette Modern Roman Shades - Antique White', category: 'Roman', description: 'Continuous loop of fabric folds for a classic Roman look. Antique white fabric. No exposed rear cords. LiteRise cordless.', price: 42500, lead_time_days: 16 },
  { name: 'Vignette Modern Roman Shades - Slate Gray', category: 'Roman', description: 'Contemporary roman shade in slate gray fabric. Hidden rear cords for a clean look. Top-Down/Bottom-Up available.', price: 42500, lead_time_days: 16 },
  { name: 'Vignette Modern Roman Shades - Ivory PowerView', category: 'Roman', description: 'Vignette roman shade in ivory with PowerView motorization. Whisper-quiet motor. Sunrise/sunset scheduling.', price: 76000, lead_time_days: 18 },
  // SHADES - Provenance Woven Woods
  { name: 'Provenance Woven Woods - Havana Natural', category: 'Natural', description: 'Natural grass, bamboo, and wood fibers woven into a rich texture. Havana natural colorway. Cordless lift. Top-Down available.', price: 35500, lead_time_days: 14 },
  { name: 'Provenance Woven Woods - Seagrass Wheat', category: 'Natural', description: 'Seagrass weave in warm wheat tones. Light filtering natural material. Privacy liner available as add-on. Cordless.', price: 35500, lead_time_days: 14 },
  { name: 'Provenance Woven Woods - Bamboo Caramel PowerView', category: 'Natural', description: 'Bamboo weave in caramel tones with PowerView motorization. Natural light filtering. App and voice control.', price: 68000, lead_time_days: 16 },
  // SHADES - Designer Roller
  { name: 'Designer Roller Shades - Sheer White', category: 'Roller', description: 'Clean minimal roller shade in sheer white fabric. UV filtering, view-through. Cordless fascia-style cassette.', price: 26500, lead_time_days: 10 },
  { name: 'Designer Roller Shades - Solar Screen 5pct Openness', category: 'Roller', description: 'Solar screen roller shade with 5 percent openness factor. Reduces glare and UV while maintaining outward view. Cordless.', price: 29000, lead_time_days: 10 },
  { name: 'Designer Roller Shades - Blackout Linen', category: 'Roller', description: 'Full blackout roller shade in textured linen fabric. Room darkening for bedrooms and media rooms. Cordless cassette.', price: 31000, lead_time_days: 10 },
  { name: 'Designer Roller Shades - PowerView Motorized Solar', category: 'Roller', description: 'Motorized solar roller shade with PowerView Gen 3. Schedule automation, voice and app control. Sun-tracking programming available.', price: 59500, lead_time_days: 14 },
  // SHADES - Luminette Vertical
  { name: 'Luminette Privacy Sheers - White Sheer Panel', category: 'Roller', description: 'Fabric vanes on a sheer vertical panel. Ideal for sliding doors and large windows. Soft white. Wand or motorized rotation.', price: 56000, lead_time_days: 16 },
  { name: 'Luminette Privacy Sheers - Champagne PowerView', category: 'Roller', description: 'Luminette in champagne sheer with PowerView motorization. Traverses and rotates via app. Perfect for patio doors.', price: 89500, lead_time_days: 18 },
  // BLINDS - Wood
  { name: 'Parkland Wood Blinds - 2in White', category: 'Other', description: 'Real basswood slats in classic white. 2-inch slat width. Cordless lift and tilt. Lifetime guarantee against warping.', price: 24500, lead_time_days: 10 },
  { name: 'Parkland Wood Blinds - 2in Chestnut', category: 'Other', description: 'Real basswood in warm chestnut stain. 2-inch slats. Cordless operation. Smooth tilt mechanism.', price: 24500, lead_time_days: 10 },
  { name: 'Parkland Wood Blinds - 2.5in Antique White', category: 'Other', description: 'Wider 2.5-inch basswood slats in antique white. Enhanced light control. Cordless LiteRise.', price: 26500, lead_time_days: 10 },
  // BLINDS - Faux Wood
  { name: 'EverWood Faux Wood Blinds - 2in Bright White', category: 'Other', description: 'Faux wood blinds guaranteed not to fade, yellow, warp, or bow. Bright white. 2-inch slats. Cordless. Ideal for high-humidity rooms.', price: 19500, lead_time_days: 8 },
  { name: 'EverWood Faux Wood Blinds - 2in Espresso', category: 'Other', description: 'Rich espresso faux wood. Moisture resistant, child safe cordless operation. Great for kitchens and bathrooms.', price: 19500, lead_time_days: 8 },
  { name: 'EverWood Faux Wood Blinds - 2.5in Alabaster', category: 'Other', description: 'Wider 2.5-inch faux wood in alabaster white. Enhanced coverage. Cordless. Warp-resistant construction.', price: 21500, lead_time_days: 8 },
  // BLINDS - Aluminum
  { name: 'Precious Metals Aluminum Blinds - 1in Satin Silver', category: 'Other', description: 'Classic 1-inch aluminum mini blind in satin silver. Lightweight and durable. Cordless tilt and lift.', price: 14500, lead_time_days: 7 },
  { name: 'Precious Metals Aluminum Blinds - 1in Matte White', category: 'Other', description: 'Matte white 1-inch aluminum slats. Clean modern look. Cordless. Great for offices and utility spaces.', price: 14500, lead_time_days: 7 },
  // SHUTTERS
  { name: 'Palm Beach Polysatin Shutters - Bright White 2.5in Louver', category: 'Shutter', description: 'UV-resistant Polysatin compound. Guaranteed not to warp, crack, fade, or discolor. 2.5-inch louver. Bright white. Full height panel.', price: 38500, lead_time_days: 21 },
  { name: 'Palm Beach Polysatin Shutters - Antique White 3.5in Louver', category: 'Shutter', description: 'Wider 3.5-inch louver for expansive views. Antique white Polysatin. Hidden tilt rod option. Lifetime guarantee.', price: 42000, lead_time_days: 21 },
  { name: 'Palm Beach Polysatin Shutters - Cafe Style Bright White', category: 'Shutter', description: 'Cafe-style lower panel only. Bright white Polysatin. Great for kitchens and bathrooms.', price: 31000, lead_time_days: 21 },
  { name: 'NewStyle Hybrid Shutters - White 2.5in Louver', category: 'Shutter', description: 'Hybrid polymer and wood composite for enhanced strength. White with 2.5-inch louver. H-frame or L-frame installation.', price: 44500, lead_time_days: 21 },
  { name: 'NewStyle Hybrid Shutters - Antique White 4.5in Louver', category: 'Shutter', description: 'Statement 4.5-inch louver on NewStyle hybrid shutter. Antique white. Maximum view-through. Hidden or exposed tilt rod.', price: 49500, lead_time_days: 21 },
  // CELLULAR ROLLER
  { name: 'Sonnette Cellular Roller Shades - Ivory', category: 'Cellular', description: 'Hybrid combining cellular insulation with roller shade simplicity. Ivory fabric. Cordless. Modern profile with energy efficiency.', price: 37500, lead_time_days: 14 },
  { name: 'Sonnette Cellular Roller Shades - Linen PowerView', category: 'Cellular', description: 'Sonnette cellular roller in linen with PowerView motorization. Best of both worlds - insulation and smart control.', price: 71000, lead_time_days: 16 },
  // DRAPERY
  { name: 'Luminette Drapery Panels - Ivory Sheer', category: 'Other', description: 'Floor-to-ceiling sheer drapery panels with integrated vanes. Ivory. Traverse on decorative rod or track. Soft, elegant light control.', price: 68000, lead_time_days: 21 },
  { name: 'Luminette Drapery Panels - Champagne PowerView', category: 'Other', description: 'Luminette drapery in champagne with PowerView motorized traverse. Voice and app control. Ideal for large window walls.', price: 115000, lead_time_days: 24 },
];

async function seed() {
  console.log('Starting Hunter Douglas catalog seed...\n');

  let created = 0, linked = 0, errors = 0;

  for (const p of products) {
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        dealer_id: HD_DEALER_ID,
        name: p.name,
        category: p.category,
        description: p.description,
        price: p.price,
        unit: 'per window',
        lead_time_days: p.lead_time_days,
        is_active: true,
      })
      .select()
      .single();

    if (prodErr) {
      console.error('Product error (' + p.name + '):', prodErr.message);
      errors++;
      continue;
    }
    created++;

    const { error: linkErr } = await supabase
      .from('dealer_products')
      .insert({
        dealer_id: NSS_DEALER_ID,
        product_id: product.id,
        is_active: true,
      });

    if (linkErr) {
      console.error('Link error (' + p.name + '):', linkErr.message);
      errors++;
    } else {
      linked++;
      console.log('✓', p.name);
    }
  }

  console.log('\nProducts created:', created);
  console.log('Linked to NSS:', linked);
  console.log('Errors:', errors);
  console.log('\nDone!');
}

seed();
