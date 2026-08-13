import { z } from "zod";

// ============================================================================
// Garage Door Visualizer — Shared Contracts
// ============================================================================

export const ManufacturerSchema = z.enum([
  "chi",
  "haas",
  "amarr",
  "wayne-dalton",
  "clopay",
]);
export type Manufacturer = z.infer<typeof ManufacturerSchema>;

export const ColorOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  hex: z.string(),
});
export type ColorOption = z.infer<typeof ColorOptionSchema>;

export const WindowOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type WindowOption = z.infer<typeof WindowOptionSchema>;

export const GarageStyleSchema = z.object({
  id: z.string(),
  manufacturer: ManufacturerSchema,
  name: z.string(),
  series: z.string(),
  tagline: z.string(),
  category: z.enum(["modern", "carriage", "traditional", "contemporary"]),
  prompt: z.string(),
  catalogUrl: z.string(),
  swatch: z.object({
    panel: z.string(),
    trim: z.string(),
    accent: z.string(),
  }),
  colors: z.array(ColorOptionSchema),
  windowOptions: z.array(WindowOptionSchema),
});
export type GarageStyle = z.infer<typeof GarageStyleSchema>;

export const ManufacturerInfoSchema = z.object({
  id: ManufacturerSchema,
  name: z.string(),
  tagline: z.string(),
  origin: z.string(),
});
export type ManufacturerInfo = z.infer<typeof ManufacturerInfoSchema>;

export const DoorSizeSchema = z.object({
  widthClass: z.enum(["single", "double"]),
  heightClass: z.enum(["standard", "tall"]),
});
export type DoorSize = z.infer<typeof DoorSizeSchema>;

export const SwapResultSchema = z.object({
  imageBase64: z.string(),
  styleId: z.string(),
  generatedAt: z.string(),
  doorCenterXPct: z.number().optional(),
  detectedDoorSize: DoorSizeSchema.optional(),
});
export type SwapResult = z.infer<typeof SwapResultSchema>;

export const CatalogResponseSchema = z.object({
  manufacturers: z.array(ManufacturerInfoSchema),
  styles: z.array(GarageStyleSchema),
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

// ============================================================================
// Catalog
// ============================================================================

export const MANUFACTURERS: ManufacturerInfo[] = [
  { id: "clopay", name: "Clopay", tagline: "America's favorite garage doors", origin: "Troy, Ohio · est. 1964" },
  { id: "chi", name: "C.H.I.", tagline: "Overhead doors built to last", origin: "Arthur, Illinois · est. 1981" },
  { id: "amarr", name: "Amarr", tagline: "Designer doors for every home", origin: "Winston-Salem, NC · est. 1951" },
  { id: "wayne-dalton", name: "Wayne Dalton", tagline: "Beautiful, durable doors since 1954", origin: "Mt. Hope, Ohio · est. 1954" },
  { id: "haas", name: "Haas", tagline: "Family-built doors with character", origin: "Wakarusa, Indiana · est. 1973" },
];

export const STYLES: GarageStyle[] = [
  // ── Clopay ──────────────────────────────────────────────────────────────────
  {
    id: "clopay-avante",
    manufacturer: "clopay",
    name: "Avante",
    series: "Modern Aluminum + Glass",
    tagline: "Architectural full-view with crisp aluminum frame",
    category: "contemporary",
    prompt: "a Clopay Avante full-view garage door with a slim aluminum frame in a clean grid of square glass panels, contemporary minimalist look, premium finish",
    catalogUrl: "https://www.clopaydoor.com/garagedoors/residential/aluminum-and-glass/avante",
    swatch: { panel: "#cfd4d6", trim: "#8a8e90", accent: "#1d1d1f" },
    colors: [
      { id: "black-frame", name: "Black Frame", hex: "#1C1C1C" },
      { id: "dark-bronze-frame", name: "Dark Bronze Frame", hex: "#3E2B18" },
      { id: "silver-frame", name: "Silver/Anodized Frame", hex: "#A8AAAD" },
      { id: "white-frame", name: "White Frame", hex: "#F2F0EB" },
    ],
    windowOptions: [
      { id: "clear-glass", name: "Clear Glass" },
      { id: "frosted-glass", name: "Frosted Glass" },
      { id: "tinted-bronze", name: "Tinted Bronze Glass" },
      { id: "obscure-glass", name: "Obscure Glass" },
    ],
  },
  {
    id: "clopay-modern-steel",
    manufacturer: "clopay",
    name: "Modern Steel",
    series: "Flush Smooth",
    tagline: "Sleek flush panel in matte finish",
    category: "modern",
    prompt: "a Clopay Modern Steel flush smooth garage door, no visible seams between panels, ultra-clean modern aesthetic, premium painted finish",
    catalogUrl: "https://www.clopaydoor.com/garagedoors/residential/flush/modern-steel",
    swatch: { panel: "#22252a", trim: "#101114", accent: "#e9e9e9" },
    colors: [
      { id: "matte-black", name: "Matte Black", hex: "#1C1C1C" },
      { id: "charcoal", name: "Charcoal", hex: "#3A3D42" },
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "dark-bronze", name: "Dark Bronze", hex: "#3E2B18" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "frosted-row", name: "Frosted Glass Row" },
      { id: "clear-row", name: "Clear Glass Row" },
      { id: "square-row", name: "Square Window Row" },
    ],
  },
  {
    id: "clopay-canyon-ridge",
    manufacturer: "clopay",
    name: "Canyon Ridge",
    series: "Faux Wood Carriage",
    tagline: "Composite carriage with rich wood grain",
    category: "carriage",
    prompt: "a Clopay Canyon Ridge faux-wood carriage house garage door with a deep wood-grain composite overlay, cross-buck design, wrought iron decorative hardware",
    catalogUrl: "https://www.clopaydoor.com/garagedoors/residential/ultra-grain-composite/canyon-ridge",
    swatch: { panel: "#5a3a22", trim: "#2f1d10", accent: "#111111" },
    colors: [
      { id: "dark-walnut", name: "Dark Walnut", hex: "#3D2012" },
      { id: "medium-oak", name: "Medium Oak", hex: "#8B5C2A" },
      { id: "golden-oak", name: "Golden Oak", hex: "#B8822E" },
      { id: "white-cedar", name: "White Cedar", hex: "#E8E0D5" },
      { id: "slate", name: "Slate Gray", hex: "#5A5E62" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "square-arch", name: "Square Arch Windows" },
      { id: "cathedral", name: "Cathedral Windows" },
      { id: "ranch", name: "Ranch Windows" },
    ],
  },
  {
    id: "clopay-coachman",
    manufacturer: "clopay",
    name: "Coachman",
    series: "Steel Carriage",
    tagline: "Classic carriage charm, painted steel",
    category: "carriage",
    prompt: "a Clopay Coachman painted steel carriage house garage door, raised carriage panel design, decorative black handles and hinges, traditional look",
    catalogUrl: "https://www.clopaydoor.com/garagedoors/residential/carriage-house-style/coachman",
    swatch: { panel: "#f4f1eb", trim: "#dad6cd", accent: "#1a1a1a" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "almond", name: "Almond", hex: "#E8D9B8" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "medium-bronze", name: "Medium Bronze", hex: "#7A5C3A" },
      { id: "dark-bronze", name: "Dark Bronze", hex: "#3E2B18" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "short-rectangle", name: "Short Rectangle" },
      { id: "arch-top", name: "Arch Top" },
      { id: "ranch-style", name: "Ranch Style" },
    ],
  },

  // ── C.H.I. ──────────────────────────────────────────────────────────────────
  {
    id: "chi-planks-accents",
    manufacturer: "chi",
    name: "Planks",
    series: "Accents Woodtones",
    tagline: "Horizontal plank wood-grain look",
    category: "contemporary",
    prompt: "a CHI Accents Planks garage door with a horizontal wood-grain plank finish, wide plank sections, modern rustic vibe",
    catalogUrl: "https://www.chiohd.com/products/sectional-garage-doors/wood-composite/accents-woodtones",
    swatch: { panel: "#6b3a1d", trim: "#3b1d0d", accent: "#d9c9a8" },
    colors: [
      { id: "mahogany", name: "Mahogany", hex: "#6B2E1A" },
      { id: "golden-oak", name: "Golden Oak", hex: "#B8822E" },
      { id: "walnut", name: "Dark Walnut", hex: "#3D2012" },
      { id: "slate", name: "Slate Gray", hex: "#5A5E62" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "upper-row-rectangle", name: "Upper Row Rectangles" },
      { id: "upper-row-arch", name: "Upper Row Arch" },
    ],
  },
  {
    id: "chi-stamped-carriage",
    manufacturer: "chi",
    name: "Stamped Carriage",
    series: "5983 Series",
    tagline: "Embossed carriage panel, classic styling",
    category: "carriage",
    prompt: "a CHI Stamped Carriage House garage door, embossed steel with carriage X-cross stamping per section, arched window row with decorative grilles",
    catalogUrl: "https://www.chiohd.com/products/sectional-garage-doors/steel-carriage-house",
    swatch: { panel: "#e6d6b8", trim: "#a8966f", accent: "#241a10" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "almond", name: "Almond", hex: "#E8D9B8" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "brown", name: "Brown", hex: "#6B4423" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "arched", name: "Arched Windows" },
      { id: "rectangle", name: "Rectangle Windows" },
      { id: "ranch", name: "Ranch Windows" },
    ],
  },
  {
    id: "chi-recessed-panel",
    manufacturer: "chi",
    name: "Recessed Panel",
    series: "2240 Steel",
    tagline: "Clean recessed long panels, refined look",
    category: "modern",
    prompt: "a CHI 2240 recessed long panel garage door, smooth finish, contemporary refined appearance",
    catalogUrl: "https://www.chiohd.com/products/sectional-garage-doors/steel/2240",
    swatch: { panel: "#3a3d40", trim: "#1f2123", accent: "#cccccc" },
    colors: [
      { id: "graphite", name: "Graphite", hex: "#3A3D42" },
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "brown", name: "Brown", hex: "#6B4423" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "frosted-row", name: "Frosted Glass Row" },
      { id: "clear-row", name: "Clear Glass Row" },
    ],
  },

  // ── Amarr ────────────────────────────────────────────────────────────────────
  {
    id: "amarr-vista",
    manufacturer: "amarr",
    name: "Vista",
    series: "Full-View Aluminum",
    tagline: "Floor-to-ceiling glass, premium modern look",
    category: "contemporary",
    prompt: "an Amarr Vista full-view aluminum garage door with a large clear glass panel grid, premium modern architectural look",
    catalogUrl: "https://www.amarr.com/residential/garage-doors/full-view",
    swatch: { panel: "#dde2e6", trim: "#1a1a1a", accent: "#0a0a0a" },
    colors: [
      { id: "black-frame", name: "Black Frame", hex: "#1C1C1C" },
      { id: "dark-bronze-frame", name: "Dark Bronze Frame", hex: "#3E2B18" },
      { id: "silver-frame", name: "Silver/Anodized Frame", hex: "#A8AAAD" },
    ],
    windowOptions: [
      { id: "clear-glass", name: "Clear Glass" },
      { id: "frosted-glass", name: "Frosted Glass" },
      { id: "tinted-glass", name: "Tinted Bronze Glass" },
    ],
  },
  {
    id: "amarr-classica",
    manufacturer: "amarr",
    name: "Classica",
    series: "Carriage House",
    tagline: "Old-world carriage with arched glass",
    category: "carriage",
    prompt: "an Amarr Classica carriage house garage door, arched top windows with decorative grille inserts, raised carriage panel design, wrought iron strap hinges and handles",
    catalogUrl: "https://www.amarr.com/residential/garage-doors/carriage-house/amarr-classica",
    swatch: { panel: "#d4b88a", trim: "#7a5a30", accent: "#0e0e0e" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "almond", name: "Almond", hex: "#E8D9B8" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "brown", name: "Brown", hex: "#7D5A3C" },
      { id: "chocolate", name: "Chocolate", hex: "#3E2309" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "arched-short", name: "Short Arch Windows" },
      { id: "no-windows", name: "No Windows" },
      { id: "ranch", name: "Ranch Windows" },
      { id: "rectangle", name: "Rectangle Windows" },
    ],
  },
  {
    id: "amarr-hillcrest",
    manufacturer: "amarr",
    name: "Hillcrest",
    series: "Modern Steel",
    tagline: "Modern flush with frosted glass row",
    category: "modern",
    prompt: "an Amarr Hillcrest modern flush steel garage door, single horizontal row of long frosted rectangular glass panels near the top, ultra-clean minimalist design",
    catalogUrl: "https://www.amarr.com/residential/garage-doors/modern",
    swatch: { panel: "#efeae0", trim: "#bdb6a8", accent: "#1e1e1e" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "pebble", name: "Pebble Gray", hex: "#9B9B9B" },
      { id: "charcoal", name: "Charcoal", hex: "#4A4A4A" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "frosted-band", name: "Frosted Glass Band" },
      { id: "no-windows", name: "No Windows" },
      { id: "clear-band", name: "Clear Glass Band" },
      { id: "square-row", name: "Square Window Row" },
    ],
  },
  {
    id: "amarr-lincoln",
    manufacturer: "amarr",
    name: "Lincoln",
    series: "Traditional Steel",
    tagline: "Classic raised long panel, timeless look",
    category: "traditional",
    prompt: "an Amarr Lincoln traditional raised long panel garage door, four horizontal sections",
    catalogUrl: "https://www.amarr.com/residential/garage-doors/residential/amarr-lincoln",
    swatch: { panel: "#f6f4ef", trim: "#cbc6bb", accent: "#26201a" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "almond", name: "Almond", hex: "#E8D9B8" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "brown", name: "Brown", hex: "#7D5A3C" },
      { id: "chocolate", name: "Chocolate", hex: "#3E2309" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "short-rectangle", name: "Short Rectangle" },
      { id: "cathedral", name: "Cathedral" },
      { id: "ranch", name: "Ranch Style" },
      { id: "colonial", name: "Colonial" },
    ],
  },

  // ── Wayne Dalton ─────────────────────────────────────────────────────────────
  {
    id: "wayne-dalton-8800",
    manufacturer: "wayne-dalton",
    name: "Model 8800",
    series: "Luminous Full-View",
    tagline: "Full-view aluminum, glowing modern statement",
    category: "contemporary",
    prompt: "a Wayne Dalton Model 8800 Luminous full-view garage door with an aluminum frame and translucent acrylic panels, glowing modern statement piece",
    catalogUrl: "https://www.waynedalton.com/residential/model/8800",
    swatch: { panel: "#b9a78a", trim: "#3a2f1e", accent: "#0f0a05" },
    colors: [
      { id: "dark-bronze-frame", name: "Dark Bronze Frame", hex: "#3E2B18" },
      { id: "black-frame", name: "Black Frame", hex: "#1C1C1C" },
      { id: "silver-frame", name: "Silver Frame", hex: "#A8AAAD" },
      { id: "white-frame", name: "White Frame", hex: "#F2F0EB" },
    ],
    windowOptions: [
      { id: "translucent", name: "Translucent Panels" },
      { id: "clear", name: "Clear Glass Panels" },
      { id: "frosted", name: "Frosted Panels" },
    ],
  },
  {
    id: "wayne-dalton-9700",
    manufacturer: "wayne-dalton",
    name: "Model 9700",
    series: "Wood Carriage",
    tagline: "Hand-crafted cedar carriage door",
    category: "carriage",
    prompt: "a Wayne Dalton Model 9700 cedar wood carriage house garage door, visible vertical plank grain, black wrought iron handles and strap hinges",
    catalogUrl: "https://www.waynedalton.com/residential/model/9700",
    swatch: { panel: "#9a6a36", trim: "#5a3b1c", accent: "#0e0e0e" },
    colors: [
      { id: "natural-cedar", name: "Natural Cedar", hex: "#C08A50" },
      { id: "honey-stain", name: "Honey Stain", hex: "#B8822E" },
      { id: "medium-oak", name: "Medium Oak Stain", hex: "#8B5C2A" },
      { id: "dark-walnut", name: "Dark Walnut Stain", hex: "#3D2012" },
    ],
    windowOptions: [
      { id: "arched", name: "Arched Windows" },
      { id: "ranch", name: "Ranch Windows" },
      { id: "no-windows", name: "No Windows" },
    ],
  },
  {
    id: "wayne-dalton-9100",
    manufacturer: "wayne-dalton",
    name: "Model 9100",
    series: "Steel Raised Panel",
    tagline: "Traditional raised short panel",
    category: "traditional",
    prompt: "a Wayne Dalton Model 9100 traditional raised short panel steel garage door, four rows of small raised rectangular panels, timeless suburban look",
    catalogUrl: "https://www.waynedalton.com/residential/model/9100",
    swatch: { panel: "#e8dcc1", trim: "#b8a784", accent: "#241a0f" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "desert-tan", name: "Desert Tan", hex: "#C4A46A" },
      { id: "charcoal", name: "Charcoal", hex: "#4A4A4A" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "short-rectangle", name: "Short Rectangle" },
      { id: "arch-top", name: "Arch Top" },
    ],
  },

  // ── Haas ─────────────────────────────────────────────────────────────────────
  {
    id: "haas-700",
    manufacturer: "haas",
    name: "700 Series",
    series: "Flush Modern Steel",
    tagline: "Insulated flush, premium contemporary finish",
    category: "modern",
    prompt: "a Haas 700 Series modern flush steel garage door, completely smooth surface, no visible joint lines, premium contemporary finish",
    catalogUrl: "https://haasdoor.com/product/700-series/",
    swatch: { panel: "#525860", trim: "#2c3036", accent: "#dadde0" },
    colors: [
      { id: "slate-gray", name: "Slate Gray", hex: "#525860" },
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "charcoal", name: "Charcoal", hex: "#4A4A4A" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "frosted-square-row", name: "Frosted Square Row" },
      { id: "clear-row", name: "Clear Glass Row" },
    ],
  },
  {
    id: "haas-680",
    manufacturer: "haas",
    name: "680 Series",
    series: "Carriage House Steel",
    tagline: "Steel carriage with grooved plank look",
    category: "carriage",
    prompt: "a Haas 680 carriage house steel garage door, grooved vertical plank look mimicking real wood, black decorative carriage hardware",
    catalogUrl: "https://haasdoor.com/product/680-series/",
    swatch: { panel: "#7a2a23", trim: "#481712", accent: "#101010" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "chocolate", name: "Chocolate Brown", hex: "#3E2309" },
      { id: "barn-red", name: "Barn Red", hex: "#7A2A23" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "arch", name: "Arched Windows" },
      { id: "ranch", name: "Ranch Windows" },
      { id: "rectangle", name: "Rectangle Windows" },
    ],
  },
  {
    id: "haas-600",
    manufacturer: "haas",
    name: "600 Series",
    series: "Traditional Insulated",
    tagline: "Long raised panel in classic colors",
    category: "traditional",
    prompt: "a Haas 600 Series traditional long raised panel insulated steel garage door, classic four-section design",
    catalogUrl: "https://haasdoor.com/product/600-series/",
    swatch: { panel: "#ddcfb4", trim: "#a59478", accent: "#2b2218" },
    colors: [
      { id: "white", name: "White", hex: "#F2F0EB" },
      { id: "cream", name: "Cream", hex: "#F0E8D0" },
      { id: "sandstone", name: "Sandstone", hex: "#C9B08B" },
      { id: "brown", name: "Brown", hex: "#6B4423" },
      { id: "black", name: "Black", hex: "#1C1C1C" },
    ],
    windowOptions: [
      { id: "no-windows", name: "No Windows" },
      { id: "short-rectangle", name: "Short Rectangle" },
      { id: "long-rectangle", name: "Long Rectangle" },
      { id: "ranch", name: "Ranch Style" },
    ],
  },
];

// ============================================================================
// Swap request validation
// ============================================================================

export const SwapRequestFieldsSchema = z.object({
  styleId: z.string().min(1),
  colorId: z.string().optional(),
  windowOptionId: z.string().optional(),
});

// ============================================================================
// Lead Capture
// ============================================================================

export const LeadSchema = z.object({
  id: z.string(),
  companyId: z.string().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  zipCode: z.string().nullable(),
  styleId: z.string().nullable(),
  styleName: z.string().nullable(),
  colorName: z.string().nullable(),
  manufacturerName: z.string().nullable(),
  windowOption: z.string().nullable(),
  notes: z.string().nullable(),
  source: z.string().nullable(),
  createdAt: z.string(),
});

export type Lead = z.infer<typeof LeadSchema>;

// ============================================================================
// Multi-tenant Company / Auth
// ============================================================================

export const CompanySchema = z.object({
  id: z.string(),
  businessName: z.string(),
  websiteUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColorHex: z.string(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  vanitySlug: z.string().nullable(),
  customSubdomain: z.string().nullable(),
  customDomain: z.string().nullable(),
  individualUrlEnabled: z.boolean(),
  tierType: z.string(),
  subscriptionStatus: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Company = z.infer<typeof CompanySchema>;

// Admin-only URL Preview generator response (POST /api/admin/preview-url).
export const PreviewUrlSchema = z.object({
  site: z.string(),
  url: z.string(),
  expires: z.number(),
  expiresAt: z.string(),
  ttlHours: z.number(),
});
export type PreviewUrl = z.infer<typeof PreviewUrlSchema>;

// Vanity slug: lowercase letters, numbers and single dashes (e.g. "acme-doors").
// 3–40 chars, no leading/trailing/double dashes. Used in /v/:slug URLs.
export const VanitySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(40, "Slug must be 40 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single dashes only"
  );

// Reserved slugs that collide with app routes or would be confusing.
export const RESERVED_SLUGS = new Set([
  "v", "api", "admin", "dashboard", "login", "signup", "embed",
  "uploads", "app", "www", "assets", "static",
]);

export const CompanyBrandingSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  logoUrl: z.string().nullable(),
  primaryColorHex: z.string(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  websiteUrl: z.string().nullable(),
});
export type CompanyBranding = z.infer<typeof CompanyBrandingSchema>;

export const ScrapedBrandSchema = z.object({
  logoUrl: z.string().nullable(),
  primaryColorHex: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
});
export type ScrapedBrand = z.infer<typeof ScrapedBrandSchema>;

// ============================================================================
// Subscription / Square
// ============================================================================

export const SubscriptionStatusSchema = z.enum([
  "unpaid",
  "pending",
  "active",
  "canceled",
  "paused",
  "inactive",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const TierTypeSchema = z.enum(["starter", "professional", "enterprise"]);
export type TierType = z.infer<typeof TierTypeSchema>;

export const SubscriptionInfoSchema = z.object({
  subscriptionStatus: SubscriptionStatusSchema,
  tierType: TierTypeSchema,
  squareSubscriptionId: z.string().nullable(),
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

export const PlanSchema = z.object({
  id: TierTypeSchema,
  name: z.string(),
  priceMonthly: z.number(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const CheckoutResponseSchema = z.object({
  checkoutUrl: z.string(),
  orderId: z.string().nullable().optional(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

// ============================================================================
// Admin
// ============================================================================

export const AdminStatsSchema = z.object({
  totalCompanies: z.number(),
  activeCompanies: z.number(),
  totalLeads: z.number(),
  totalUsers: z.number(),
  tierBreakdown: z.array(z.object({ tier: z.string(), count: z.number() })),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

// ============================================================================
// Repair Estimator — shared catalog + pricing math (single source of truth)
// ============================================================================
//
// The homeowner answers 4 simple questions about their door, then clicks parts
// on an interactive diagram to pick repairs. Each repair has a base price the
// business owner sets (assuming the *baseline* door: 1-Car / Standard height /
// Hollow). Heavier doors cost more, so the base price is scaled by a few
// per-company multipliers depending on which door the homeowner described.

// --- Homeowner's door answers (Step 1) ---------------------------------------
export const DoorWidthSchema = z.enum(["1car", "2car"]);
export const DoorHeightSchema = z.enum(["standard", "tall"]);
export const DoorInsulationSchema = z.enum(["hollow", "vinyl", "steel"]);
export const SpringTypeSchema = z.enum(["torsion", "extension"]);

export const DoorConfigSchema = z.object({
  width: DoorWidthSchema,
  height: DoorHeightSchema,
  insulation: DoorInsulationSchema,
  springs: SpringTypeSchema,
});
export type DoorConfig = z.infer<typeof DoorConfigSchema>;

// --- Interactive diagram parts (clickable hotspots) --------------------------
export const REPAIR_PART_IDS = [
  "springs",
  "cables",
  "rollers",
  "hinges",
  "sections",
  "opener",
] as const;
export type RepairPartId = (typeof REPAIR_PART_IDS)[number];

export interface RepairPart {
  id: RepairPartId;
  name: string;
  /** Plain-English one-liner shown under the part title in the side panel. */
  blurb: string;
}

export const REPAIR_PARTS: RepairPart[] = [
  { id: "springs", name: "Springs", blurb: "The tightly-wound coils that do the heavy lifting when the door opens." },
  { id: "cables", name: "Cables", blurb: "The steel cables running down each side that lift the door evenly." },
  { id: "rollers", name: "Rollers", blurb: "The small wheels that let the door glide up and down the tracks." },
  { id: "hinges", name: "Hinges", blurb: "The metal joints connecting each panel so the door can bend as it rolls up." },
  { id: "sections", name: "Door Panels", blurb: "The large horizontal sections that make up the face of the door." },
  { id: "opener", name: "Opener Motor", blurb: "The motor unit on the ceiling that opens and closes the door for you." },
];

// --- Repair options -----------------------------------------------------------
// scalesWith flags decide which multipliers apply to this repair.
export interface RepairOption {
  key: string;
  partId: RepairPartId;
  label: string;
  /** Homeowner-friendly explanation (tooltip / helper text). */
  description: string;
  defaultBasePrice: number;
  scalesWith: { size: boolean; height: boolean; insulation: boolean };
}

export const REPAIR_CATALOG: RepairOption[] = [
  // Springs — the heaviest, most size/weight-sensitive repair.
  {
    key: "springs_replace",
    partId: "springs",
    label: "Replace 1 Broken Spring",
    description: "Swap out a single snapped spring. If your door won't open at all, a spring is the most likely cause.",
    defaultBasePrice: 250,
    scalesWith: { size: true, height: true, insulation: true },
  },
  {
    key: "springs_replace_pair",
    label: "Replace Both Springs (Recommended)",
    partId: "springs",
    description: "Replace the full set. Springs wear at the same rate, so replacing both prevents another break-down soon.",
    defaultBasePrice: 340,
    scalesWith: { size: true, height: true, insulation: true },
  },
  // Cables
  {
    key: "cables_replace",
    partId: "cables",
    label: "Fix 1 Snapped Cable",
    description: "Replace a frayed or snapped lift cable on one side of the door.",
    defaultBasePrice: 140,
    scalesWith: { size: true, height: true, insulation: false },
  },
  {
    key: "cables_replace_pair",
    partId: "cables",
    label: "Replace Both Cables",
    description: "Replace both lift cables so the door pulls up evenly and safely.",
    defaultBasePrice: 180,
    scalesWith: { size: true, height: true, insulation: false },
  },
  // Rollers
  {
    key: "rollers_replace",
    partId: "rollers",
    label: "Replace Rollers (Full Set)",
    description: "Swap worn or noisy wheels for smooth, quiet nylon rollers.",
    defaultBasePrice: 120,
    scalesWith: { size: true, height: false, insulation: false },
  },
  // Hinges
  {
    key: "hinges_replace",
    partId: "hinges",
    label: "Replace Worn / Cracked Hinges",
    description: "Replace damaged hinges between panels so the door bends smoothly and doesn't bind.",
    defaultBasePrice: 110,
    scalesWith: { size: true, height: false, insulation: false },
  },
  // Sections / panels
  {
    key: "panel_replace",
    partId: "sections",
    label: "Replace a Damaged Panel",
    description: "Replace one dented or cracked section of the door instead of the whole door.",
    defaultBasePrice: 320,
    scalesWith: { size: true, height: false, insulation: true },
  },
  {
    key: "weatherseal_replace",
    partId: "sections",
    label: "Replace Bottom Weather Seal",
    description: "New rubber seal along the bottom to keep out water, drafts, and pests.",
    defaultBasePrice: 90,
    scalesWith: { size: true, height: false, insulation: false },
  },
  // Opener — flat, not door-weight sensitive.
  {
    key: "opener_repair",
    partId: "opener",
    label: "Repair Opener Motor",
    description: "Diagnose and fix an opener that's noisy, slow, or not responding.",
    defaultBasePrice: 150,
    scalesWith: { size: false, height: false, insulation: false },
  },
  {
    key: "opener_replace",
    partId: "opener",
    label: "Replace Opener Motor",
    description: "Install a brand-new opener unit, including setup and testing.",
    defaultBasePrice: 450,
    scalesWith: { size: false, height: false, insulation: false },
  },
  {
    key: "opener_accessory",
    partId: "opener",
    label: "New Remote / Keypad",
    description: "Program a replacement remote or wireless keypad for your opener.",
    defaultBasePrice: 65,
    scalesWith: { size: false, height: false, insulation: false },
  },
];

// --- Per-company multipliers --------------------------------------------------
export const DEFAULT_REPAIR_MULTIPLIERS = {
  twoCarMultiplier: 1.6,
  tallMultiplier: 1.15,
  vinylMultiplier: 1.15,
  steelMultiplier: 1.35,
  serviceCallFee: 0,
};

export const RepairMultipliersSchema = z.object({
  twoCarMultiplier: z.number().min(1).max(5),
  tallMultiplier: z.number().min(1).max(5),
  vinylMultiplier: z.number().min(1).max(5),
  steelMultiplier: z.number().min(1).max(5),
  serviceCallFee: z.number().min(0).max(100000),
});
export type RepairMultipliers = z.infer<typeof RepairMultipliersSchema>;

// Owner updates settings from the dashboard: multipliers + a price per repairKey.
export const UpdateRepairSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  twoCarMultiplier: z.number().min(1).max(5).optional(),
  tallMultiplier: z.number().min(1).max(5).optional(),
  vinylMultiplier: z.number().min(1).max(5).optional(),
  steelMultiplier: z.number().min(1).max(5).optional(),
  serviceCallFee: z.number().min(0).max(100000).optional(),
  prices: z
    .array(z.object({ repairKey: z.string(), basePrice: z.number().min(0).max(100000) }))
    .optional(),
});
export type UpdateRepairSettings = z.infer<typeof UpdateRepairSettingsSchema>;

// Effective pricing returned to the public estimator: baseline price per repair
// plus the multipliers, so the client computes the live total as answers change.
export const RepairPricingResponseSchema = z.object({
  enabled: z.boolean(),
  multipliers: RepairMultipliersSchema,
  prices: z.array(z.object({ repairKey: z.string(), basePrice: z.number(), enabled: z.boolean() })),
});
export type RepairPricingResponse = z.infer<typeof RepairPricingResponseSchema>;

// Full settings shape for the owner dashboard.
export const RepairSettingsResponseSchema = RepairPricingResponseSchema;
export type RepairSettingsResponse = z.infer<typeof RepairSettingsResponseSchema>;

/**
 * The one pricing function shared by the estimator, the dashboard preview, and
 * the backend. Given a repair's base price + the homeowner's door answers +
 * the company multipliers, returns the dollar amount (rounded to the nearest $5).
 */
export function computeRepairPrice(
  basePrice: number,
  scalesWith: RepairOption["scalesWith"],
  config: DoorConfig,
  m: RepairMultipliers
): number {
  let mult = 1;
  if (scalesWith.size && config.width === "2car") mult *= m.twoCarMultiplier;
  if (scalesWith.height && config.height === "tall") mult *= m.tallMultiplier;
  if (scalesWith.insulation) {
    if (config.insulation === "vinyl") mult *= m.vinylMultiplier;
    else if (config.insulation === "steel") mult *= m.steelMultiplier;
  }
  const raw = basePrice * mult;
  return Math.max(0, Math.round(raw / 5) * 5);
}

// Merge stored per-company prices over the catalog defaults so every repair
// always has a price even before the owner customizes anything.
export function effectiveRepairPrices(
  stored: { repairKey: string; basePrice: number; enabled: boolean }[]
): { repairKey: string; basePrice: number; enabled: boolean }[] {
  const byKey = new Map(stored.map((p) => [p.repairKey, p]));
  return REPAIR_CATALOG.map((r) => {
    const found = byKey.get(r.key);
    return {
      repairKey: r.key,
      basePrice: found ? found.basePrice : r.defaultBasePrice,
      enabled: found ? found.enabled : true,
    };
  });
}
