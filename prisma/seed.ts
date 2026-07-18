import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "../src/config/prisma";
import { Role } from "../src/generated/prisma/client";
import type { InventoryCategory } from "../src/generated/prisma/client";

// quantity > minStockLevel  → in stock (healthy)
// quantity > 0 && quantity <= minStockLevel → low stock (triggers alert)
// quantity === 0 → out of stock
//
// Items are interleaved across 8 categories (round-robin) so the UI renders
// a natural mix rather than clustering all Electrical rows first, then Plumbing, etc.
type SeedItem = { category: InventoryCategory; name: string; serialNumber: string; quantity: number; minStockLevel: number };

const inventoryItems: SeedItem[] = [
  // round 1
  { category: "ELECTRICAL", name: "LED Ceiling Light (40W)", serialNumber: "ELEC-00001", quantity: 48, minStockLevel: 10 },
  { category: "PLUMBING", name: 'PVC Pipe (2", 10ft)', serialNumber: "PLMB-00001", quantity: 20, minStockLevel: 5 },
  { category: "HVAC", name: "Air Filter (16×20×1, MERV-8)", serialNumber: "HVAC-00001", quantity: 60, minStockLevel: 12 },
  { category: "TOOLS", name: "Utility Knife Blades (pack of 10)", serialNumber: "TOOL-00001", quantity: 40, minStockLevel: 10 },
  { category: "FASTENERS", name: 'Wood Screw #8 × 1-1/2" (box of 100)', serialNumber: "FAST-00001", quantity: 20, minStockLevel: 5 },
  { category: "CHEMICALS", name: "All-Purpose Cleaner (1-gallon)", serialNumber: "CHEM-00001", quantity: 12, minStockLevel: 4 },
  { category: "SAFETY", name: "Fire Extinguisher ABC (5lb)", serialNumber: "SAFE-00001", quantity: 8, minStockLevel: 4 },
  { category: "BUILDING_MATERIALS", name: 'Drywall Sheet (4×8, 1/2")', serialNumber: "BLDG-00001", quantity: 25, minStockLevel: 5 },
  // round 2
  { category: "ELECTRICAL", name: "LED Fluorescent Tube (4ft)", serialNumber: "ELEC-00002", quantity: 120, minStockLevel: 20 },
  { category: "PLUMBING", name: 'PVC Elbow (2", 90°)', serialNumber: "PLMB-00002", quantity: 45, minStockLevel: 10 },
  { category: "HVAC", name: "Air Filter (20×25×1, MERV-8)", serialNumber: "HVAC-00002", quantity: 40, minStockLevel: 12 },
  { category: "TOOLS", name: "HSS Drill Bit Set (29-piece)", serialNumber: "TOOL-00002", quantity: 5, minStockLevel: 2 },
  { category: "FASTENERS", name: 'Wood Screw #8 × 2-1/2" (box of 100)', serialNumber: "FAST-00002", quantity: 15, minStockLevel: 5 },
  { category: "CHEMICALS", name: "Disinfectant Spray (32oz)", serialNumber: "CHEM-00002", quantity: 24, minStockLevel: 6 },
  { category: "SAFETY", name: "First Aid Kit (50-piece)", serialNumber: "SAFE-00002", quantity: 2, minStockLevel: 3 }, // low stock
  { category: "BUILDING_MATERIALS", name: "Joint Compound (1-gallon)", serialNumber: "BLDG-00002", quantity: 8, minStockLevel: 3 },
  // round 3
  { category: "ELECTRICAL", name: "Circuit Breaker (20A)", serialNumber: "ELEC-00003", quantity: 4, minStockLevel: 5 }, // low stock
  { category: "PLUMBING", name: 'PVC Coupling (2")', serialNumber: "PLMB-00003", quantity: 30, minStockLevel: 10 },
  { category: "HVAC", name: "Air Filter (12×12×1, MERV-8)", serialNumber: "HVAC-00003", quantity: 24, minStockLevel: 8 },
  { category: "TOOLS", name: "Safety Glasses (clear lens)", serialNumber: "TOOL-00003", quantity: 20, minStockLevel: 8 },
  { category: "FASTENERS", name: 'Drywall Screw 6 × 1-5/8" (box of 100)', serialNumber: "FAST-00003", quantity: 18, minStockLevel: 5 },
  { category: "CHEMICALS", name: "Degreaser (1-gallon)", serialNumber: "CHEM-00003", quantity: 6, minStockLevel: 3 },
  { category: "SAFETY", name: "Hard Hat (white, Type I)", serialNumber: "SAFE-00003", quantity: 10, minStockLevel: 4 },
  { category: "BUILDING_MATERIALS", name: "Interior Paint Flat White (1-gallon)", serialNumber: "BLDG-00003", quantity: 10, minStockLevel: 4 },
  // round 4
  { category: "ELECTRICAL", name: "Extension Cord (25ft, 12AWG)", serialNumber: "ELEC-00004", quantity: 8, minStockLevel: 4 },
  { category: "PLUMBING", name: "Pipe Thread Tape (roll)", serialNumber: "PLMB-00004", quantity: 25, minStockLevel: 8 },
  { category: "HVAC", name: "Thermostat Battery Pack (4-cell)", serialNumber: "HVAC-00004", quantity: 0, minStockLevel: 6 }, // out of stock
  { category: "TOOLS", name: "Work Gloves (leather palm, L)", serialNumber: "TOOL-00004", quantity: 15, minStockLevel: 6 },
  { category: "FASTENERS", name: 'Hex Bolt 1/4-20 × 1" (box of 50)', serialNumber: "FAST-00004", quantity: 12, minStockLevel: 4 },
  { category: "CHEMICALS", name: "Drain Cleaner (32oz)", serialNumber: "CHEM-00004", quantity: 8, minStockLevel: 3 },
  { category: "SAFETY", name: "High-Vis Safety Vest (L)", serialNumber: "SAFE-00004", quantity: 12, minStockLevel: 4 },
  { category: "BUILDING_MATERIALS", name: 'Paint Roller Cover 9" 3/8" Nap (pack of 4)', serialNumber: "BLDG-00004", quantity: 12, minStockLevel: 4 },
  // round 5
  { category: "ELECTRICAL", name: "Power Strip (6-outlet)", serialNumber: "ELEC-00005", quantity: 14, minStockLevel: 5 },
  { category: "PLUMBING", name: 'Ball Valve (3/4")', serialNumber: "PLMB-00005", quantity: 8, minStockLevel: 3 },
  { category: "HVAC", name: "HVAC Drive Belt (A33)", serialNumber: "HVAC-00005", quantity: 4, minStockLevel: 3 },
  { category: "TOOLS", name: "Work Gloves (leather palm, XL)", serialNumber: "TOOL-00005", quantity: 6, minStockLevel: 6 }, // low stock
  { category: "FASTENERS", name: "Hex Nut 1/4-20 (box of 100)", serialNumber: "FAST-00005", quantity: 0, minStockLevel: 4 }, // out of stock
  { category: "CHEMICALS", name: "Penetrating Lubricant WD-40 (12oz)", serialNumber: "CHEM-00005", quantity: 10, minStockLevel: 4 },
  { category: "SAFETY", name: "High-Vis Safety Vest (XL)", serialNumber: "SAFE-00005", quantity: 3, minStockLevel: 4 }, // low stock
  { category: "BUILDING_MATERIALS", name: "Painter's Tape 1\" (roll)", serialNumber: "BLDG-00005", quantity: 18, minStockLevel: 6 },
  // round 6
  { category: "ELECTRICAL", name: "Electrical Tape (roll)", serialNumber: "ELEC-00006", quantity: 35, minStockLevel: 10 },
  { category: "PLUMBING", name: "Faucet Cartridge (standard)", serialNumber: "PLMB-00006", quantity: 0, minStockLevel: 3 }, // out of stock
  { category: "HVAC", name: "HVAC Drive Belt (A42)", serialNumber: "HVAC-00006", quantity: 2, minStockLevel: 3 }, // low stock
  { category: "TOOLS", name: "Measuring Tape (25ft)", serialNumber: "TOOL-00006", quantity: 8, minStockLevel: 3 },
  { category: "FASTENERS", name: 'Flat Washer 1/4" (box of 100)', serialNumber: "FAST-00006", quantity: 10, minStockLevel: 4 },
  { category: "CHEMICALS", name: "Penetrating Oil PB Blaster (11oz)", serialNumber: "CHEM-00006", quantity: 5, minStockLevel: 3 },
  { category: "SAFETY", name: "Disposable Earplugs (pack of 50)", serialNumber: "SAFE-00006", quantity: 20, minStockLevel: 6 },
  { category: "BUILDING_MATERIALS", name: "Sandpaper 80-grit (pack of 20)", serialNumber: "BLDG-00006", quantity: 3, minStockLevel: 4 }, // low stock
  // round 7
  { category: "ELECTRICAL", name: "Wire Nuts (pack of 50)", serialNumber: "ELEC-00007", quantity: 22, minStockLevel: 8 },
  { category: "PLUMBING", name: 'Drain Strainer (4")', serialNumber: "PLMB-00007", quantity: 12, minStockLevel: 5 },
  { category: "HVAC", name: "Condensate Pan Tablets (pack of 6)", serialNumber: "HVAC-00007", quantity: 18, minStockLevel: 6 },
  { category: "TOOLS", name: "Digital Multimeter", serialNumber: "TOOL-00007", quantity: 3, minStockLevel: 1 },
  { category: "FASTENERS", name: 'Lock Washer 1/4" (box of 100)', serialNumber: "FAST-00007", quantity: 6, minStockLevel: 4 },
  { category: "CHEMICALS", name: "Threadlocker Loctite 243 (6ml)", serialNumber: "CHEM-00007", quantity: 1, minStockLevel: 2 }, // low stock
  { category: "SAFETY", name: "N95 Dust Mask (pack of 10)", serialNumber: "SAFE-00007", quantity: 8, minStockLevel: 4 },
  { category: "BUILDING_MATERIALS", name: "Wood Putty (3.7oz, natural)", serialNumber: "BLDG-00007", quantity: 0, minStockLevel: 3 }, // out of stock
  // round 8
  { category: "ELECTRICAL", name: "GFCI Outlet", serialNumber: "ELEC-00008", quantity: 6, minStockLevel: 8 }, // low stock
  { category: "PLUMBING", name: "Toilet Flapper", serialNumber: "PLMB-00008", quantity: 10, minStockLevel: 4 },
  { category: "HVAC", name: 'Foil Duct Tape (2", silver)', serialNumber: "HVAC-00008", quantity: 10, minStockLevel: 4 },
  { category: "TOOLS", name: "Caulking Gun (standard)", serialNumber: "TOOL-00008", quantity: 4, minStockLevel: 2 },
  { category: "FASTENERS", name: 'Drywall Anchor 3/8" (pack of 25)', serialNumber: "FAST-00008", quantity: 30, minStockLevel: 8 },
  { category: "CHEMICALS", name: "Heavy-Duty Garbage Bags 55-gal (box of 50)", serialNumber: "CHEM-00008", quantity: 8, minStockLevel: 3 },
  { category: "SAFETY", name: 'Safety Cone 28" (traffic)', serialNumber: "SAFE-00008", quantity: 6, minStockLevel: 4 },
  { category: "BUILDING_MATERIALS", name: "Paintable Caulk White (10oz)", serialNumber: "BLDG-00008", quantity: 14, minStockLevel: 5 },
  // round 9 — SAFE and BLDG exhausted
  { category: "ELECTRICAL", name: "Light Switch (standard)", serialNumber: "ELEC-00009", quantity: 18, minStockLevel: 6 },
  { category: "PLUMBING", name: "Plumber's Putty (14oz)", serialNumber: "PLMB-00009", quantity: 7, minStockLevel: 4 },
  { category: "HVAC", name: "Refrigerant R-410A (25lb cylinder)", serialNumber: "HVAC-00009", quantity: 1, minStockLevel: 2 }, // low stock
  { category: "TOOLS", name: 'Pipe Wrench (14")', serialNumber: "TOOL-00009", quantity: 3, minStockLevel: 1 },
  { category: "FASTENERS", name: "Framing Nail 16d (5lb box)", serialNumber: "FAST-00009", quantity: 4, minStockLevel: 2 },
  { category: "CHEMICALS", name: "Microfiber Cleaning Cloth (pack of 12)", serialNumber: "CHEM-00009", quantity: 0, minStockLevel: 3 }, // out of stock
  // round 10 — SAFE and BLDG exhausted
  { category: "ELECTRICAL", name: 'Conduit (10ft, 3/4")', serialNumber: "ELEC-00010", quantity: 4, minStockLevel: 6 }, // low stock
  { category: "PLUMBING", name: "Pipe Insulation (6ft)", serialNumber: "PLMB-00010", quantity: 15, minStockLevel: 8 },
  { category: "HVAC", name: "Run Capacitor (35+5 MFD, 440V)", serialNumber: "HVAC-00010", quantity: 1, minStockLevel: 2 }, // low stock
  { category: "TOOLS", name: 'Spirit Level (24")', serialNumber: "TOOL-00010", quantity: 2, minStockLevel: 1 },
  { category: "FASTENERS", name: 'Toggle Bolt 3/16" × 2" (pack of 10)', serialNumber: "FAST-00010", quantity: 8, minStockLevel: 3 },
  { category: "CHEMICALS", name: "Mop Head (looped-end replacement)", serialNumber: "CHEM-00010", quantity: 2, minStockLevel: 3 }, // low stock
  // round 11 — HVAC, TOOL, CHEM, SAFE, BLDG exhausted
  { category: "ELECTRICAL", name: "Cable Ties (pack of 100)", serialNumber: "ELEC-00011", quantity: 30, minStockLevel: 10 },
  { category: "PLUMBING", name: 'Water Supply Line (12")', serialNumber: "PLMB-00011", quantity: 3, minStockLevel: 5 }, // low stock
  { category: "FASTENERS", name: 'Self-Tapping Screw #8 × 1" (box of 100)', serialNumber: "FAST-00011", quantity: 0, minStockLevel: 5 }, // out of stock
  // round 12
  { category: "ELECTRICAL", name: 'Junction Box (4")', serialNumber: "ELEC-00012", quantity: 12, minStockLevel: 5 },
  { category: "PLUMBING", name: "Silicone Caulk (clear, 10oz)", serialNumber: "PLMB-00012", quantity: 0, minStockLevel: 6 }, // out of stock
  { category: "FASTENERS", name: 'Machine Screw 10-32 × 1" (box of 50)', serialNumber: "FAST-00012", quantity: 3, minStockLevel: 4 }, // low stock
  // round 13 — only ELEC remaining
  { category: "ELECTRICAL", name: "LED Exit Sign", serialNumber: "ELEC-00013", quantity: 3, minStockLevel: 5 }, // low stock
  { category: "ELECTRICAL", name: "Battery (AA, pack of 24)", serialNumber: "ELEC-00014", quantity: 80, minStockLevel: 20 },
  { category: "ELECTRICAL", name: "Battery (9V, pack of 12)", serialNumber: "ELEC-00015", quantity: 0, minStockLevel: 10 }, // out of stock
];

const seed = async (): Promise<void> => {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("❌ SEED_ADMIN_PASSWORD env var is required");

    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password: hashedPassword },
    create: {
      userName: "admin",
      email: "admin@example.com",
      password: hashedPassword,
      roles: [Role.ADMIN],
    },
  });

  console.log("✅ Seeded admin user:", admin.email);

  const { count } = await prisma.inventoryItem.createMany({
    data: inventoryItems,
    skipDuplicates: true, // re-runs won't overwrite live quantity changes
  });

  console.log(`✅ Seeded inventory: ${count} new items added (${inventoryItems.length - count} already existed)`);
};

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
