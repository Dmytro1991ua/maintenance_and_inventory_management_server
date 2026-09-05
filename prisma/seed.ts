import "dotenv/config";

import bcrypt from "bcrypt";

import { prisma } from "../src/config/prisma";
import { Role } from "../src/generated/prisma/client";
import type {
  AssetCategory,
  AssetStatus,
  InventoryCategory,
  TaskPriority,
  TaskStatus,
} from "../src/generated/prisma/client";

type ChecklistTemplateSeed = { category: InventoryCategory; items: string[] };

const checklistTemplates: ChecklistTemplateSeed[] = [
  {
    category: "ELECTRICAL",
    items: [
      "Power isolated / breaker off?",
      "Repair completed and connections secured?",
      "Power restored and tested?",
      "Area left safe and tidy?",
    ],
  },
  {
    category: "PLUMBING",
    items: [
      "Water supply shut off?",
      "Repair completed and fittings secured?",
      "Water supply restored and tested for leaks?",
      "Area dried and left tidy?",
    ],
  },
  {
    category: "HVAC",
    items: [
      "Unit powered off before work?",
      "Filter/component replaced or repaired?",
      "Unit powered on and tested?",
      "Airflow verified normal?",
      "Area left tidy?",
    ],
  },
  {
    category: "TOOLS",
    items: ["Tool tested and operational?", "Tool cleaned and stored correctly?"],
  },
  {
    category: "FASTENERS",
    items: [
      "Correct fastener specification used?",
      "Torque applied to spec?",
      "Area inspected for loose fasteners?",
    ],
  },
  {
    category: "CHEMICALS",
    items: [
      "PPE worn throughout task?",
      "Chemical applied per safety data sheet?",
      "Area ventilated after application?",
      "Waste disposed of correctly?",
    ],
  },
  {
    category: "SAFETY",
    items: [
      "Hazard identified and contained?",
      "Corrective action completed?",
      "Area inspected and cleared?",
      "Incident logged if required?",
    ],
  },
  {
    category: "BUILDING_MATERIALS",
    items: [
      "Materials correctly installed?",
      "Structural integrity verified?",
      "Area cleaned and debris removed?",
      "Work meets building standards?",
    ],
  },
];

// quantity > minStockLevel  → in stock (healthy)
// quantity > 0 && quantity <= minStockLevel → low stock (triggers alert)
// quantity === 0 → out of stock
//
// Items are interleaved across 8 categories (round-robin) so the UI renders
// a natural mix rather than clustering all Electrical rows first, then Plumbing, etc.
type SeedItem = {
  category: InventoryCategory;
  name: string;
  serialNumber: string;
  quantity: number;
  minStockLevel: number;
};

const inventoryItems: SeedItem[] = [
  // round 1
  {
    category: "ELECTRICAL",
    name: "LED Ceiling Light (40W)",
    serialNumber: "ELEC-00001",
    quantity: 48,
    minStockLevel: 10,
  },
  {
    category: "PLUMBING",
    name: 'PVC Pipe (2", 10ft)',
    serialNumber: "PLMB-00001",
    quantity: 20,
    minStockLevel: 5,
  },
  {
    category: "HVAC",
    name: "Air Filter (16×20×1, MERV-8)",
    serialNumber: "HVAC-00001",
    quantity: 60,
    minStockLevel: 12,
  },
  {
    category: "TOOLS",
    name: "Utility Knife Blades (pack of 10)",
    serialNumber: "TOOL-00001",
    quantity: 40,
    minStockLevel: 10,
  },
  {
    category: "FASTENERS",
    name: 'Wood Screw #8 × 1-1/2" (box of 100)',
    serialNumber: "FAST-00001",
    quantity: 20,
    minStockLevel: 5,
  },
  {
    category: "CHEMICALS",
    name: "All-Purpose Cleaner (1-gallon)",
    serialNumber: "CHEM-00001",
    quantity: 12,
    minStockLevel: 4,
  },
  {
    category: "SAFETY",
    name: "Fire Extinguisher ABC (5lb)",
    serialNumber: "SAFE-00001",
    quantity: 8,
    minStockLevel: 4,
  },
  {
    category: "BUILDING_MATERIALS",
    name: 'Drywall Sheet (4×8, 1/2")',
    serialNumber: "BLDG-00001",
    quantity: 25,
    minStockLevel: 5,
  },
  // round 2
  {
    category: "ELECTRICAL",
    name: "LED Fluorescent Tube (4ft)",
    serialNumber: "ELEC-00002",
    quantity: 120,
    minStockLevel: 20,
  },
  {
    category: "PLUMBING",
    name: 'PVC Elbow (2", 90°)',
    serialNumber: "PLMB-00002",
    quantity: 45,
    minStockLevel: 10,
  },
  {
    category: "HVAC",
    name: "Air Filter (20×25×1, MERV-8)",
    serialNumber: "HVAC-00002",
    quantity: 40,
    minStockLevel: 12,
  },
  {
    category: "TOOLS",
    name: "HSS Drill Bit Set (29-piece)",
    serialNumber: "TOOL-00002",
    quantity: 5,
    minStockLevel: 2,
  },
  {
    category: "FASTENERS",
    name: 'Wood Screw #8 × 2-1/2" (box of 100)',
    serialNumber: "FAST-00002",
    quantity: 15,
    minStockLevel: 5,
  },
  {
    category: "CHEMICALS",
    name: "Disinfectant Spray (32oz)",
    serialNumber: "CHEM-00002",
    quantity: 24,
    minStockLevel: 6,
  },
  {
    category: "SAFETY",
    name: "First Aid Kit (50-piece)",
    serialNumber: "SAFE-00002",
    quantity: 2,
    minStockLevel: 3,
  }, // low stock
  {
    category: "BUILDING_MATERIALS",
    name: "Joint Compound (1-gallon)",
    serialNumber: "BLDG-00002",
    quantity: 8,
    minStockLevel: 3,
  },
  // round 3
  {
    category: "ELECTRICAL",
    name: "Circuit Breaker (20A)",
    serialNumber: "ELEC-00003",
    quantity: 4,
    minStockLevel: 5,
  }, // low stock
  {
    category: "PLUMBING",
    name: 'PVC Coupling (2")',
    serialNumber: "PLMB-00003",
    quantity: 30,
    minStockLevel: 10,
  },
  {
    category: "HVAC",
    name: "Air Filter (12×12×1, MERV-8)",
    serialNumber: "HVAC-00003",
    quantity: 24,
    minStockLevel: 8,
  },
  {
    category: "TOOLS",
    name: "Safety Glasses (clear lens)",
    serialNumber: "TOOL-00003",
    quantity: 20,
    minStockLevel: 8,
  },
  {
    category: "FASTENERS",
    name: 'Drywall Screw 6 × 1-5/8" (box of 100)',
    serialNumber: "FAST-00003",
    quantity: 18,
    minStockLevel: 5,
  },
  {
    category: "CHEMICALS",
    name: "Degreaser (1-gallon)",
    serialNumber: "CHEM-00003",
    quantity: 6,
    minStockLevel: 3,
  },
  {
    category: "SAFETY",
    name: "Hard Hat (white, Type I)",
    serialNumber: "SAFE-00003",
    quantity: 10,
    minStockLevel: 4,
  },
  {
    category: "BUILDING_MATERIALS",
    name: "Interior Paint Flat White (1-gallon)",
    serialNumber: "BLDG-00003",
    quantity: 10,
    minStockLevel: 4,
  },
  // round 4
  {
    category: "ELECTRICAL",
    name: "Extension Cord (25ft, 12AWG)",
    serialNumber: "ELEC-00004",
    quantity: 8,
    minStockLevel: 4,
  },
  {
    category: "PLUMBING",
    name: "Pipe Thread Tape (roll)",
    serialNumber: "PLMB-00004",
    quantity: 25,
    minStockLevel: 8,
  },
  {
    category: "HVAC",
    name: "Thermostat Battery Pack (4-cell)",
    serialNumber: "HVAC-00004",
    quantity: 0,
    minStockLevel: 6,
  }, // out of stock
  {
    category: "TOOLS",
    name: "Work Gloves (leather palm, L)",
    serialNumber: "TOOL-00004",
    quantity: 15,
    minStockLevel: 6,
  },
  {
    category: "FASTENERS",
    name: 'Hex Bolt 1/4-20 × 1" (box of 50)',
    serialNumber: "FAST-00004",
    quantity: 12,
    minStockLevel: 4,
  },
  {
    category: "CHEMICALS",
    name: "Drain Cleaner (32oz)",
    serialNumber: "CHEM-00004",
    quantity: 8,
    minStockLevel: 3,
  },
  {
    category: "SAFETY",
    name: "High-Vis Safety Vest (L)",
    serialNumber: "SAFE-00004",
    quantity: 12,
    minStockLevel: 4,
  },
  {
    category: "BUILDING_MATERIALS",
    name: 'Paint Roller Cover 9" 3/8" Nap (pack of 4)',
    serialNumber: "BLDG-00004",
    quantity: 12,
    minStockLevel: 4,
  },
  // round 5
  {
    category: "ELECTRICAL",
    name: "Power Strip (6-outlet)",
    serialNumber: "ELEC-00005",
    quantity: 14,
    minStockLevel: 5,
  },
  {
    category: "PLUMBING",
    name: 'Ball Valve (3/4")',
    serialNumber: "PLMB-00005",
    quantity: 8,
    minStockLevel: 3,
  },
  {
    category: "HVAC",
    name: "HVAC Drive Belt (A33)",
    serialNumber: "HVAC-00005",
    quantity: 4,
    minStockLevel: 3,
  },
  {
    category: "TOOLS",
    name: "Work Gloves (leather palm, XL)",
    serialNumber: "TOOL-00005",
    quantity: 6,
    minStockLevel: 6,
  }, // low stock
  {
    category: "FASTENERS",
    name: "Hex Nut 1/4-20 (box of 100)",
    serialNumber: "FAST-00005",
    quantity: 0,
    minStockLevel: 4,
  }, // out of stock
  {
    category: "CHEMICALS",
    name: "Penetrating Lubricant WD-40 (12oz)",
    serialNumber: "CHEM-00005",
    quantity: 10,
    minStockLevel: 4,
  },
  {
    category: "SAFETY",
    name: "High-Vis Safety Vest (XL)",
    serialNumber: "SAFE-00005",
    quantity: 3,
    minStockLevel: 4,
  }, // low stock
  {
    category: "BUILDING_MATERIALS",
    name: "Painter's Tape 1\" (roll)",
    serialNumber: "BLDG-00005",
    quantity: 18,
    minStockLevel: 6,
  },
  // round 6
  {
    category: "ELECTRICAL",
    name: "Electrical Tape (roll)",
    serialNumber: "ELEC-00006",
    quantity: 35,
    minStockLevel: 10,
  },
  {
    category: "PLUMBING",
    name: "Faucet Cartridge (standard)",
    serialNumber: "PLMB-00006",
    quantity: 0,
    minStockLevel: 3,
  }, // out of stock
  {
    category: "HVAC",
    name: "HVAC Drive Belt (A42)",
    serialNumber: "HVAC-00006",
    quantity: 2,
    minStockLevel: 3,
  }, // low stock
  {
    category: "TOOLS",
    name: "Measuring Tape (25ft)",
    serialNumber: "TOOL-00006",
    quantity: 8,
    minStockLevel: 3,
  },
  {
    category: "FASTENERS",
    name: 'Flat Washer 1/4" (box of 100)',
    serialNumber: "FAST-00006",
    quantity: 10,
    minStockLevel: 4,
  },
  {
    category: "CHEMICALS",
    name: "Penetrating Oil PB Blaster (11oz)",
    serialNumber: "CHEM-00006",
    quantity: 5,
    minStockLevel: 3,
  },
  {
    category: "SAFETY",
    name: "Disposable Earplugs (pack of 50)",
    serialNumber: "SAFE-00006",
    quantity: 20,
    minStockLevel: 6,
  },
  {
    category: "BUILDING_MATERIALS",
    name: "Sandpaper 80-grit (pack of 20)",
    serialNumber: "BLDG-00006",
    quantity: 3,
    minStockLevel: 4,
  }, // low stock
  // round 7
  {
    category: "ELECTRICAL",
    name: "Wire Nuts (pack of 50)",
    serialNumber: "ELEC-00007",
    quantity: 22,
    minStockLevel: 8,
  },
  {
    category: "PLUMBING",
    name: 'Drain Strainer (4")',
    serialNumber: "PLMB-00007",
    quantity: 12,
    minStockLevel: 5,
  },
  {
    category: "HVAC",
    name: "Condensate Pan Tablets (pack of 6)",
    serialNumber: "HVAC-00007",
    quantity: 18,
    minStockLevel: 6,
  },
  {
    category: "TOOLS",
    name: "Digital Multimeter",
    serialNumber: "TOOL-00007",
    quantity: 3,
    minStockLevel: 1,
  },
  {
    category: "FASTENERS",
    name: 'Lock Washer 1/4" (box of 100)',
    serialNumber: "FAST-00007",
    quantity: 6,
    minStockLevel: 4,
  },
  {
    category: "CHEMICALS",
    name: "Threadlocker Loctite 243 (6ml)",
    serialNumber: "CHEM-00007",
    quantity: 1,
    minStockLevel: 2,
  }, // low stock
  {
    category: "SAFETY",
    name: "N95 Dust Mask (pack of 10)",
    serialNumber: "SAFE-00007",
    quantity: 8,
    minStockLevel: 4,
  },
  {
    category: "BUILDING_MATERIALS",
    name: "Wood Putty (3.7oz, natural)",
    serialNumber: "BLDG-00007",
    quantity: 0,
    minStockLevel: 3,
  }, // out of stock
  // round 8
  {
    category: "ELECTRICAL",
    name: "GFCI Outlet",
    serialNumber: "ELEC-00008",
    quantity: 6,
    minStockLevel: 8,
  }, // low stock
  {
    category: "PLUMBING",
    name: "Toilet Flapper",
    serialNumber: "PLMB-00008",
    quantity: 10,
    minStockLevel: 4,
  },
  {
    category: "HVAC",
    name: 'Foil Duct Tape (2", silver)',
    serialNumber: "HVAC-00008",
    quantity: 10,
    minStockLevel: 4,
  },
  {
    category: "TOOLS",
    name: "Caulking Gun (standard)",
    serialNumber: "TOOL-00008",
    quantity: 4,
    minStockLevel: 2,
  },
  {
    category: "FASTENERS",
    name: 'Drywall Anchor 3/8" (pack of 25)',
    serialNumber: "FAST-00008",
    quantity: 30,
    minStockLevel: 8,
  },
  {
    category: "CHEMICALS",
    name: "Heavy-Duty Garbage Bags 55-gal (box of 50)",
    serialNumber: "CHEM-00008",
    quantity: 8,
    minStockLevel: 3,
  },
  {
    category: "SAFETY",
    name: 'Safety Cone 28" (traffic)',
    serialNumber: "SAFE-00008",
    quantity: 6,
    minStockLevel: 4,
  },
  {
    category: "BUILDING_MATERIALS",
    name: "Paintable Caulk White (10oz)",
    serialNumber: "BLDG-00008",
    quantity: 14,
    minStockLevel: 5,
  },
  // round 9 — SAFE and BLDG exhausted
  {
    category: "ELECTRICAL",
    name: "Light Switch (standard)",
    serialNumber: "ELEC-00009",
    quantity: 18,
    minStockLevel: 6,
  },
  {
    category: "PLUMBING",
    name: "Plumber's Putty (14oz)",
    serialNumber: "PLMB-00009",
    quantity: 7,
    minStockLevel: 4,
  },
  {
    category: "HVAC",
    name: "Refrigerant R-410A (25lb cylinder)",
    serialNumber: "HVAC-00009",
    quantity: 1,
    minStockLevel: 2,
  }, // low stock
  {
    category: "TOOLS",
    name: 'Pipe Wrench (14")',
    serialNumber: "TOOL-00009",
    quantity: 3,
    minStockLevel: 1,
  },
  {
    category: "FASTENERS",
    name: "Framing Nail 16d (5lb box)",
    serialNumber: "FAST-00009",
    quantity: 4,
    minStockLevel: 2,
  },
  {
    category: "CHEMICALS",
    name: "Microfiber Cleaning Cloth (pack of 12)",
    serialNumber: "CHEM-00009",
    quantity: 0,
    minStockLevel: 3,
  }, // out of stock
  // round 10 — SAFE and BLDG exhausted
  {
    category: "ELECTRICAL",
    name: 'Conduit (10ft, 3/4")',
    serialNumber: "ELEC-00010",
    quantity: 4,
    minStockLevel: 6,
  }, // low stock
  {
    category: "PLUMBING",
    name: "Pipe Insulation (6ft)",
    serialNumber: "PLMB-00010",
    quantity: 15,
    minStockLevel: 8,
  },
  {
    category: "HVAC",
    name: "Run Capacitor (35+5 MFD, 440V)",
    serialNumber: "HVAC-00010",
    quantity: 1,
    minStockLevel: 2,
  }, // low stock
  {
    category: "TOOLS",
    name: 'Spirit Level (24")',
    serialNumber: "TOOL-00010",
    quantity: 2,
    minStockLevel: 1,
  },
  {
    category: "FASTENERS",
    name: 'Toggle Bolt 3/16" × 2" (pack of 10)',
    serialNumber: "FAST-00010",
    quantity: 8,
    minStockLevel: 3,
  },
  {
    category: "CHEMICALS",
    name: "Mop Head (looped-end replacement)",
    serialNumber: "CHEM-00010",
    quantity: 2,
    minStockLevel: 3,
  }, // low stock
  // round 11 — HVAC, TOOL, CHEM, SAFE, BLDG exhausted
  {
    category: "ELECTRICAL",
    name: "Cable Ties (pack of 100)",
    serialNumber: "ELEC-00011",
    quantity: 30,
    minStockLevel: 10,
  },
  {
    category: "PLUMBING",
    name: 'Water Supply Line (12")',
    serialNumber: "PLMB-00011",
    quantity: 3,
    minStockLevel: 5,
  }, // low stock
  {
    category: "FASTENERS",
    name: 'Self-Tapping Screw #8 × 1" (box of 100)',
    serialNumber: "FAST-00011",
    quantity: 0,
    minStockLevel: 5,
  }, // out of stock
  // round 12
  {
    category: "ELECTRICAL",
    name: 'Junction Box (4")',
    serialNumber: "ELEC-00012",
    quantity: 12,
    minStockLevel: 5,
  },
  {
    category: "PLUMBING",
    name: "Silicone Caulk (clear, 10oz)",
    serialNumber: "PLMB-00012",
    quantity: 0,
    minStockLevel: 6,
  }, // out of stock
  {
    category: "FASTENERS",
    name: 'Machine Screw 10-32 × 1" (box of 50)',
    serialNumber: "FAST-00012",
    quantity: 3,
    minStockLevel: 4,
  }, // low stock
  // round 13 — only ELEC remaining
  {
    category: "ELECTRICAL",
    name: "LED Exit Sign",
    serialNumber: "ELEC-00013",
    quantity: 3,
    minStockLevel: 5,
  }, // low stock
  {
    category: "ELECTRICAL",
    name: "Battery (AA, pack of 24)",
    serialNumber: "ELEC-00014",
    quantity: 80,
    minStockLevel: 20,
  },
  {
    category: "ELECTRICAL",
    name: "Battery (9V, pack of 12)",
    serialNumber: "ELEC-00015",
    quantity: 0,
    minStockLevel: 10,
  }, // out of stock
];

// Demo accounts have intentionally public credentials — the UI's "Jump in as" buttons
// log in with these. Password defaults to "Demo@Mainstay1"; override via SEED_DEMO_PASSWORD.
// Admin is the owner only and never gets a demo button.
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "";

type DemoUser = { userName: string; email: string; roles: Role[] };

const demoUsers: DemoUser[] = [
  // Technicians (16)
  { userName: "sarah_chen", email: "sarah.chen@example.com", roles: [Role.TECHNICIAN] },
  { userName: "mike_rodriguez", email: "mike.rodriguez@example.com", roles: [Role.TECHNICIAN] },
  { userName: "aisha_johnson", email: "aisha.johnson@example.com", roles: [Role.TECHNICIAN] },
  { userName: "carlos_martinez", email: "carlos.martinez@example.com", roles: [Role.TECHNICIAN] },
  { userName: "james_wilson", email: "james.wilson@example.com", roles: [Role.TECHNICIAN] },
  { userName: "fatima_hassan", email: "fatima.hassan@example.com", roles: [Role.TECHNICIAN] },
  { userName: "david_kim", email: "david.kim@example.com", roles: [Role.TECHNICIAN] },
  { userName: "elena_petrov", email: "elena.petrov@example.com", roles: [Role.TECHNICIAN] },
  { userName: "omar_ndiaye", email: "omar.ndiaye@example.com", roles: [Role.TECHNICIAN] },
  { userName: "lisa_thompson", email: "lisa.thompson@example.com", roles: [Role.TECHNICIAN] },
  { userName: "raj_patel", email: "raj.patel@example.com", roles: [Role.TECHNICIAN] },
  { userName: "anna_kowalski", email: "anna.kowalski@example.com", roles: [Role.TECHNICIAN] },
  { userName: "tom_obrien", email: "tom.obrien@example.com", roles: [Role.TECHNICIAN] },
  { userName: "yuki_tanaka", email: "yuki.tanaka@example.com", roles: [Role.TECHNICIAN] },
  { userName: "ben_okafor", email: "ben.okafor@example.com", roles: [Role.TECHNICIAN] },
  { userName: "sofia_gomez", email: "sofia.gomez@example.com", roles: [Role.TECHNICIAN] },
  { userName: "kwame_asante", email: "kwame.asante@example.com", roles: [Role.TECHNICIAN] },
  { userName: "nina_volkov", email: "nina.volkov@example.com", roles: [Role.TECHNICIAN] },
  { userName: "luis_reyes", email: "luis.reyes@example.com", roles: [Role.TECHNICIAN] },
  { userName: "mei_zhang", email: "mei.zhang@example.com", roles: [Role.TECHNICIAN] },
  { userName: "samuel_adeyemi", email: "samuel.adeyemi@example.com", roles: [Role.TECHNICIAN] },
  { userName: "kate_brennan", email: "kate.brennan@example.com", roles: [Role.TECHNICIAN] },
  { userName: "ivan_sokolov", email: "ivan.sokolov@example.com", roles: [Role.TECHNICIAN] },
  { userName: "amara_diallo", email: "amara.diallo@example.com", roles: [Role.TECHNICIAN] },
  { userName: "joe_nakamura", email: "joe.nakamura@example.com", roles: [Role.TECHNICIAN] },
  { userName: "petra_horvatova", email: "petra.horvatova@example.com", roles: [Role.TECHNICIAN] },
  { userName: "marco_esposito", email: "marco.esposito@example.com", roles: [Role.TECHNICIAN] },
  { userName: "layla_al_rashid", email: "layla.al-rashid@example.com", roles: [Role.TECHNICIAN] },
  { userName: "ethan_brooks", email: "ethan.brooks@example.com", roles: [Role.TECHNICIAN] },
  { userName: "zoe_konstantinou", email: "zoe.konstantinou@example.com", roles: [Role.TECHNICIAN] },
  // Managers (4)
  { userName: "priya_sharma", email: "priya.sharma@example.com", roles: [Role.MANAGER] },
  { userName: "dan_foster", email: "dan.foster@example.com", roles: [Role.MANAGER] },
  { userName: "grace_mensah", email: "grace.mensah@example.com", roles: [Role.MANAGER] },
  { userName: "alex_novak", email: "alex.novak@example.com", roles: [Role.MANAGER] },
];

type SeedAsset = {
  name: string;
  serialNumber: string;
  category: AssetCategory;
  location: string;
  status: AssetStatus;
  manufacturer?: string;
  model?: string;
  installDate?: Date;
};

// A small fleet of real-world equipment spread across buildings, categories,
// and statuses — enough to exercise the list filters, the stats breakdown,
// and the per-asset maintenance history.
const assets: SeedAsset[] = [
  {
    name: "Rooftop HVAC Unit #1",
    serialNumber: "HVAC-RTU-001",
    category: "HVAC",
    location: "Building A — Roof",
    status: "OPERATIONAL",
    manufacturer: "Carrier",
    model: "48TCED12",
    installDate: new Date("2019-05-12"),
  },
  {
    name: "Rooftop HVAC Unit #2",
    serialNumber: "HVAC-RTU-002",
    category: "HVAC",
    location: "Building A — Roof",
    status: "DOWN",
    manufacturer: "Carrier",
    model: "48TCED12",
    installDate: new Date("2019-05-12"),
  },
  {
    name: "Boiler — East Wing",
    serialNumber: "HVAC-BLR-001",
    category: "HVAC",
    location: "Building B — Basement Mechanical Room",
    status: "OPERATIONAL",
    manufacturer: "Weil-McLain",
    model: "SGO-5",
    installDate: new Date("2016-11-03"),
  },
  {
    name: "Domestic Water Booster Pump",
    serialNumber: "PUMP-DWB-001",
    category: "PLUMBING",
    location: "Building B — Basement Mechanical Room",
    status: "OPERATIONAL",
    manufacturer: "Grundfos",
    model: "CR 10-6",
    installDate: new Date("2020-02-20"),
  },
  {
    name: "Sump Pump — Parking Level",
    serialNumber: "PUMP-SMP-002",
    category: "PLUMBING",
    location: "Building A — Parking Level P2",
    status: "DOWN",
    manufacturer: "Zoeller",
    model: "M267",
    installDate: new Date("2018-07-14"),
  },
  {
    name: "Main Distribution Panel",
    serialNumber: "ELEC-MDP-001",
    category: "ELECTRICAL",
    location: "Building A — Electrical Room 1",
    status: "OPERATIONAL",
    manufacturer: "Square D",
    model: "QED-2",
    installDate: new Date("2015-09-01"),
  },
  {
    name: "Standby Diesel Generator",
    serialNumber: "ELEC-GEN-001",
    category: "ELECTRICAL",
    location: "Building A — Exterior Enclosure",
    status: "OPERATIONAL",
    manufacturer: "Generac",
    model: "SD100",
    installDate: new Date("2017-03-28"),
  },
  {
    name: "Passenger Elevator — Car 1",
    serialNumber: "MECH-ELV-001",
    category: "MECHANICAL",
    location: "Building A — Core",
    status: "OPERATIONAL",
    manufacturer: "Otis",
    model: "Gen2",
    installDate: new Date("2014-06-10"),
  },
  {
    name: "Loading Dock Leveler",
    serialNumber: "MECH-DCK-001",
    category: "MECHANICAL",
    location: "Building B — Loading Dock",
    status: "RETIRED",
    manufacturer: "Rite-Hite",
    model: "RHH-4000",
    installDate: new Date("2008-04-22"),
  },
  {
    name: "Forklift — Warehouse",
    serialNumber: "VEH-FRK-001",
    category: "VEHICLE",
    location: "Building B — Warehouse",
    status: "OPERATIONAL",
    manufacturer: "Toyota",
    model: "8FGCU25",
    installDate: new Date("2021-01-18"),
  },
  {
    name: "Facilities Pickup Truck",
    serialNumber: "VEH-TRK-002",
    category: "VEHICLE",
    location: "Site — Motor Pool",
    status: "OPERATIONAL",
    manufacturer: "Ford",
    model: "F-250",
    installDate: new Date("2022-08-05"),
  },
  {
    name: "Server Room CRAC Unit",
    serialNumber: "IT-CRAC-001",
    category: "IT_EQUIPMENT",
    location: "Building A — Data Center",
    status: "OPERATIONAL",
    manufacturer: "Liebert",
    model: "CRV CR035RA",
    installDate: new Date("2020-10-30"),
  },
  {
    name: "Core Network UPS",
    serialNumber: "IT-UPS-001",
    category: "IT_EQUIPMENT",
    location: "Building A — Data Center",
    status: "DOWN",
    manufacturer: "APC",
    model: "Smart-UPS SRT 10kVA",
    installDate: new Date("2019-12-15"),
  },
  {
    name: "Fire Alarm Control Panel",
    serialNumber: "SAFE-FACP-001",
    category: "SAFETY_SYSTEM",
    location: "Building A — Lobby",
    status: "OPERATIONAL",
    manufacturer: "Notifier",
    model: "NFS2-3030",
    installDate: new Date("2018-02-11"),
  },
  {
    name: "Wet Sprinkler Riser — Building B",
    serialNumber: "SAFE-SPR-002",
    category: "SAFETY_SYSTEM",
    location: "Building B — Riser Room",
    status: "OPERATIONAL",
    manufacturer: "Viking",
    model: "VK-300",
    installDate: new Date("2016-08-19"),
  },
  {
    name: "Overhead Sectional Door — Bay 3",
    serialNumber: "BLDG-DOOR-003",
    category: "BUILDING",
    location: "Building B — Loading Dock",
    status: "OPERATIONAL",
    manufacturer: "Overhead Door",
    model: "Model 470",
    installDate: new Date("2017-05-06"),
  },
];

// The maintenance layer — tasks recorded against seeded assets, some drawing
// the parts that would realistically be consumed (HVAC filters/belts on the
// rooftop units, a breaker on the panel, etc.). This is what ties assets,
// tasks, and inventory together into one coherent history rather than three
// unrelated lists. Parts reference inventory by serial; assets by serial.
//
// Story built into the data:
//   • DOWN assets each have a recent OPEN/IN_PROGRESS repair — the reason
//     they're down.
//   • OPERATIONAL assets have completed preventive-maintenance history plus
//     upcoming scheduled work; a few are overdue.
//   • The RETIRED dock leveler has only old, closed history.
type SeedTaskPart = { inventorySerial: string; quantity: number };

type SeedTask = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: InventoryCategory;
  assetSerial: string;
  // Round-robin index into the seeded technicians (resolved at seed time).
  assigneeIndex: number;
  // Days from "now": negative = past (overdue if not DONE), positive = upcoming.
  dueOffsetDays: number;
  parts?: SeedTaskPart[];
};

const maintenanceTasks: SeedTask[] = [
  // — DOWN assets: active repairs that explain the outage ——————————————————
  {
    title: "Compressor fault — rooftop unit not cooling",
    description: "Unit tripping on high-pressure fault. Replacing run capacitor and retesting.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    category: "HVAC",
    assetSerial: "HVAC-RTU-002",
    assigneeIndex: 0,
    dueOffsetDays: -1,
    parts: [{ inventorySerial: "HVAC-00010", quantity: 1 }],
  },
  {
    title: "Sump pump not activating on float switch",
    description: "Parking-level sump not keeping up. Float switch suspected — inspect and replace.",
    status: "OPEN",
    priority: "HIGH",
    category: "PLUMBING",
    assetSerial: "PUMP-SMP-002",
    assigneeIndex: 1,
    dueOffsetDays: -2,
  },
  {
    title: "UPS battery module failure alarm",
    description: "Core network UPS reporting battery module fault. Awaiting replacement modules.",
    status: "IN_PROGRESS",
    priority: "HIGH",
    category: "ELECTRICAL",
    assetSerial: "IT-UPS-001",
    assigneeIndex: 2,
    dueOffsetDays: 1,
  },

  // — Rooftop HVAC Unit #1: healthy unit with PM history ————————————————————
  {
    title: "Quarterly filter replacement",
    description: "Replaced return-air filters and dosed condensate pan.",
    status: "DONE",
    priority: "MEDIUM",
    category: "HVAC",
    assetSerial: "HVAC-RTU-001",
    assigneeIndex: 3,
    dueOffsetDays: -28,
    parts: [
      { inventorySerial: "HVAC-00002", quantity: 2 },
      { inventorySerial: "HVAC-00007", quantity: 1 },
    ],
  },
  {
    title: "Replace worn drive belt",
    description: "Supply-fan belt showing cracks. Replaced with A33.",
    status: "DONE",
    priority: "MEDIUM",
    category: "HVAC",
    assetSerial: "HVAC-RTU-001",
    assigneeIndex: 4,
    dueOffsetDays: -60,
    parts: [{ inventorySerial: "HVAC-00005", quantity: 1 }],
  },
  {
    title: "Annual refrigerant charge check",
    description: "Scheduled check of R-410A charge and superheat.",
    status: "OPEN",
    priority: "LOW",
    category: "HVAC",
    assetSerial: "HVAC-RTU-001",
    assigneeIndex: 5,
    dueOffsetDays: 14,
  },

  // — Boiler ————————————————————————————————————————————————————————————————
  {
    title: "Annual boiler inspection and flush",
    description: "Full inspection, low-water cutoff test, and system flush.",
    status: "DONE",
    priority: "HIGH",
    category: "HVAC",
    assetSerial: "HVAC-BLR-001",
    assigneeIndex: 6,
    dueOffsetDays: -20,
  },
  {
    title: "Replace pressure-relief valve",
    description: "PRV weeping at rated pressure. Scheduled replacement.",
    status: "OPEN",
    priority: "MEDIUM",
    category: "PLUMBING",
    assetSerial: "HVAC-BLR-001",
    assigneeIndex: 7,
    dueOffsetDays: 7,
  },

  // — Domestic Water Booster Pump ——————————————————————————————————————————
  {
    title: "Replace faucet cartridge on test loop",
    description: "Test-loop faucet dripping. Cartridge swapped.",
    status: "DONE",
    priority: "LOW",
    category: "PLUMBING",
    assetSerial: "PUMP-DWB-001",
    assigneeIndex: 0,
    dueOffsetDays: -45,
    parts: [{ inventorySerial: "PLMB-00006", quantity: 1 }],
  },
  {
    title: "Inspect pump mechanical seals",
    description: "Routine seal inspection for weeping or wear.",
    status: "OPEN",
    priority: "MEDIUM",
    category: "PLUMBING",
    assetSerial: "PUMP-DWB-001",
    assigneeIndex: 1,
    dueOffsetDays: 10,
  },

  // — Main Distribution Panel ——————————————————————————————————————————————
  {
    title: "Thermal scan of distribution panel",
    description: "Infrared scan of all breakers and lugs under load. No hotspots found.",
    status: "DONE",
    priority: "MEDIUM",
    category: "ELECTRICAL",
    assetSerial: "ELEC-MDP-001",
    assigneeIndex: 2,
    dueOffsetDays: -25,
  },
  {
    title: "Replace 20A breaker on circuit 14",
    description: "Breaker on circuit 14 nuisance-tripping. Replaced and re-terminated.",
    status: "DONE",
    priority: "HIGH",
    category: "ELECTRICAL",
    assetSerial: "ELEC-MDP-001",
    assigneeIndex: 3,
    dueOffsetDays: -12,
    parts: [
      { inventorySerial: "ELEC-00003", quantity: 1 },
      { inventorySerial: "ELEC-00007", quantity: 1 },
    ],
  },

  // — Standby Generator ————————————————————————————————————————————————————
  {
    title: "Monthly generator load test",
    description: "30-minute load-bank test. Voltage and frequency within spec.",
    status: "DONE",
    priority: "MEDIUM",
    category: "ELECTRICAL",
    assetSerial: "ELEC-GEN-001",
    assigneeIndex: 4,
    dueOffsetDays: -8,
  },
  {
    title: "Replace starting batteries",
    description: "Starting batteries at end of service life. Scheduled replacement.",
    status: "OPEN",
    priority: "MEDIUM",
    category: "ELECTRICAL",
    assetSerial: "ELEC-GEN-001",
    assigneeIndex: 5,
    dueOffsetDays: 5,
  },

  // — Passenger Elevator ———————————————————————————————————————————————————
  {
    title: "Annual elevator safety inspection",
    description: "Third-party safety inspection and certification.",
    status: "DONE",
    priority: "HIGH",
    category: "SAFETY",
    assetSerial: "MECH-ELV-001",
    assigneeIndex: 6,
    dueOffsetDays: -15,
  },
  {
    title: "Lubricate guide rails",
    description: "Routine guide-rail lubrication and roller inspection.",
    status: "OPEN",
    priority: "LOW",
    category: "TOOLS",
    assetSerial: "MECH-ELV-001",
    assigneeIndex: 7,
    dueOffsetDays: 21,
  },

  // — Vehicles —————————————————————————————————————————————————————————————
  {
    title: "250-hour forklift service",
    description: "Oil, hydraulic filter, and mast chain inspection.",
    status: "DONE",
    priority: "MEDIUM",
    category: "TOOLS",
    assetSerial: "VEH-FRK-001",
    assigneeIndex: 0,
    dueOffsetDays: -18,
  },
  {
    title: "Hydraulic leak inspection",
    description: "Small drip reported under mast. Inspect and trace source.",
    status: "OPEN",
    priority: "MEDIUM",
    category: "TOOLS",
    assetSerial: "VEH-FRK-001",
    assigneeIndex: 1,
    dueOffsetDays: 3,
  },
  {
    title: "Oil change and tire rotation",
    description: "Routine service for facilities pickup.",
    status: "DONE",
    priority: "LOW",
    category: "TOOLS",
    assetSerial: "VEH-TRK-002",
    assigneeIndex: 2,
    dueOffsetDays: -22,
  },

  // — Data-center cooling ——————————————————————————————————————————————————
  {
    title: "Replace CRAC air filters",
    description: "Replaced pre-filters on server-room CRAC unit.",
    status: "DONE",
    priority: "MEDIUM",
    category: "HVAC",
    assetSerial: "IT-CRAC-001",
    assigneeIndex: 3,
    dueOffsetDays: -10,
    parts: [{ inventorySerial: "HVAC-00003", quantity: 2 }],
  },
  {
    title: "Check CRAC refrigerant charge",
    description: "Scheduled refrigerant and superheat check.",
    status: "OPEN",
    priority: "LOW",
    category: "HVAC",
    assetSerial: "IT-CRAC-001",
    assigneeIndex: 4,
    dueOffsetDays: 30,
  },

  // — Life-safety systems ——————————————————————————————————————————————————
  {
    title: "Monthly fire-alarm panel test",
    description: "Tested notification circuits and battery backup. All zones reporting.",
    status: "DONE",
    priority: "HIGH",
    category: "SAFETY",
    assetSerial: "SAFE-FACP-001",
    assigneeIndex: 5,
    dueOffsetDays: -5,
  },
  {
    title: "Annual sprinkler flow test",
    description: "Main-drain and flow-switch test on Building B riser.",
    status: "OPEN",
    priority: "HIGH",
    category: "SAFETY",
    assetSerial: "SAFE-SPR-002",
    assigneeIndex: 6,
    dueOffsetDays: -3,
  },

  // — Building envelope ————————————————————————————————————————————————————
  {
    title: "Adjust dock-door tension spring",
    description: "Bay 3 sectional door slow to rise. Adjusted spring tension.",
    status: "DONE",
    priority: "LOW",
    category: "BUILDING_MATERIALS",
    assetSerial: "BLDG-DOOR-003",
    assigneeIndex: 7,
    dueOffsetDays: -14,
  },

  // — Retired asset: closed historical record only —————————————————————————
  {
    title: "Decommission inspection — dock leveler",
    description: "Final inspection and lockout prior to retirement.",
    status: "DONE",
    priority: "LOW",
    category: "SAFETY",
    assetSerial: "MECH-DCK-001",
    assigneeIndex: 0,
    dueOffsetDays: -90,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const seed = async (): Promise<void> => {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("❌ SEED_ADMIN_PASSWORD env var is required");

    process.exit(1);
  }

  const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: { password: hashedAdminPassword },
    create: {
      userName: "admin",
      email: "admin@example.com",
      password: hashedAdminPassword,
      roles: [Role.ADMIN],
    },
  });

  console.log("✅ Seeded admin user:", admin.email);

  const hashedDemoPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { password: hashedDemoPassword },
      create: { ...demoUser, password: hashedDemoPassword },
    });

    console.log(`✅ Seeded demo user: ${user.email} (${user.roles.join(", ")})`);
  }

  const { count } = await prisma.inventoryItem.createMany({
    data: inventoryItems,
    skipDuplicates: true, // re-runs won't overwrite live quantity changes
  });

  console.log(
    `✅ Seeded inventory: ${count} new items added (${inventoryItems.length - count} already existed)`,
  );

  const { count: assetCount } = await prisma.asset.createMany({
    data: assets,
    skipDuplicates: true, // re-runs won't overwrite live status changes
  });

  console.log(
    `✅ Seeded assets: ${assetCount} new assets added (${assets.length - assetCount} already existed)`,
  );

  for (const template of checklistTemplates) {
    await prisma.checklistTemplate.upsert({
      where: { category: template.category },
      update: { items: template.items },
      create: template,
    });
  }

  console.log(`✅ Seeded checklist templates: ${checklistTemplates.length} categories`);

  // — Maintenance layer: tasks linking assets → work → parts consumed ————————
  // Guarded so re-runs don't stack duplicate history (tasks have no natural
  // unique key to dedupe on the way inventory/assets do via serialNumber).
  const existingTaskCount = await prisma.task.count();

  if (existingTaskCount > 0) {
    console.log(`ℹ️  Skipped maintenance tasks: ${existingTaskCount} task(s) already exist`);
  } else {
    // Resolve serials → ids for the FK links.
    const assetRows = await prisma.asset.findMany({ select: { id: true, serialNumber: true } });
    const assetIdBySerial = new Map(assetRows.map((a) => [a.serialNumber, a.id]));

    const inventoryRows = await prisma.inventoryItem.findMany({
      select: { id: true, serialNumber: true },
    });
    const inventoryIdBySerial = new Map(inventoryRows.map((i) => [i.serialNumber, i.id]));

    // Round-robin assignees from the seeded technicians.
    const technicians = await prisma.user.findMany({
      where: { roles: { has: Role.TECHNICIAN } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const now = Date.now();
    let createdTasks = 0;
    let createdParts = 0;

    for (const [index, task] of maintenanceTasks.entries()) {
      const assetId = assetIdBySerial.get(task.assetSerial);

      if (!assetId) {
        console.warn(`⚠️  Skipping task "${task.title}" — asset ${task.assetSerial} not found`);
        continue;
      }

      const assignedTo = technicians.length
        ? technicians[task.assigneeIndex % technicians.length].id
        : null;

      const parts = (task.parts ?? [])
        .map((part) => ({
          inventoryItemId: inventoryIdBySerial.get(part.inventorySerial),
          quantity: part.quantity,
        }))
        .filter((part): part is { inventoryItemId: string; quantity: number } =>
          Boolean(part.inventoryItemId),
        );

      // DONE tasks carry before/after photos so the completed state looks real
      // in the UI. The URLs are placeholders — the demo doesn't serve the files.
      const isDone = task.status === "DONE";
      const photoBase = `https://demo.storage.local/task-photos/${task.assetSerial}`;

      const dueDate = new Date(now + task.dueOffsetDays * DAY_MS);

      // Backdate createdAt so completed work has a realistic, positive cycle
      // time and the throughput report spreads across weeks instead of piling
      // onto seed day. DONE tasks: created a handful of days before due and
      // completed on the due date (cycle time 5–10 days, varied by index).
      // Everything else: created recently.
      const cycleDays = 5 + (index % 6);
      const createdAt = isDone
        ? new Date(now + (task.dueOffsetDays - cycleDays) * DAY_MS)
        : new Date(now - (2 + (index % 5)) * DAY_MS);
      const completedAt = isDone ? dueDate : null;

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category,
          assignedTo,
          assetId,
          dueDate,
          createdAt,
          completedAt,
          beforePhotoUrl: isDone ? `${photoBase}-before.jpg` : null,
          afterPhotoUrl: isDone ? `${photoBase}-after.jpg` : null,
          ...(parts.length && { partsUsed: { create: parts } }),
        },
      });

      createdTasks += 1;
      createdParts += parts.length;
    }

    console.log(
      `✅ Seeded maintenance: ${createdTasks} tasks across ${assetRows.length} assets, ${createdParts} part-usage records`,
    );
  }
};

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
