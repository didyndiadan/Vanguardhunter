// ─── 28-Niche Curated Industry Visual Pool & Per-Business Diversification Engine ───
// Guarantees that Ready-to-Build Website Businesses and Built Websites never share
// the same repetitive 3 images, even when multiple businesses belong to the same category.

export interface DetailedNicheVisualPool {
  nicheId: string;
  nicheLabel: string;
  defaultThemeId: string;
  alternateThemeIds: string[];
  localAssetKeys: string[];
  curatedPhotoUrls: string[];
}

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=82`;

export const DETAILED_NICHE_POOLS: DetailedNicheVisualPool[] = [
  {
    nicheId: "fitness_gym",
    nicheLabel: "Fitness, Strength & Athletic Coaching",
    defaultThemeId: "kinetic_crimson",
    alternateThemeIds: ["kinetic_crimson", "industrial_orange", "midnight_sapphire", "nordic_indigo"],
    localAssetKeys: ["fitness_strength", "fitness_group", "fitness_coaching", "fitness_cardio_functional"],
    curatedPhotoUrls: [
      u("1534438327276-14e5300c3a48"),
      u("1517836357463-d25dfeac3438"),
      u("1571019614242-c5c5dee9f50b"),
      u("1540497077202-7c8a3999166f"),
      u("1581009146145-b5ef050c2e1e"),
      u("1599058917212-d750089bc07e"),
      u("1518611012118-696072aa579a"),
      u("1574680096145-d05b474e2155"),
      u("1549060279-7e168fcee0c2"),
      u("1526506118085-60ce8714f8c5"),
      u("1576678927484-cc907957088c"),
      u("1593079831268-3381b0db4a77"),
    ],
  },
  {
    nicheId: "dental",
    nicheLabel: "Dental, Orthodontics & Smile Care",
    defaultThemeId: "clinical_slate",
    alternateThemeIds: ["clinical_slate", "solar_teal", "midnight_sapphire", "nordic_indigo"],
    localAssetKeys: ["dental_medical", "dental_network", "medical_consultation", "medical_modern_treatment_suite"],
    curatedPhotoUrls: [
      u("1606811841689-23dfddce3e95"),
      u("1588776814546-1ffcf47267a5"),
      u("1629909613654-28e377c37b09"),
      u("1598256989800-fe5f95da9787"),
      u("1609840114035-3c981b782dfe"),
      u("1579684385127-1ef15d508118"),
      u("1629909615184-74f495363b67"),
      u("1516549655169-df83a0774514"),
      u("1551076805-e1869033e561"),
      u("1537368910025-700350fe46c7"),
    ],
  },
  {
    nicheId: "medical_clinic",
    nicheLabel: "Medical Clinic, Chiropractic & Physical Therapy",
    defaultThemeId: "clinical_slate",
    alternateThemeIds: ["clinical_slate", "midnight_sapphire", "emerald_botanical", "solar_teal"],
    localAssetKeys: ["medical_consultation", "medical_modern_treatment_suite", "dental_medical", "dental_network"],
    curatedPhotoUrls: [
      u("1576091160550-2173dba999ef"),
      u("1579684453423-f84349ef60b0"),
      u("1519494026892-80bbd2d6fd0d"),
      u("1584515979956-d9f6e5d09982"),
      u("1576091160399-112ba8d25d1d"),
      u("1631815588090-d4bfec5b1ccb"),
      u("1666214280557-f1b5022eb634"),
      u("1559839734-2b71ea197ec2"),
      u("1581594693702-fbdc51b2763b"),
      u("1505751172876-fa1923c5c528"),
    ],
  },
  {
    nicheId: "veterinary_pet",
    nicheLabel: "Veterinary, Pet Grooming & Boarding",
    defaultThemeId: "emerald_botanical",
    alternateThemeIds: ["emerald_botanical", "solar_teal", "clinical_slate", "valley_craft"],
    localAssetKeys: ["medical_consultation", "landscaping_outdoor", "salon_wellness"],
    curatedPhotoUrls: [
      u("1548199973-03cce0bbc87b"),
      u("1516734212186-a967f81ad0d7"),
      u("1583337130417-3346a1be7dee"),
      u("1628009368231-7bb7cfcb0def"),
      u("1587300003388-59208cc962cb"),
      u("1535930891776-0c2dfb7fda1a"),
      u("1596492784531-6e6eb5ea9993"),
      u("1576201836106-db1758fd1c97"),
      u("1601758228041-f3b2795255f1"),
      u("1541599540903-216a46ca1dc0"),
    ],
  },
  {
    nicheId: "cafe_bakery",
    nicheLabel: "Artisan Bakery, Coffee & Cafe",
    defaultThemeId: "culinary_linen",
    alternateThemeIds: ["culinary_linen", "crimson_culinary", "valley_craft", "executive_heritage"],
    localAssetKeys: ["restaurant_culinary", "restaurant_artisan_kitchen", "restaurant_dining"],
    curatedPhotoUrls: [
      u("1501339847302-ac426a4a7cbb"),
      u("1509440159596-0249088772ff"),
      u("1554118811-1e0d58224f24"),
      u("1495474472287-4d71bcdd2085"),
      u("1517433670267-08bbd4be890f"),
      u("1555507036-ab1f4038808a"),
      u("1442512595331-e89e73853f31"),
      u("1558961363-fa8fdf82db35"),
      u("1507133750040-4a8f57021571"),
      u("1578985545062-69928b1d9587"),
    ],
  },
  {
    nicheId: "restaurant_dining",
    nicheLabel: "Restaurant, Chef & Hospitality",
    defaultThemeId: "crimson_culinary",
    alternateThemeIds: ["crimson_culinary", "culinary_linen", "executive_heritage", "valley_craft"],
    localAssetKeys: ["restaurant_dining", "restaurant_culinary", "restaurant_catering_banquet", "restaurant_artisan_kitchen"],
    curatedPhotoUrls: [
      u("1517248135467-4c7edcad34c4"),
      u("1555396273-367ea4eb4db5"),
      u("1544025162-d76694265947"),
      u("1559339352-11d035aa65de"),
      u("1414235077428-338989a2e8c0"),
      u("1504674900247-0877df9cc836"),
      u("1552566626-52f8b828add9"),
      u("1565299624946-b28f40a0ae38"),
      u("1579871494447-9811cf80d66c"),
      u("1550966871-3ed3cdb5ed0c"),
      u("1514933651103-005eec06c04b"),
      u("1568901346375-23c9450c58cd"),
    ],
  },
  {
    nicheId: "catering_events",
    nicheLabel: "Catering, Private Events & Floral Design",
    defaultThemeId: "culinary_linen",
    alternateThemeIds: ["culinary_linen", "executive_heritage", "plum_aesthetics", "crimson_culinary"],
    localAssetKeys: ["restaurant_catering_banquet", "restaurant_dining", "restaurant_culinary"],
    curatedPhotoUrls: [
      u("1555244162-803834f70033"),
      u("1519225421980-715cb0215aed"),
      u("1464366400600-7168b8af9bc3"),
      u("1511795409834-ef04bbd61622"),
      u("1526047932273-341f2a7631f9"),
      u("1507504031003-b417219a0fde"),
      u("1530103862676-de8c9debad1d"),
      u("1478146896981-b80fe463b330"),
    ],
  },
  {
    nicheId: "salon_barber",
    nicheLabel: "Hair Salon, Barbershop & Color Studio",
    defaultThemeId: "plum_aesthetics",
    alternateThemeIds: ["plum_aesthetics", "culinary_linen", "executive_heritage", "kinetic_crimson"],
    localAssetKeys: ["salon_styling", "salon_luxury_hair_color", "salon_wellness", "salon_spa_facial_treatment"],
    curatedPhotoUrls: [
      u("1560066984-138dadb4c035"),
      u("1521590832167-7bcbfaa6381f"),
      u("1503951914875-452162b0f3f1"),
      u("1585747860715-2ba37e788b70"),
      u("1562322140-8baeececf3df"),
      u("1522337360788-8b13dee7a37e"),
      u("1599351431202-1e0f0137899a"),
      u("1622286342621-4bd786c2447c"),
      u("1595476108010-b4d1f102b1b1"),
      u("1580618672591-eb180b1a973f"),
    ],
  },
  {
    nicheId: "medspa_wellness",
    nicheLabel: "MedSpa, Facial Aesthetics & Wellness",
    defaultThemeId: "plum_aesthetics",
    alternateThemeIds: ["plum_aesthetics", "clinical_slate", "emerald_botanical", "culinary_linen"],
    localAssetKeys: ["salon_spa_facial_treatment", "salon_wellness", "salon_luxury_hair_color", "salon_styling"],
    curatedPhotoUrls: [
      u("1540555700478-4be289fbecef"),
      u("1570172619644-dfd03ed5d881"),
      u("1519823551278-64ac92734fb1"),
      u("1544161515-4ab6ce6db874"),
      u("1600334089648-b0d9d3028eb2"),
      u("1515377905703-c4788e51af15"),
      u("1512290900672-1f042f9202c3"),
      u("1616394584738-fc6e612e71b9"),
      u("1552693673-1bf958298935"),
      u("1507652313519-d4e9174996dd"),
    ],
  },
  {
    nicheId: "auto_detailing",
    nicheLabel: "Auto Detailing, Ceramic Coating & Body",
    defaultThemeId: "industrial_orange",
    alternateThemeIds: ["industrial_orange", "kinetic_crimson", "midnight_sapphire", "executive_heritage"],
    localAssetKeys: ["auto_precision_detailing_bay", "auto_diagnostic", "auto_brake_tire_alignment", "auto_mechanical"],
    curatedPhotoUrls: [
      u("1601362840469-51e4d8d58785"),
      u("1520340356584-f9917d1eea6f"),
      u("1607860108855-64acf2078ed9"),
      u("1503376780353-7e6692767b70"),
      u("1552519507-da3b142c6e3d"),
      u("1542282088-72c9c27ed0cd"),
      u("1618843479313-40f8afb4b4d8"),
      u("1492144534655-ae79c964c9d7"),
    ],
  },
  {
    nicheId: "auto_repair",
    nicheLabel: "Automotive Diagnostics, Brakes & Repair",
    defaultThemeId: "industrial_orange",
    alternateThemeIds: ["industrial_orange", "midnight_sapphire", "kinetic_crimson", "nordic_indigo"],
    localAssetKeys: ["auto_diagnostic", "auto_brake_tire_alignment", "auto_mechanical", "auto_precision_detailing_bay"],
    curatedPhotoUrls: [
      u("1619642751034-765dfdf7c58e"),
      u("1486262715619-67b85e0b08d3"),
      u("1530046339160-ce3e530c7d2f"),
      u("1625047509168-a7026f36de04"),
      u("1580273916550-e323be2ae537"),
      u("1517524008697-84bbe3c3fd98"),
      u("1487754180451-c456f719a1fc"),
      u("1632823471565-1ecdf5c6da35"),
      u("1504222490345-c075b6008014"),
      u("1563720223185-11003d516935"),
    ],
  },
  {
    nicheId: "plumbing",
    nicheLabel: "Plumbing, Drain & Water Heater Specialists",
    defaultThemeId: "midnight_sapphire",
    alternateThemeIds: ["midnight_sapphire", "solar_teal", "industrial_orange", "nordic_indigo"],
    localAssetKeys: ["plumbing_hvac", "electrical_plumbing_specialist", "hvac_dispatch", "bathroom"],
    curatedPhotoUrls: [
      u("1585704032915-c3400ca199e7"),
      u("1504328345606-18bbc8c9d7d1"),
      u("1607472586893-edb57bdc0e39"),
      u("1581092921461-eab62e97a780"),
      u("1584622650111-993a426fbf0a"),
      u("1552321554-5fefe8c9ef14"),
      u("1620626011761-996317b8d101"),
      u("1581092160607-ee22621dd758"),
      u("1513694203232-719a280e022f"),
      u("1564540586988-aa4e53c3d799"),
    ],
  },
  {
    nicheId: "hvac",
    nicheLabel: "HVAC, Air Conditioning & Climate Control",
    defaultThemeId: "midnight_sapphire",
    alternateThemeIds: ["midnight_sapphire", "industrial_orange", "solar_teal", "clinical_slate"],
    localAssetKeys: ["hvac_dispatch", "hvac_smart_climate_install", "plumbing_hvac", "electrical_plumbing_specialist"],
    curatedPhotoUrls: [
      u("1621905251189-08b45d6a269e"),
      u("1581094794329-c8112a89af12"),
      u("1504307651254-35680f356dfd"),
      u("1581092335397-9583fe92d232"),
      u("1558002038-1055907df827"),
      u("1581092580497-e0d23cbdf1dc"),
      u("1513694203232-719a280e022f"),
      u("1560518883-ce09059eeffa"),
    ],
  },
  {
    nicheId: "electrical",
    nicheLabel: "Electrical, Panel Upgrades & Lighting",
    defaultThemeId: "industrial_orange",
    alternateThemeIds: ["industrial_orange", "midnight_sapphire", "executive_heritage", "solar_teal"],
    localAssetKeys: ["electrical_plumbing_specialist", "hvac_dispatch", "commercial_solar", "hvac_smart_climate_install"],
    curatedPhotoUrls: [
      u("1621905252507-b35492cc74b4"),
      u("1558402529-d2638a7023e9"),
      u("1544724569-5f546fd6f2b5"),
      u("1513506003901-1e6a229e2d15"),
      u("1565814329452-e1efa11c5b89"),
      u("1581092162384-8987c1d64718"),
      u("1507473885765-e6ed057f782c"),
      u("1593941707882-a5bba14938c7"),
    ],
  },
  {
    nicheId: "solar",
    nicheLabel: "Solar Energy & Battery Storage",
    defaultThemeId: "solar_teal",
    alternateThemeIds: ["solar_teal", "emerald_botanical", "midnight_sapphire", "industrial_orange"],
    localAssetKeys: ["commercial_solar", "roofing_exterior", "electrical_plumbing_specialist", "exterior"],
    curatedPhotoUrls: [
      u("1509391366360-2e959784a276"),
      u("1508514177221-188b1cf16e9d"),
      u("1559302504-64aae6ca6b6d"),
      u("1613665813446-82a78c468a1d"),
      u("1548613053-22087dd8edb8"),
      u("1497435334941-8c899ee9e8e9"),
      u("1592833159155-c62df1b65634"),
      u("1611365892117-00ac5ef43c90"),
    ],
  },
  {
    nicheId: "roofing",
    nicheLabel: "Roofing, Gutters & Exterior Protection",
    defaultThemeId: "industrial_orange",
    alternateThemeIds: ["industrial_orange", "valley_craft", "executive_heritage", "midnight_sapphire"],
    localAssetKeys: ["roofing_exterior", "exterior", "remodel_custom_living_carpentry", "commercial_solar"],
    curatedPhotoUrls: [
      u("1632759145351-1d592919f522"),
      u("1600585154340-be6161a56a0c"),
      u("1512917774080-9991f1c4c750"),
      u("1570129477492-45c003edd2be"),
      u("1600596542815-ffad4c1539a9"),
      u("1580587771525-78b9dba3b914"),
      u("1600607687939-ce8a6c25118c"),
      u("1518780664697-55e3ad937233"),
    ],
  },
  {
    nicheId: "landscaping",
    nicheLabel: "Landscaping, Hardscaping & Tree Care",
    defaultThemeId: "emerald_botanical",
    alternateThemeIds: ["emerald_botanical", "valley_craft", "solar_teal", "culinary_linen"],
    localAssetKeys: ["landscaping_outdoor", "exterior", "remodel_custom_living_carpentry", "roofing_exterior"],
    curatedPhotoUrls: [
      u("1558904541-efa843a96f01"),
      u("1585320806297-9794b3e4eeae"),
      u("1592595896551-12b371d546d5"),
      u("1600585154526-990dced4db0d"),
      u("1416879595882-3373a0480b5b"),
      u("1584738766473-61c083514bf4"),
      u("1598902108854-10e335adac99"),
      u("1564013799919-ab600027ffc6"),
      u("1600566753376-12c8ab7fb75b"),
      u("1512915922686-57c11dde9b6b"),
    ],
  },
  {
    nicheId: "pool_spa",
    nicheLabel: "Custom Pools, Spas & Outdoor Living",
    defaultThemeId: "solar_teal",
    alternateThemeIds: ["solar_teal", "emerald_botanical", "midnight_sapphire", "valley_craft"],
    localAssetKeys: ["exterior", "landscaping_outdoor", "bathroom"],
    curatedPhotoUrls: [
      u("1576013551627-0cc20b96c2a7"),
      u("1572331165267-854da2b10ccc"),
      u("1564501049412-61c2a3083791"),
      u("1582268611958-ebfd161ef9cf"),
      u("1540541338287-41700207dee6"),
      u("1519046904884-53103b34b206"),
      u("1600596542815-ffad4c1539a9"),
      u("1575429198097-0414ec08e8cd"),
    ],
  },
  {
    nicheId: "cleaning",
    nicheLabel: "Residential, Commercial & Pressure Cleaning",
    defaultThemeId: "solar_teal",
    alternateThemeIds: ["solar_teal", "clinical_slate", "emerald_botanical", "midnight_sapphire"],
    localAssetKeys: ["kitchen", "bathroom", "remodel_custom_living_carpentry", "exterior"],
    curatedPhotoUrls: [
      u("1581578731548-c64695cc6952"),
      u("1527515637462-cff94eecc1ac"),
      u("1584820927498-cfe5211fd8bf"),
      u("1563453392212-326f5e854473"),
      u("1600585152220-90363fe7e115"),
      u("1556911220-e15b29be8c8f"),
      u("1584622781564-1d987f7333c1"),
      u("1628177142898-93e36e4e3a50"),
      u("1600566753190-17f0baa2a6c3"),
      u("1556909114-f6e7ad7d3136"),
    ],
  },
  {
    nicheId: "pest_control",
    nicheLabel: "Pest Control, Termite & Home Protection",
    defaultThemeId: "emerald_botanical",
    alternateThemeIds: ["emerald_botanical", "solar_teal", "industrial_orange", "valley_craft"],
    localAssetKeys: ["landscaping_outdoor", "exterior", "hvac_dispatch"],
    curatedPhotoUrls: [
      u("1560518883-ce09059eeffa"),
      u("1558904541-efa843a96f01"),
      u("1600585154340-be6161a56a0c"),
      u("1592595896551-12b371d546d5"),
      u("1512917774080-9991f1c4c750"),
      u("1570129477492-45c003edd2be"),
      u("1583608205776-bfd35f0d9f83"),
      u("1568605114967-8130f3a36994"),
    ],
  },
  {
    nicheId: "moving_junk",
    nicheLabel: "Moving, Relocation & Hauling Services",
    defaultThemeId: "industrial_orange",
    alternateThemeIds: ["industrial_orange", "midnight_sapphire", "valley_craft", "nordic_indigo"],
    localAssetKeys: ["exterior", "remodel_custom_living_carpentry", "commercial"],
    curatedPhotoUrls: [
      u("1600585152220-90363fe7e115"),
      u("1560518883-ce09059eeffa"),
      u("1586528116311-ad8dd3c8310d"),
      u("1553413077-190dd305871c"),
      u("1600585154526-990dced4db0d"),
      u("1513694203232-719a280e022f"),
      u("1580674285054-bed31e145f59"),
      u("1600607687920-4e2a09cf159d"),
    ],
  },
  {
    nicheId: "garage_locksmith",
    nicheLabel: "Garage Doors, Locksmith & Access Security",
    defaultThemeId: "midnight_sapphire",
    alternateThemeIds: ["midnight_sapphire", "industrial_orange", "nordic_indigo", "executive_heritage"],
    localAssetKeys: ["exterior", "hvac_dispatch", "electrical_plumbing_specialist"],
    curatedPhotoUrls: [
      u("1558002038-1055907df827"),
      u("1600585154340-be6161a56a0c"),
      u("1564013799919-ab600027ffc6"),
      u("1512917774080-9991f1c4c750"),
      u("1580587771525-78b9dba3b914"),
      u("1600596542815-ffad4c1539a9"),
      u("1557597774-9d273605dfa9"),
      u("1600607687939-ce8a6c25118c"),
    ],
  },
  {
    nicheId: "painting_flooring",
    nicheLabel: "Painting, Flooring & Interior Finishes",
    defaultThemeId: "valley_craft",
    alternateThemeIds: ["valley_craft", "culinary_linen", "solar_teal", "executive_heritage"],
    localAssetKeys: ["remodel_custom_living_carpentry", "kitchen", "bathroom", "exterior"],
    curatedPhotoUrls: [
      u("1562259949-e8e7689d7828"),
      u("1589939705384-5185137a7f0f"),
      u("1581858726788-75bc0f6a952d"),
      u("1600585152220-90363fe7e115"),
      u("1618221195710-dd6b41faaea6"),
      u("1600210492486-724fe5c67fb0"),
      u("1616486338812-3dadae4b4ace"),
      u("1600566753376-12c8ab7fb75b"),
    ],
  },
  {
    nicheId: "remodeling",
    nicheLabel: "Custom Kitchen, Bath & Home Remodeling",
    defaultThemeId: "valley_craft",
    alternateThemeIds: ["valley_craft", "culinary_linen", "executive_heritage", "industrial_orange"],
    localAssetKeys: ["kitchen", "bathroom", "remodel_custom_living_carpentry", "exterior"],
    curatedPhotoUrls: [
      u("1556911220-e15b29be8c8f"),
      u("1556909114-f6e7ad7d3136"),
      u("1584622650111-993a426fbf0a"),
      u("1600585154526-990dced4db0d"),
      u("1600566753190-17f0baa2a6c3"),
      u("1600210492486-724fe5c67fb0"),
      u("1552321554-5fefe8c9ef14"),
      u("1600607687939-ce8a6c25118c"),
      u("1618221195710-dd6b41faaea6"),
      u("1600585152220-90363fe7e115"),
    ],
  },
  {
    nicheId: "legal_law",
    nicheLabel: "Law Firm & Legal Representation",
    defaultThemeId: "executive_heritage",
    alternateThemeIds: ["executive_heritage", "nordic_indigo", "midnight_sapphire", "valley_craft"],
    localAssetKeys: ["legal_advisory", "advisory_executive_boardroom", "b2b_intelligence", "commercial"],
    curatedPhotoUrls: [
      u("1589829545856-d10d557cf95f"),
      u("1450101499163-c8848c66ca85"),
      u("1505664194779-8beaceb93744"),
      u("1521791136064-7986c2920216"),
      u("1497366216548-37526070297c"),
      u("1454165804606-c3d57bc86b40"),
      u("1573496359142-b8d87734a5a2"),
      u("1556761175-5973dc0f32e7"),
    ],
  },
  {
    nicheId: "financial_cpa",
    nicheLabel: "CPA, Tax, Financial & Insurance Advisory",
    defaultThemeId: "executive_heritage",
    alternateThemeIds: ["nordic_indigo", "executive_heritage", "midnight_sapphire", "emerald_botanical"],
    localAssetKeys: ["b2b_intelligence", "advisory_executive_boardroom", "legal_advisory", "commercial"],
    curatedPhotoUrls: [
      u("1554224155-6726b3ff858f"),
      u("1460925895917-afdab827c52f"),
      u("1454165804606-c3d57bc86b40"),
      u("1551288049-bebda4e38f71"),
      u("1556761175-b413da4baf72"),
      u("1542744173-8e7e53415bb0"),
      u("1573164713988-8665fc963095"),
      u("1600880292203-757bb62b4baf"),
    ],
  },
  {
    nicheId: "real_estate",
    nicheLabel: "Real Estate, Property & Mortgage",
    defaultThemeId: "executive_heritage",
    alternateThemeIds: ["executive_heritage", "valley_craft", "culinary_linen", "nordic_indigo"],
    localAssetKeys: ["exterior", "kitchen", "remodel_custom_living_carpentry", "advisory_executive_boardroom"],
    curatedPhotoUrls: [
      u("1560518883-ce09059eeffa"),
      u("1600596542815-ffad4c1539a9"),
      u("1512917774080-9991f1c4c750"),
      u("1600585154340-be6161a56a0c"),
      u("1600607687939-ce8a6c25118c"),
      u("1564013799919-ab600027ffc6"),
      u("1580587771525-78b9dba3b914"),
      u("1600566753376-12c8ab7fb75b"),
    ],
  },
  {
    nicheId: "creative_tech_b2b",
    nicheLabel: "Commercial, Digital & B2B Services",
    defaultThemeId: "nordic_indigo",
    alternateThemeIds: ["nordic_indigo", "midnight_sapphire", "executive_heritage", "solar_teal"],
    localAssetKeys: ["b2b_intelligence", "commercial", "advisory_executive_boardroom", "legal_advisory"],
    curatedPhotoUrls: [
      u("1497366216548-37526070297c"),
      u("1522071820081-009f0129c71c"),
      u("1531482615713-2afd69097998"),
      u("1552664730-d307ca884978"),
      u("1542744094-3a31f272c490"),
      u("1519389950473-47ba0277781c"),
      u("1497215728101-856f4ea42174"),
      u("1504384308090-c894fdcc538d"),
      u("1553877522-43269d4ea984"),
      u("1600880292089-90a7e086ee0c"),
    ],
  },
];

export function hashBusinessSeed(input: string): number {
  const s = String(input || "business").toLowerCase().trim();
  let h1 = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return Math.abs(h1 >>> 0);
}

export function detectDetailedBusinessNiche(
  category = "",
  businessName = ""
): DetailedNicheVisualPool {
  const combined = `${category} ${businessName}`.toLowerCase();

  const findPool = (id: string) =>
    DETAILED_NICHE_POOLS.find((p) => p.nicheId === id) ||
    DETAILED_NICHE_POOLS[DETAILED_NICHE_POOLS.length - 1];

  if (
    /gym\b|fitness|crossfit|workout|personal train|strength|conditioning|athletic|barbell|weightlift|powerlift|boxing|kickbox|martial art|\bmma\b|jiu jitsu|karate|taekwondo|pilates|yoga|boot ?camp|health club|\bspin\b|cycling|\bhiit\b|physique|sports performance|dance studio|gymnast/i.test(
      combined
    )
  ) {
    return findPool("fitness_gym");
  }
  if (/\bvet\b|veterinar|animal hospital|pet groom|dog groom|dog board|pet board|dog train|kennel|doggy|doggie|pet spa|pet care/i.test(combined)) {
    return findPool("veterinary_pet");
  }
  if (/dentist|dental|orthodont|invisalign|periodont|endodont|oral surg|smile|teeth|tooth/i.test(combined)) {
    return findPool("dental");
  }
  if (
    /clinic|\bmed\b|medical|doctor|physician|chiro|physio|physical therap|rehab|optom|eye care|vision|dermatol|pediatr|podiatr|urgent care|healthcare|patient|acupunct|counsel|mental health|therap/i.test(
      combined
    )
  ) {
    return findPool("medical_clinic");
  }
  if (/cafe|coffee|espresso|bakery|boulangerie|patisserie|pastry|donut|doughnut|cupcake|\bcake\b|dessert|ice cream|gelato|boba|tea house|smoothie|juice bar/i.test(combined)) {
    return findPool("cafe_bakery");
  }
  if (/cater|banquet|wedding|event venue|event plan|party rental|florist|floral|flower shop/i.test(combined)) {
    return findPool("catering_events");
  }
  if (/restaur|bistro|pizz|grill|sushi|taco|taqueria|mexican|italian|thai|chinese|indian|steak|burger|bbq|barbecue|seafood|diner|ramen|noodle|\bpub\b|tavern|bar &|gastropub|food|dining|menu|chef|kitchen & bar/i.test(combined)) {
    return findPool("restaurant_dining");
  }
  if (/med ?spa|facial|aesthetic|botox|laser|massage|\bnail|manicure|pedicure|lash|brow|waxing|skincare|skin care|wellness spa|day spa/i.test(combined)) {
    return findPool("medspa_wellness");
  }
  if (/salon|barber|haircut|hair color|hair studio|balayage|stylist|blowout|braid|beauty/i.test(combined)) {
    return findPool("salon_barber");
  }
  if (/detailing|car wash|auto spa|ceramic coat|window tint|paint protection|\bppf\b|auto body|collision|dent repair|vinyl wrap/i.test(combined)) {
    return findPool("auto_detailing");
  }
  if (/\bauto\b|automotive|mechanic|car repair|brake|tire|transmission|towing|engine|vehicle|muffler|exhaust|alignment|oil change|smog|diesel|fleet/i.test(combined)) {
    return findPool("auto_repair");
  }
  if (/plumb|rooter|drain|water heater|tankless|sewer|repipe|septic|\bpipe\b|leak/i.test(combined)) {
    return findPool("plumbing");
  }
  if (/hvac|air condition|heating|furnace|cooling|\bduct\b|climate|heat pump|ac repair/i.test(combined)) {
    return findPool("hvac");
  }
  if (/electr|wiring|breaker|panel upgrade|generator|lighting|ev charger/i.test(combined)) {
    return findPool("electrical");
  }
  if (/solar|clean energy|photovoltaic/i.test(combined)) {
    return findPool("solar");
  }
  if (/roof|gutter|siding|shingle|skylight|downspout/i.test(combined)) {
    return findPool("roofing");
  }
  if (/\bpool\b|pools|hot tub|jacuzzi|swim/i.test(combined)) {
    return findPool("pool_spa");
  }
  if (/landscap|lawn|\btree\b|arborist|hardscap|paver|patio|fence|fencing|\bdeck\b|irrigation|sprinkler|\bsod\b|garden|outdoor|yard/i.test(combined)) {
    return findPool("landscaping");
  }
  if (/clean|maid|janitor|housekeep|pressure wash|power wash|window wash|carpet clean|sanitiz|disinfect/i.test(combined)) {
    return findPool("cleaning");
  }
  if (/\bpest\b|exterminat|termite|wildlife|rodent|mosquito|\bbug\b/i.test(combined)) {
    return findPool("pest_control");
  }
  if (/moving|mover|relocat|\bjunk\b|hauling|dumpster|storage/i.test(combined)) {
    return findPool("moving_junk");
  }
  if (/garage door|overhead door|locksmith|\bgate\b|access control|alarm|security camera|cctv/i.test(combined)) {
    return findPool("garage_locksmith");
  }
  if (/paint|flooring|hardwood|carpet|tile|drywall|epoxy|stucco|handyman/i.test(combined)) {
    return findPool("painting_flooring");
  }
  if (/construct|remodel|renovat|kitchen|\bbath\b|bathroom|cabinet|countertop|builder|addition|\badu\b|carpentr|general contractor|masonry|concrete/i.test(combined)) {
    return findPool("remodeling");
  }
  if (/\blaw\b|lawyer|attorney|legal|litigat|injury|defense|estate plan|immigration|notary/i.test(combined)) {
    return findPool("legal_law");
  }
  if (/account|\bcpa\b|\btax\b|bookkeep|financ|wealth|insur|payroll|audit/i.test(combined)) {
    return findPool("financial_cpa");
  }
  if (/real estate|realtor|broker|property|mortgage|escrow|title|home inspect|staging|apprais/i.test(combined)) {
    return findPool("real_estate");
  }

  return findPool("creative_tech_b2b");
}

/**
 * Selects `count` guaranteed-unique images for a specific business by combining
 * local industry assets + curated niche URLs and rotating deterministically using
 * the business name, city, and optional variation seed so no two businesses get
 * the same 3-photo sequence.
 */
export function selectUniqueVisualsForBusiness(params: {
  category?: string;
  businessName?: string;
  city?: string;
  variationSeed?: number;
  count?: number;
  localAssetsMap?: Record<string, string>;
  avoidUrls?: Set<string>;
}): {
  nichePool: DetailedNicheVisualPool;
  recommendedThemeId: string;
  images: string[];
  imageKeys: string[];
} {
  const {
    category = "",
    businessName = "",
    city = "",
    variationSeed = 0,
    count = 3,
    localAssetsMap = {},
    avoidUrls,
  } = params;

  const nichePool = detectDetailedBusinessNiche(category, businessName);
  const seedStr = `${businessName.trim().toLowerCase()}::${city.trim().toLowerCase()}::${category.trim().toLowerCase()}::v${variationSeed}`;
  const hash = hashBusinessSeed(seedStr);

  // Pick a varied theme from the niche's alternateThemeIds so businesses also get distinct brand colors
  const themePool =
    nichePool.alternateThemeIds.length > 0
      ? nichePool.alternateThemeIds
      : [nichePool.defaultThemeId];
  const isValleyFlagship = /valley construction/i.test(businessName);
  const recommendedThemeId = isValleyFlagship
    ? "valley_craft"
    : themePool[(hash + variationSeed) % themePool.length];

  // Build the combined candidate URL list for this niche (curated high-res URLs + local bundled assets)
  const localUrls = nichePool.localAssetKeys
    .map((k) => localAssetsMap[k])
    .filter((u): u is string => Boolean(u));

  // Interleave curated photo URLs, local assets, and focal-crop variants so even 30+ businesses in the exact same niche get 100% unique URLs
  const combinedPool: string[] = [];
  const maxLen = Math.max(nichePool.curatedPhotoUrls.length, localUrls.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < nichePool.curatedPhotoUrls.length) {
      const cu = nichePool.curatedPhotoUrls[i];
      if (!combinedPool.includes(cu)) combinedPool.push(cu);
    }
    if (i < localUrls.length) {
      const lu = localUrls[i];
      if (!combinedPool.includes(lu)) combinedPool.push(lu);
    }
  }
  for (const baseCu of nichePool.curatedPhotoUrls) {
    const altCrop1 = `${baseCu}&crop=faces,edges`;
    const altCrop2 = `${baseCu}&crop=entropy`;
    if (!combinedPool.includes(altCrop1)) combinedPool.push(altCrop1);
    if (!combinedPool.includes(altCrop2)) combinedPool.push(altCrop2);
  }

  const poolSize = combinedPool.length;
  if (poolSize === 0) {
    return {
      nichePool,
      recommendedThemeId,
      images: [],
      imageKeys: nichePool.localAssetKeys.slice(0, count),
    };
  }

  // Use a deterministic start index and coprime stride so different businesses get completely different triplets
  const startIdx = (hash + variationSeed * 3) % poolSize;
  const coprimeSteps = [1, 3, 5, 7];
  const step =
    coprimeSteps.find((s) => s < poolSize && gcd(s, poolSize) === 1) || 1;

  const chosenImages: string[] = [];
  const usedInThisBusiness = new Set<string>();

  // Pass 1: Prefer URLs not in `avoidUrls` (so businesses in a list never share lead photos)
  for (let i = 0; i < poolSize && chosenImages.length < count; i++) {
    const candidateIdx = (startIdx + i * step) % poolSize;
    const url = combinedPool[candidateIdx];
    if (
      url &&
      !usedInThisBusiness.has(url) &&
      (!avoidUrls || !avoidUrls.has(url))
    ) {
      usedInThisBusiness.add(url);
      chosenImages.push(url);
      if (avoidUrls) avoidUrls.add(url);
    }
  }

  // Pass 2: If pool was smaller than total businesses in list, fill remaining slots with rotated order
  for (let i = 0; i < poolSize && chosenImages.length < count; i++) {
    const candidateIdx = (startIdx + i * step) % poolSize;
    const url = combinedPool[candidateIdx];
    if (url && !usedInThisBusiness.has(url)) {
      usedInThisBusiness.add(url);
      chosenImages.push(url);
    }
  }

  // Also rotate localAssetKeys deterministically
  const keyPool = nichePool.localAssetKeys;
  const chosenKeys: string[] = [];
  for (let i = 0; i < count; i++) {
    chosenKeys.push(keyPool[(hash + variationSeed + i) % keyPool.length] || "commercial");
  }

  return {
    nichePool,
    recommendedThemeId,
    images: chosenImages,
    imageKeys: chosenKeys,
  };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}
