const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://vqtuuncnolvkxyelapdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxdHV1bmNub2x2a3h5ZWxhcGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODU0ODQsImV4cCI6MjA4ODc2MTQ4NH0.q0HuKI3QWfih2jDdsJWwLTCfRnAJpDXG2li8vqIUsOA'
);

const NSS_DEALER_ID = '064bead2-5fd9-4f8f-a06a-13b4e48a2f8c';

const products = [

  // ── SHADES ─────────────────────────────────────────────────────────────────

  // Silhouette Window Shadings
  { name: 'Silhouette® Window Shadings — Ivory Sheer', category: 'Shades', subcategory: 'Sheer Shades',
    description: 'Signature S-curved vanes suspended between two sheers. Soft ivory fabric. LiteRise® cordless lift. UV protection while preserving the view.', price: 485, lead_time_days: 14 },
  { name: 'Silhouette® Window Shadings — White Sheer', category: 'Shades', subcategory: 'Sheer Shades',
    description: 'Signature S-curved vanes in crisp white sheer fabric. Cordless LiteRise® operation. Light filtering with full privacy option.', price: 485, lead_time_days: 14 },
  { name: 'Silhouette® Window Shadings — Linen Sheer PowerView®', category: 'Shades', subcategory: 'Sheer Shades',
    description: 'Silhouette in warm linen sheer with PowerView® Gen 3 Bluetooth motorization. Alexa, Google, and Apple HomeKit compatible.', price: 820, lead_time_days: 16 },

  // Pirouette Window Shadings
  { name: 'Pirouette® Window Shadings — Natural Linen', category: 'Shades', subcategory: 'Sheer Shades',
    description: 'Soft horizontal fabric vanes attached to a sheer backing. Natural linen colorway. Cordless UltraGlide® retractable cord.', price: 510, lead_time_days: 14 },
  { name: 'Pirouette® Window Shadings — Warm White PowerView®', category: 'Shades', subcategory: 'Sheer Shades',
    description: 'Pirouette in warm white with PowerView® motorization. Quiet motor, app and voice control, scheduled automation.', price: 860, lead_time_days: 16 },

  // Duette Honeycomb Shades
  { name: 'Duette® Honeycomb Shades — Architella® Double Cell White', category: 'Shades', subcategory: 'Cellular Shades',
    description: 'Honeycomb-within-honeycomb construction for maximum insulation. Double cell white fabric. LiteRise® cordless. Top-Down/Bottom-Up available.', price: 390, lead_time_days: 14 },
  { name: 'Duette® Honeycomb Shades — Single Cell Light Filtering Linen', category: 'Shades', subcategory: 'Cellular Shades',
    description: 'Energy-efficient single cell honeycomb in light filtering linen. Cordless operation. Ideal for living areas and bedrooms.', price: 295, lead_time_days: 12 },
  { name: 'Duette® Honeycomb Shades — Blackout Double Cell PowerView®', category: 'Shades', subcategory: 'Cellular Shades',
    description: 'Double cell blackout cellular shade with PowerView® motorization. Full room darkening. Smart home compatible.', price: 695, lead_time_days: 16 },
  { name: 'Duette® Architella® Honeycomb — Top-Down/Bottom-Up Ivory', category: 'Shades', subcategory: 'Cellular Shades',
    description: 'Architella double cell in ivory with Top-Down/Bottom-Up operation. Privacy and natural light simultaneously. Cordless.', price: 445, lead_time_days: 14 },

  // Vignette Modern Roman Shades
  { name: 'Vignette® Modern Roman Shades — Antique White', category: 'Shades', subcategory: 'Roman Shades',
    description: 'Continuous loop of fabric folds for a classic Roman look. Antique white fabric. No exposed rear cords. LiteRise® cordless.', price: 425, lead_time_days: 16 },
  { name: 'Vignette® Modern Roman Shades — Slate Gray', category: 'Shades', subcategory: 'Roman Shades',
    description: 'Contemporary roman shade in slate gray fabric. Hidden rear cords for a clean look. Top-Down/Bottom-Up available.', price: 425, lead_time_days: 16 },
  { name: 'Vignette® Modern Roman Shades — Ivory PowerView®', category: 'Shades', subcategory: 'Roman Shades',
    description: 'Vignette roman shade in ivory with PowerView® motorization. Whisper-quiet motor. Sunrise/sunset scheduling.', price: 760, lead_time_days: 18 },

  // Alustra Woven Textures Roman Shades
  { name: 'Alustra® Woven Textures® Roman Shades — Grassweave Natural', category: 'Shades', subcategory: 'Roman Shades',
    description: 'Designer-grade woven natural grass textile in a roman shade format. Organic texture. Cordless UltraGlide® operation.', price: 595, lead_time_days: 18 },

  // Provenance Woven Woods
  { name: 'Provenance® Woven Woods — Havana Natural', category: 'Shades', subcategory: 'Woven Wood Shades',
    description: 'Natural grass, bamboo, and wood fibers woven into a rich texture. Havana natural colorway. Cordless lift. Top-Down available.', price: 355, lead_time_days: 14 },
  { name: 'Provenance® Woven Woods — Seagrass Wheat', category: 'Shades', subcategory: 'Woven Wood Shades',
    description: 'Seagrass weave in warm wheat tones. Light filtering natural material. Privacy liner available as add-on. Cordless.', price: 355, lead_time_days: 14 },
  { name: 'Provenance® Woven Woods — Bamboo Caramel PowerView®', category: 'Shades', subcategory: 'Woven Wood Shades',
    description: 'Bamboo weave in caramel tones with PowerView® motorization. Natural light filtering. App and voice control.', price: 680, lead_time_days: 16 },

  // Designer Roller Shades
  { name: 'Designer Roller Shades — Sheer White', category: 'Shades', subcategory: 'Roller Shades',
    description: 'Clean, minimal roller shade in sheer white fabric. UV filtering, view-through. Cordless fascia-style cassette. Multiple width options.', price: 265, lead_time_days: 10 },
  { name: 'Designer Roller Shades — Solar Screen 5% Openness', category: 'Shades', subcategory: 'Roller Shades',
    description: 'Solar screen roller shade with 5% openness factor. Reduces glare and UV while maintaining outward view. Cordless.', price: 290, lead_time_days: 10 },
  { name: 'Designer Roller Shades — Blackout Linen', category: 'Shades', subcategory: 'Roller Shades',
    description: 'Full blackout roller shade in textured linen fabric. Room darkening for bedrooms and media rooms. Cordless cassette.', price: 310, lead_time_days: 10 },
  { name: 'Designer Roller Shades — PowerView® Motorized Solar', category: 'Shades', subcategory: 'Roller Shades',
    description: 'Motorized solar roller shade with PowerView® Gen 3. Schedule automation, voice and app control. Sun-tracking programming available.', price: 595, lead_time_days: 14 },

  // Luminette Privacy Sheers (Vertical)
  { name: 'Luminette® Privacy Sheers — White Sheer Panel', category: 'Shades', subcategory: 'Vertical Shades',
    description: 'Fabric vanes on a sheer vertical panel. Ideal for sliding doors and large windows. Soft white. Wand or motorized rotation.', price: 560, lead_time_days: 16 },
  { name: 'Luminette® Privacy Sheers — Champagne PowerView®', category: 'Shades', subcategory: 'Vertical Shades',
    description: 'Luminette in champagne sheer with PowerView® motorization. Traverses and rotates via app. Perfect for patio doors.', price: 895, lead_time_days: 18 },

  // ── BLINDS ─────────────────────────────────────────────────────────────────

  // Parkland Wood Blinds
  { name: 'Parkland® Wood Blinds — 2" White', category: 'Blinds', subcategory: 'Wood Blinds',
    description: 'Real basswood slats in classic white. 2-inch slat width. Cordless lift and tilt. Lifetime guarantee against warping.', price: 245, lead_time_days: 10 },
  { name: 'Parkland® Wood Blinds — 2" Chestnut', category: 'Blinds', subcategory: 'Wood Blinds',
    description: 'Real basswood in warm chestnut stain. 2-inch slats. Cordless operation. Smooth tilt mechanism.', price: 245, lead_time_days: 10 },
  { name: 'Parkland® Wood Blinds — 2½" Antique White', category: 'Blinds', subcategory: 'Wood Blinds',
    description: 'Wider 2.5-inch basswood slats in antique white. Enhanced light control. Cordless LiteRise®.', price: 265, lead_time_days: 10 },

  // EverWood Faux Wood Blinds
  { name: 'EverWood® Faux Wood Blinds — 2" Bright White', category: 'Blinds', subcategory: 'Faux Wood Blinds',
    description: 'Faux wood blinds guaranteed not to fade, yellow, warp, or bow. Bright white. 2-inch slats. Cordless. Ideal for high-humidity rooms.', price: 195, lead_time_days: 8 },
  { name: 'EverWood® Faux Wood Blinds — 2" Espresso', category: 'Blinds', subcategory: 'Faux Wood Blinds',
    description: 'Rich espresso faux wood. Moisture resistant, child safe cordless operation. Great for kitchens and bathrooms.', price: 195, lead_time_days: 8 },
  { name: 'EverWood® Faux Wood Blinds — 2½" Alabaster', category: 'Blinds', subcategory: 'Faux Wood Blinds',
    description: 'Wider 2.5-inch faux wood in alabaster white. Enhanced coverage. Cordless. Warp-resistant construction.', price: 215, lead_time_days: 8 },

  // Precious Metals Aluminum Blinds
  { name: 'Precious Metals® Aluminum Blinds — 1" Satin Silver', category: 'Blinds', subcategory: 'Aluminum Blinds',
    description: 'Classic 1-inch aluminum mini blind in satin silver. Lightweight and durable. Cordless tilt and lift. Budget-friendly premium option.', price: 145, lead_time_days: 7 },
  { name: 'Precious Metals® Aluminum Blinds — 1" Matte White', category: 'Blinds', subcategory: 'Aluminum Blinds',
    description: 'Matte white 1-inch aluminum slats. Clean modern look. Cordless. Great for offices and utility spaces.', price: 145, lead_time_days: 7 },

  // Vertical Blinds
  { name: 'Vertical Solutions® — White Fabric 3½"', category: 'Blinds', subcategory: 'Vertical Blinds',
    description: 'Classic vertical blind with 3.5-inch white fabric vanes. Smooth traverse and rotation. Ideal for sliding doors and wide windows.', price: 285, lead_time_days: 10 },
  { name: 'Skyline® Gliding Window Panels — Linen', category: 'Blinds', subcategory: 'Vertical Blinds',
    description: 'Contemporary panel track system in natural linen. Glides on multiple tracks. Modern alternative to vertical blinds for large windows.', price: 420, lead_time_days: 14 },

  // ── SHUTTERS ───────────────────────────────────────────────────────────────

  { name: 'Palm Beach™ Polysatin Shutters — Bright White 2½" Louver', category: 'Shutters', subcategory: 'Interior Shutters',
    description: 'UV-resistant Polysatin™ compound. Guaranteed not to warp, crack, fade, or discolor. 2.5-inch louver. Bright white. Full height panel.', price: 385, lead_time_days: 21 },
  { name: 'Palm Beach™ Polysatin Shutters — Antique White 3½" Louver', category: 'Shutters', subcategory: 'Interior Shutters',
    description: 'Wider 3.5-inch louver for expansive views. Antique white Polysatin™. Hidden tilt rod option. Lifetime guarantee.', price: 420, lead_time_days: 21 },
  { name: 'Palm Beach™ Polysatin Shutters — Cafe Style Bright White', category: 'Shutters', subcategory: 'Interior Shutters',
    description: 'Cafe-style lower panel only. Bright white Polysatin™. Great for kitchens and bathrooms where privacy below and light above is needed.', price: 310, lead_time_days: 21 },
  { name: 'NewStyle® Hybrid Shutters — White 2½" Louver', category: 'Shutters', subcategory: 'Interior Shutters',
    description: 'Hybrid polymer and wood composite for enhanced strength. White with 2.5-inch louver. H-frame or L-frame installation. Full height.', price: 445, lead_time_days: 21 },
  { name: 'NewStyle® Hybrid Shutters — Antique White 4½" Louver', category: 'Shutters', subcategory: 'Interior Shutters',
    description: 'Statement 4.5-inch louver on NewStyle® hybrid shutter. Antique white. Maximum view-through. Hidden or exposed tilt rod.', price: 495, lead_time_days: 21 },

  // ── DRAPERY ────────────────────────────────────────────────────────────────

  { name: 'Sonnette® Cellular Roller Shades — Ivory', category: 'Shades', subcategory: 'Cellular Roller Shades',
    description: 'Hybrid combining cellular insulation with roller shade simplicity. Ivory fabric. Cordless. Modern profile with energy efficiency.', price: 375, lead_time_days: 14 },
  { name: 'Sonnette® Cellular Roller Shades — Linen PowerView®', category: 'Shades', subcategory: 'Cellular Roller Shades',
    description: 'Sonnette cellular roller in linen with PowerView® motorization. Best of both worlds — insulation and smart control.', price: 710, lead_time_days: 16 },

  { name: 'Luminette® Drapery Panels — Ivory Sheer', category: 'Drapery', subcategory: 'Sheer Panels',
    description: 'Floor-to-ceiling sheer drapery panels with integrated vanes. Ivory. Traverse on decorative rod or track. Soft, elegant light control.', price: 680, lead_time_days: 21 },
  { name: 'Luminette® Drapery Panels — Champagne PowerView®', category: 'Drapery', subcategory: 'Sheer Panels',
    description: 'Luminette drapery in champagne with PowerView® motorized traverse. Voice and app control. Ideal for large window walls.', price: 1150, lead_time_days: 24 },

];

async function seed() {
  console.log('Starting Hunter Douglas catalog seed...\n');

  // 1. Create Hunter Douglas dealer record
  const { data: hdDealer, error: dealerErr } = await supabase
    .from('dealers')
    .insert({
      name: 'Hunter Douglas',
      email: 'dealer.support@hunterdouglas.com',
      phone: '1-800-789-0331',
      address: '2 Park Way, Upper Saddle River, NJ 07458',
      auth_user_id: '00000000-0000-0000-0000-000000000002',
      subscription_tier: 'enterprise',
      is_active: true,
    })
    .select()
    .single();

  if (dealerErr) {
    if (dealerErr.message.includes('duplicate') || dealerErr.message.includes('unique')) {
      console.log('Hunter Douglas dealer already exists, fetching...');
      const { data: existing } = await supabase
        .from('dealers')
        .select('id')
        .eq('name', 'Hunter Douglas')
        .single();
      if (existing) {
        console.log(`Hunter Douglas dealer ID: ${existing.id}`);
        return await seedProducts(existing.id);
      }
    }
    console.error('Dealer error:', dealerErr.message);
    return;
  }

  console.log(`✓ Hunter Douglas dealer created: ${hdDealer.id}`);
  await seedProducts(hdDealer.id);
}

async function seedProducts(hdDealerId) {
  let created = 0, linked = 0, errors = 0;

  for (const p of products) {
    // Create product
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .insert({
        dealer_id: hdDealerId,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory || null,
        description: p.description,
        price: p.price,
        unit: 'per window',
        lead_time_days: p.lead_time_days,
        is_active: true,
      })
      .select()
      .single();

    if (prodErr) {
      console.error(`✗ Product error (${p.name}): ${prodErr.message}`);
      errors++;
      continue;
    }

    created++;

    // Link to NSS dealer
    const { error: linkErr } = await supabase
      .from('dealer_products')
      .insert({
        dealer_id: NSS_DEALER_ID,
        product_id: product.id,
        custom_price: null,
        is_active: true,
      });

    if (linkErr) {
      console.error(`✗ Link error (${p.name}): ${linkErr.message}`);
      errors++;
    } else {
      linked++;
    }
  }

  console.log(`\n✓ Products created: ${created}`);
  console.log(`✓ Linked to NSS: ${linked}`);
  console.log(`✗ Errors: ${errors}`);
  console.log('\nHunter Douglas catalog seed complete.');
}

seed();
