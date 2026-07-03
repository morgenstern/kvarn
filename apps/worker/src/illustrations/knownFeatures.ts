/**
 * Pre-researched key_features strings for the master illustration prompt
 * (docs/07_ILLUSTRATION_STYLE.md §2 placeholder {key_features}), copied from
 * docs/08_ILLUSTRATION_REFS.md. Keyed by the seed-catalog product id.
 *
 * Products not listed here (community submissions, catalog additions) fall
 * back to LLM-generated key features — see generateKeyFeatures() in gemini.ts.
 */
export const KNOWN_KEY_FEATURES: Record<string, string> = {
  "grinder-niche-zero":
    "tall rounded cylinder body on flat disc base, domed conical hopper lid with round wooden knob, calibrated grind dial ring at hopper base, small polished dosing cup under front chute, matte black or white finish, wooden accent power lever",
  "grinder-eureka-mignon-specialita":
    "compact narrow tower with rounded vertical edges, small square clear bean hopper on top, black touchscreen timer display on front face, chrome portafilter fork below spout, top-mounted stepless adjustment knob, matte black body",
  "grinder-turin-df64-gen-2":
    "slim vertical rectangular column, short clear single-dose hopper topped with rubber bellows, polished aluminum numbered adjustment collar, front grounds chute with declumper, metal dosing cup on base tray",
  "grinder-baratza-encore-esp":
    "rounded plastic tower on cylindrical base, tall clear bean hopper with black lid, rotating hopper collar for grind adjustment, front pulse button on base, black body with metallic front accent band",
  "grinder-fellow-ode-gen-2":
    "low wide loaf-shaped rectangular body, flat top with small load-bin lid instead of tall hopper, large flat side-mounted grind dial with numbered markings, magnetic metal catch cup, minimalist matte black",
  "grinder-comandante-c40-mk4":
    "slim hand-grinder cylinder with wood-veneer wrap, brushed stainless top plate, side crank handle with round wooden ball knob, brown glass catch jar screwed to bottom, upright ~3:1 proportions",
  "grinder-1zpresso-k-ultra":
    "compact aluminum hand-grinder cylinder in iron-gray, foldable crank handle with wooden knob, external numbered adjustment dial ring at top, knurled grip texture band, magnetic slip-on catch cup",
  "grinder-kingrinder-k6":
    "slim silver aluminum cylinder, straight crank handle with cylindrical knob, external numbered grind dial below top plate, ribbed grip section, screw-on lower catch cup, utilitarian all-metal look",
  "grinder-timemore-sculptor-064s":
    "retro-futuristic slim tower with rounded sculpted head, short clear single-dose hopper with lid, numbered adjustment ring around neck, front spout with rotary knocker lever, matte white or black",
  "grinder-mahlkonig-x64":
    "compact pro-style angular tower with rounded shoulders, small single-dose hopper with flap lid, side grind adjustment wheel, front control panel with display, dosing cup on front fork, matte black commercial look",
  "machine-lelit-bianca-pl162t-v3":
    "polished stainless cube body, chrome E61 group front-center with wooden flow-control paddle on top, walnut wood steam knobs and portafilter handle, twin analog pressure gauges, cup rail on top, side-mounted clear water tank",
  "machine-gaggia-classic-evo-pro":
    "small boxy brushed stainless machine, row of three rocker switches on upper front, round logo badge, chrome 58 mm portafilter, slotted cup-warmer top plate, steam knob on right side",
  "machine-la-marzocco-linea-micra":
    "compact cube echoing commercial Linea, powder-coated side panels in bold colors, stainless front bar, protruding chrome brew group, top cup rail, joystick-style steam actuation",
  "machine-sage-barista-express":
    "wide brushed stainless all-in-one body, integrated conical grinder with bean hopper top-left, central front analog pressure gauge, grind-size dial on left, backlit buttons flanking gauge, steam wand right",
  "machine-lelit-marax-pl62x":
    "compact narrow polished stainless box, chrome E61 group front-center, single front brew gauge, steam/water controls flanking the group, cup rail on flat top, tall tight footprint",
  "machine-rocket-appartamento":
    "compact stainless body with signature circle-perforated side panels revealing copper or white inserts, chrome E61 group, single front gauge, flat top cup tray with rail, rounded edges",
  "machine-ecm-synchronika":
    "full-size polished stainless dual boiler with clean German lines, chrome E61 group, two analog gauges side by side, knurled chrome steam/water knobs left and right, top cup rail",
  "machine-profitec-go":
    "small square-bodied single boiler, powder-coated panels in bold colors, stainless top with cup tray, front PID/OLED display with two illuminated buttons, chrome portafilter, side steam knob",
  "machine-sage-bambino-plus":
    "very slim low-profile brushed stainless box, rounded front face with four backlit buttons, narrow footprint, automatic steam wand on right, small drip tray, minimalist compact proportions",
  "machine-rancilio-silvia-v6":
    "boxy upright stainless wrap with black frame top and base, column of rocker switches with indicator lights front-left, heavy chrome brass portafilter, steam knob right, iconic squared silhouette",
  "machine-quick-mill-orione-3000":
    "compact mirror-polished stainless box with rounded top edges, central front pump-pressure gauge, rocker switches with indicator lights, chrome 58 mm brass portafilter, black base and trim, steam knob on side",
  "grinder-eureka-mci-mg50e-mignon-istantaneo":
    "vintage compact Mignon silhouette, narrow tall rounded-edge metal body, small square clear bean hopper, manual timer dial/button on front, painted or chrome finish, portafilter fork under grounds chute",
  "machine-cafelat-robot":
    "retro robot-like manual lever press, polished dome cap on central piston chamber, two upswept lever arms with round ball knobs, twin legs framing the group, 58 mm basket sitting over cup on round base plate, powder-coated colors or polished aluminum",
};

const GENERIC_PRODUCT_TYPE: Record<string, string> = {
  grinder: "coffee grinder",
  machine: "espresso machine",
  brewer: "coffee brewer",
  accessory: "coffee accessory",
};

export function genericProductType(kind: string): string {
  return GENERIC_PRODUCT_TYPE[kind] ?? "coffee equipment item";
}
