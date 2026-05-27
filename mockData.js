// Clash of Clans High-Fidelity Mock Data
// Matches official Clash of Clans API schemas exactly

const MOCK_CLANS = {
  "#2PP2PP2P": {
    tag: "#2PP2PP2P",
    name: "Nova Esports",
    type: "inviteOnly",
    description: "Official Nova Esports Clan. Professional clashers, active war clan, max donations, competitive atmosphere. Respect and learn!",
    location: { id: 32000006, name: "International", isCountry: false },
    badgeUrls: {
      small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png",
      large: "https://api-assets.clashofclans.com/badges/512/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png",
      medium: "https://api-assets.clashofclans.com/badges/200/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png"
    },
    clanLevel: 24,
    clanPoints: 48950,
    clanVersusPoints: 38200,
    requiredTrophies: 5000,
    warFrequency: "always",
    warWinStreak: 12,
    warWins: 654,
    warTies: 4,
    warLosses: 112,
    isWarLogPublic: true,
    warLeague: { id: 48000018, name: "Champion League I" },
    labels: [
      { id: 56000000, name: "Clan Wars", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png" } },
      { id: 56000001, name: "Clan Games", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png" } },
      { id: 56000002, name: "Active Donator", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/9oZex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }
    ],
    members: 48,
    chatLanguage: { id: 75000000, name: "English", languageCode: "EN" },
    clanCapital: {
      capitalHallLevel: 10,
      districts: [
        { id: 70000000, name: "Capital Peak", districtHallLevel: 10 },
        { id: 70000001, name: "Barbarian Camp", districtHallLevel: 5 },
        { id: 70000002, name: "Wizard Valley", districtHallLevel: 5 },
        { id: 70000003, name: "Balloon Lagoon", districtHallLevel: 4 },
        { id: 70000004, name: "Builder's Workshop", districtHallLevel: 4 }
      ]
    },
    memberList: [
      {
        tag: "#Y2CU0P8P",
        name: "ClashMaster",
        role: "leader",
        expLevel: 245,
        league: {
          id: 29000022,
          name: "Legend League",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png"
          }
        },
        trophies: 5850,
        versusTrophies: 4200,
        clanRank: 1,
        previousClanRank: 1,
        donations: 8450,
        donationsReceived: 2100
      },
      {
        tag: "#Q2R8Y9LL",
        name: "ElixirQueen",
        role: "coLeader",
        expLevel: 212,
        league: {
          id: 29000022,
          name: "Legend League",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png"
          }
        },
        trophies: 5420,
        versusTrophies: 3950,
        clanRank: 2,
        previousClanRank: 3,
        donations: 12400,
        donationsReceived: 4500
      },
      {
        tag: "#P99R8Y2C",
        name: "DarkKnight",
        role: "coLeader",
        expLevel: 198,
        league: {
          id: 29000021,
          name: "Titan League I",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/gcEXiaCcMEss3xeu2G2To1Qq56730kt4gOS4A81G398.png"
          }
        },
        trophies: 4910,
        versusTrophies: 3400,
        clanRank: 3,
        previousClanRank: 2,
        donations: 6200,
        donationsReceived: 3100
      },
      {
        tag: "#L88Y9C2R",
        name: "GoblinKing",
        role: "elder",
        expLevel: 185,
        league: {
          id: 29000021,
          name: "Titan League II",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/gcEXiaCcMEss3xeu2G2To1Qq56730kt4gOS4A81G398.png"
          }
        },
        trophies: 4720,
        versusTrophies: 3200,
        clanRank: 4,
        previousClanRank: 5,
        donations: 3100,
        donationsReceived: 4500
      },
      {
        tag: "#U22CCYY8",
        name: "ElectroStorm",
        role: "elder",
        expLevel: 178,
        league: {
          id: 29000020,
          name: "Titan League III",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/gcEXiaCcMEss3xeu2G2To1Qq56730kt4gOS4A81G398.png"
          }
        },
        trophies: 4230,
        versusTrophies: 3000,
        clanRank: 5,
        previousClanRank: 4,
        donations: 5500,
        donationsReceived: 1800
      },
      {
        tag: "#X99RLLYY",
        name: "GrandWarlock",
        role: "member",
        expLevel: 165,
        league: {
          id: 29000018,
          name: "Master League II",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/4wtSg5B5p5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png"
          }
        },
        trophies: 3850,
        versusTrophies: 2800,
        clanRank: 6,
        previousClanRank: 7,
        donations: 1200,
        donationsReceived: 4000
      }
    ]
  },
  "#8U2RYV0Y": {
    tag: "#8U2RYV0Y",
    name: "Dark Elixir",
    type: "inviteOnly",
    description: "Relaxed but active clan. Constant wars, friendly challenges, and max games. Everyone must participate in Raid Weekends!",
    location: { id: 32000254, name: "United States", isCountry: true },
    badgeUrls: {
      small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png",
      large: "https://api-assets.clashofclans.com/badges/512/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png",
      medium: "https://api-assets.clashofclans.com/badges/200/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png"
    },
    clanLevel: 18,
    clanPoints: 34500,
    clanVersusPoints: 28900,
    requiredTrophies: 3000,
    warFrequency: "twiceAWeek",
    warWinStreak: 3,
    warWins: 322,
    warTies: 1,
    warLosses: 198,
    isWarLogPublic: true,
    warLeague: { id: 48000015, name: "Crystal League I" },
    labels: [
      { id: 56000000, name: "Clan Wars", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png" } },
      { id: 56000001, name: "Clan Games", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png" } }
    ],
    members: 35,
    chatLanguage: { id: 75000000, name: "English", languageCode: "EN" },
    clanCapital: {
      capitalHallLevel: 8,
      districts: [
        { id: 70000000, name: "Capital Peak", districtHallLevel: 8 }
      ]
    },
    memberList: [
      {
        tag: "#M29UUR8P",
        name: "LavaHound",
        role: "leader",
        expLevel: 172,
        league: {
          id: 29000018,
          name: "Master League II",
          iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/4wtSg5B5p5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png"
          }
        },
        trophies: 3820,
        versusTrophies: 2900,
        clanRank: 1,
        previousClanRank: 1,
        donations: 4500,
        donationsReceived: 1200
      }
    ]
  }
};

const MOCK_PLAYERS = {
  "#Y2CU0P8P": {
    tag: "#Y2CU0P8P",
    name: "ClashMaster",
    townHallLevel: 16,
    townHallWeaponLevel: 4,
    expLevel: 245,
    trophies: 5850,
    bestTrophies: 6120,
    warStars: 2150,
    attackWins: 184,
    defenseWins: 42,
    builderHallLevel: 10,
    versusTrophies: 4200,
    bestVersusTrophies: 4550,
    versusBattleWins: 890,
    role: "leader",
    warPreference: "in",
    donations: 8450,
    donationsReceived: 2100,
    clan: {
      tag: "#2PP2PP2P",
      name: "Nova Esports",
      clanLevel: 24,
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png",
        medium: "https://api-assets.clashofclans.com/badges/200/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png"
      }
    },
    league: {
      id: 29000022,
      name: "Legend League",
      iconUrls: {
        small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png",
        medium: "https://api-assets.clashofclans.com/leagues/288/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png"
      }
    },
    achievements: [
      { name: "Keeper of the Hearth", stars: 3, value: 500, target: 100, info: "Donate total of 100 Spells", completionInfo: "Completed!" },
      { name: "Gold Grab", stars: 3, value: 2000000000, target: 100000000, info: "Steal 100,000,000 Gold", completionInfo: "Completed!" },
      { name: "Elixir Escapade", stars: 3, value: 2000000000, target: 100000000, info: "Steal 100,000,000 Elixir", completionInfo: "Completed!" },
      { name: "Sweet Victory", stars: 3, value: 3200, target: 1250, info: "Achieve a total of 1,250 trophies in Multiplayer battles", completionInfo: "Completed!" }
    ],
    heroes: [
      { name: "Barbarian King", level: 95, maxLevel: 95, village: "home" },
      { name: "Archer Queen", level: 95, maxLevel: 95, village: "home" },
      { name: "Grand Warden", level: 70, maxLevel: 70, village: "home" },
      { name: "Royal Champion", level: 45, maxLevel: 45, village: "home" }
    ],
    heroEquipment: [
      { name: "Giant Gauntlet", level: 27, maxLevel: 27, village: "home", heroName: "Barbarian King" },
      { name: "Vampstache", level: 18, maxLevel: 18, village: "home", heroName: "Barbarian King" },
      { name: "Invisibility Vial", level: 18, maxLevel: 18, village: "home", heroName: "Archer Queen" },
      { name: "Healer Puppet", level: 18, maxLevel: 18, village: "home", heroName: "Archer Queen" },
      { name: "Eternal Tome", level: 18, maxLevel: 18, village: "home", heroName: "Grand Warden" },
      { name: "Healing Tome", level: 18, maxLevel: 18, village: "home", heroName: "Grand Warden" }
    ],
    troops: [
      { name: "Barbarian", level: 12, maxLevel: 12, village: "home" },
      { name: "Archer", level: 12, maxLevel: 12, village: "home" },
      { name: "Giant", level: 12, maxLevel: 12, village: "home" },
      { name: "Goblin", level: 9, maxLevel: 9, village: "home" },
      { name: "Wall Breaker", level: 11, maxLevel: 11, village: "home" },
      { name: "Balloon", level: 11, maxLevel: 11, village: "home" },
      { name: "Wizard", level: 11, maxLevel: 11, village: "home" },
      { name: "Healer", level: 9, maxLevel: 9, village: "home" },
      { name: "Dragon", level: 10, maxLevel: 10, village: "home" },
      { name: "P.E.K.K.A", level: 10, maxLevel: 10, village: "home" },
      { name: "Baby Dragon", level: 9, maxLevel: 9, village: "home" },
      { name: "Electro Dragon", level: 7, maxLevel: 7, village: "home" },
      { name: "Yeti", level: 5, maxLevel: 5, village: "home" }
    ],
    spells: [
      { name: "Lightning Spell", level: 10, maxLevel: 10, village: "home" },
      { name: "Healing Spell", level: 9, maxLevel: 9, village: "home" },
      { name: "Rage Spell", level: 6, maxLevel: 6, village: "home" },
      { name: "Jump Spell", level: 4, maxLevel: 4, village: "home" },
      { name: "Freeze Spell", level: 7, maxLevel: 7, village: "home" },
      { name: "Clone Spell", level: 8, maxLevel: 8, village: "home" },
      { name: "Invisibility Spell", level: 4, maxLevel: 4, village: "home" }
    ],
    labels: [
      { id: 57000001, name: "Base Designing", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png" } },
      { id: 57000002, name: "Trophy Pushing", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png" } }
    ]
  },
  "#Q2R8Y9LL": {
    tag: "#Q2R8Y9LL",
    name: "ElixirQueen",
    townHallLevel: 15,
    expLevel: 212,
    trophies: 5420,
    bestTrophies: 5600,
    warStars: 1750,
    attackWins: 142,
    defenseWins: 18,
    builderHallLevel: 9,
    versusTrophies: 3950,
    bestVersusTrophies: 4100,
    role: "coLeader",
    warPreference: "in",
    donations: 12400,
    donationsReceived: 4500,
    clan: {
      tag: "#2PP2PP2P",
      name: "Nova Esports",
      clanLevel: 24,
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png"
      }
    },
    league: {
      id: 29000022,
      name: "Legend League",
      iconUrls: {
        small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png"
      }
    },
    achievements: [],
    heroes: [
      { name: "Barbarian King", level: 85, maxLevel: 90, village: "home" },
      { name: "Archer Queen", level: 90, maxLevel: 90, village: "home" },
      { name: "Grand Warden", level: 60, maxLevel: 65, village: "home" },
      { name: "Royal Champion", level: 35, maxLevel: 40, village: "home" }
    ],
    heroEquipment: [
      { name: "Giant Gauntlet", level: 15, maxLevel: 27, village: "home", heroName: "Barbarian King" },
      { name: "Rage Vial", level: 12, maxLevel: 18, village: "home", heroName: "Barbarian King" }
    ],
    troops: [
      { name: "Barbarian", level: 11, maxLevel: 12, village: "home" },
      { name: "Archer", level: 11, maxLevel: 12, village: "home" }
    ],
    spells: [],
    labels: [
      { id: 57000000, name: "Farming", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/9oZex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }
    ]
  }
};

const MOCK_WARS = {
  "#2PP2PP2P": {
    state: "inWar",
    teamSize: 15,
    preparationStartTime: "2026-05-27T08:00:00.000Z",
    startTime: "2026-05-27T12:00:00.000Z",
    endTime: "2026-05-28T12:00:00.000Z",
    clan: {
      tag: "#2PP2PP2P",
      name: "Nova Esports",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png",
        medium: "https://api-assets.clashofclans.com/badges/200/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png"
      },
      clanLevel: 24,
      attacks: 12,
      stars: 32,
      destructionPercentage: 94.5,
      members: [
        { tag: "#Y2CU0P8P", name: "ClashMaster", mapPosition: 1, townhallLevel: 16, attacks: [{ attackerTag: "#Y2CU0P8P", defenderTag: "#OPP11222", stars: 3, destructionPercentage: 100, order: 1 }] }
      ]
    },
    opponent: {
      tag: "#9QQQQQQP",
      name: "Intrepid Warriors",
      badgeUrls: {
        small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png",
        medium: "https://api-assets.clashofclans.com/badges/200/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png"
      },
      clanLevel: 22,
      attacks: 10,
      stars: 28,
      destructionPercentage: 88.2,
      members: [
        { tag: "#OPP11222", name: "ShadowNinja", mapPosition: 1, townhallLevel: 16, opponentAttacks: 1 }
      ]
    }
  }
};

const MOCK_CWL = {
  "#2PP2PP2P": {
    state: "inWar",
    season: "2026-05",
    clans: [
      { tag: "#2PP2PP2P", name: "Nova Esports", clanLevel: 24, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { tag: "#8U2RYV0Y", name: "Dark Elixir", clanLevel: 18, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { tag: "#CWL33333", name: "War Syndicate", clanLevel: 20, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { tag: "#CWL44444", name: "Alpha Squad", clanLevel: 16, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { tag: "#CWL55555", name: "Elite Kings", clanLevel: 22, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { tag: "#CWL66666", name: "Viking Storm", clanLevel: 19, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { tag: "#CWL77777", name: "Titan Hunters", clanLevel: 21, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { tag: "#CWL88888", name: "Phoenix Reborn", clanLevel: 17, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } }
    ],
    rounds: [
      { warTags: ["#ROUND1_WAR1", "#ROUND1_WAR2", "#ROUND1_WAR3", "#ROUND1_WAR4"] },
      { warTags: ["#ROUND2_WAR1", "#ROUND2_WAR2", "#ROUND2_WAR3", "#ROUND2_WAR4"] },
      { warTags: ["#ROUND3_WAR1", "#ROUND3_WAR2", "#ROUND3_WAR3", "#ROUND3_WAR4"] }
    ]
  }
};

const MOCK_LEADERBOARDS = {
  locations: [
    { id: 32000006, name: "International", isCountry: false },
    { id: 32000254, name: "United States", isCountry: true },
    { id: 32000107, name: "India", isCountry: true },
    { id: 32000085, name: "Germany", isCountry: true }
  ],
  clans: {
    32000006: [
      { rank: 1, tag: "#2PP2PP2P", name: "Nova Esports", clanLevel: 24, clanPoints: 61250, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { rank: 2, tag: "#LB_CLAN2", name: "Tribe Gaming", clanLevel: 22, clanPoints: 59800, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { rank: 3, tag: "#LB_CLAN3", name: "Queso Esports", clanLevel: 20, clanPoints: 58900, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { rank: 4, tag: "#LB_CLAN4", name: "Chiba Clan", clanLevel: 23, clanPoints: 57400, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { rank: 5, tag: "#LB_CLAN5", name: "Space Station", clanLevel: 19, clanPoints: 56900, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } }
    ],
    32000254: [
      { rank: 1, tag: "#8U2RYV0Y", name: "Dark Elixir", clanLevel: 18, clanPoints: 52100, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
      { rank: 2, tag: "#LB_US2", name: "USA Warriors", clanLevel: 17, clanPoints: 49800, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } },
      { rank: 3, tag: "#LB_US3", name: "Texas Outlaws", clanLevel: 19, clanPoints: 48500, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }
    ]
  },
  players: {
    32000006: [
      { rank: 1, tag: "#Y2CU0P8P", name: "ClashMaster", expLevel: 245, trophies: 6350, clan: { name: "Nova Esports" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } },
      { rank: 2, tag: "#LB_PL2", name: "Klaus", expLevel: 238, trophies: 6290, clan: { name: "Tribe Gaming" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } },
      { rank: 3, tag: "#LB_PL3", name: "Synthe", expLevel: 230, trophies: 6245, clan: { name: "Queso Esports" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } },
      { rank: 4, tag: "#LB_PL4", name: "Gaku", expLevel: 240, trophies: 6190, clan: { name: "Chiba Clan" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } }
    ],
    32000254: [
      { rank: 1, tag: "#LB_USPL1", name: "US_Patriot", expLevel: 210, trophies: 5900, clan: { name: "Dark Elixir" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } },
      { rank: 2, tag: "#LB_USPL2", name: "CowboyClasher", expLevel: 198, trophies: 5750, clan: { name: "Texas Outlaws" }, league: { iconUrls: { small: "https://api-assets.clashofclans.com/leagues/72/R2zmhyXTmgu1qTvSO1IyidxOkPkec4GgQbua3gip-Oo.png" } } }
    ]
  }
};

const MOCK_WAR_LOG = {
  "#2PP2PP2P": {
    items: [
      { result: "win", opponent: { tag: "#OPP1", name: "War Machine", clanLevel: 20, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }, clan: { stars: 45, destructionPercentage: 100 }, opponentResult: { stars: 41, destructionPercentage: 92.5 }, endTime: "2026-05-25T14:00:00Z" },
      { result: "win", opponent: { tag: "#OPP2", name: "Red Dragons", clanLevel: 19, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } }, clan: { stars: 43, destructionPercentage: 98.2 }, opponentResult: { stars: 43, destructionPercentage: 96.5 }, endTime: "2026-05-23T16:30:00Z" },
      { result: "lose", opponent: { tag: "#OPP3", name: "Spartans", clanLevel: 25, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }, clan: { stars: 40, destructionPercentage: 91.4 }, opponentResult: { stars: 42, destructionPercentage: 95.0 }, endTime: "2026-05-21T18:00:00Z" },
      { result: "win", opponent: { tag: "#OPP4", name: "Eternal Flame", clanLevel: 21, badgeUrls: { small: "https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png" } }, clan: { stars: 45, destructionPercentage: 100 }, opponentResult: { stars: 38, destructionPercentage: 86.8 }, endTime: "2026-05-19T20:00:00Z" }
    ]
  }
};

const MOCK_CAPITAL_RAIDS = {
  "#2PP2PP2P": {
    items: [
      {
        state: "ended",
        startDate: "2026-05-22T07:00:00Z",
        endDate: "2026-05-25T07:00:00Z",
        totalLoot: 145200,
        completedRaids: 18,
        attackCount: 108,
        members: [
          { name: "ClashMaster", attacks: 6, capitalResourcesLooted: 24500 },
          { name: "ElixirQueen", attacks: 6, capitalResourcesLooted: 22800 },
          { name: "DarkKnight", attacks: 6, capitalResourcesLooted: 21000 }
        ]
      },
      {
        state: "ended",
        startDate: "2026-05-15T07:00:00Z",
        endDate: "2026-05-18T07:00:00Z",
        totalLoot: 138600,
        completedRaids: 17,
        attackCount: 102,
        members: [
          { name: "ClashMaster", attacks: 6, capitalResourcesLooted: 21000 }
        ]
      }
    ]
  }
};

const MOCK_GOLD_PASS = {
  startTime: "2026-05-01T00:00:00Z",
  endTime: "2026-06-01T00:00:00Z",
  rewards: [
    { type: "skin", name: "Goblin Queen Skin", points: 2600 },
    { type: "book", name: "Book of Everything", points: 2000 },
    { type: "rune", name: "Rune of Gold", points: 1600 }
  ]
};

const MOCK_LABELS = {
  clans: [
    { id: 56000000, name: "Clan Wars", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png" } },
    { id: 56000001, name: "Clan Games", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png" } },
    { id: 56000002, name: "Active Donator", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/9oZex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } }
  ],
  players: [
    { id: 57000000, name: "Farming", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/9oZex8Tz75j8GgNlG2aLd4R18D80F124e_0.png" } },
    { id: 57000001, name: "Base Designing", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png" } },
    { id: 57000002, name: "Trophy Pushing", iconUrls: { small: "https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png" } }
  ]
};

const MOCK_LAYOUT_GALLERY = [
  { id: 1, thLevel: 16, type: 'war', description: 'Anti-3 Star Ring Base - TH16 Meta', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH16-War-Ring', author: 'ClashMaster', votes: 342, createdAt: '2026-05-20T10:00:00Z' },
  { id: 2, thLevel: 16, type: 'home', description: 'Trophy Push Island Base - Legend League', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH16-Home-Island', author: 'ElixirQueen', votes: 218, createdAt: '2026-05-18T14:30:00Z' },
  { id: 3, thLevel: 15, type: 'war', description: 'Anti-Queen Charge Compact Base', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH15-War-Compact', author: 'DarkKnight', votes: 195, createdAt: '2026-05-15T08:00:00Z' },
  { id: 4, thLevel: 15, type: 'cwl', description: 'CWL Teaser Base - Bait Infernos', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH15-CWL-Teaser', author: 'GoblinKing', votes: 167, createdAt: '2026-05-12T16:00:00Z' },
  { id: 5, thLevel: 14, type: 'war', description: 'Southern Teaser Anti-Lavaloon', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH14-War-South', author: 'ElectroStorm', votes: 143, createdAt: '2026-05-10T12:00:00Z' },
  { id: 6, thLevel: 14, type: 'home', description: 'Farming Crows Base - Max DE Protection', link: 'https://link.clashofclans.com/en?action=OpenLayout&id=TH14-Home-Crows', author: 'GrandWarlock', votes: 128, createdAt: '2026-05-08T09:00:00Z' }
];

const MOCK_CLAN_SEARCH_RESULTS = {
  items: [
    { tag: '#2PP2PP2P', name: 'Nova Esports', type: 'inviteOnly', members: 48, clanLevel: 24, clanPoints: 48950, warWins: 654, warFrequency: 'always', badgeUrls: { small: 'https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png', medium: 'https://api-assets.clashofclans.com/badges/200/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png' }, labels: [{ name: 'Clan Wars', iconUrls: { small: 'https://api-assets.clashofclans.com/labels/64/lXaocg2Pt1_C2y1ZyZBNcoLxrOC5697YodO2od7NZUs.png' }}] },
    { tag: '#8U2RYV0Y', name: 'Dark Elixir', type: 'inviteOnly', members: 35, clanLevel: 18, clanPoints: 34500, warWins: 322, warFrequency: 'twiceAWeek', badgeUrls: { small: 'https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png', medium: 'https://api-assets.clashofclans.com/badges/200/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png' }, labels: [{ name: 'Clan Games', iconUrls: { small: 'https://api-assets.clashofclans.com/labels/64/up340Z5v5z6Fe0cl3zb9zS48eXG4u1G5Zq-Op_7OoE.png' }}] },
    { tag: '#NOVA1234', name: 'Nova Academy', type: 'open', members: 42, clanLevel: 15, clanPoints: 31200, warWins: 198, warFrequency: 'always', badgeUrls: { small: 'https://api-assets.clashofclans.com/badges/70/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png', medium: 'https://api-assets.clashofclans.com/badges/200/4n907wz4IqgW-JpA6tWnUq8pU08VzFq0832J4mD5d_0.png' }, labels: [] },
    { tag: '#NOVA5678', name: 'Nova Rising', type: 'inviteOnly', members: 28, clanLevel: 12, clanPoints: 24800, warWins: 145, warFrequency: 'always', badgeUrls: { small: 'https://api-assets.clashofclans.com/badges/70/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png', medium: 'https://api-assets.clashofclans.com/badges/200/u32qC3wKj2Vex8Tz75j8GgNlG2aLd4R18D80F124e_0.png' }, labels: [] }
  ]
};

// Backward-compatible individual window assignments
window.MOCK_CLANS = MOCK_CLANS;
window.MOCK_PLAYERS = MOCK_PLAYERS;
window.MOCK_WARS = MOCK_WARS;
window.MOCK_CWL = MOCK_CWL;
window.MOCK_LEADERBOARDS = MOCK_LEADERBOARDS;
window.MOCK_WAR_LOG = MOCK_WAR_LOG;
window.MOCK_CAPITAL_RAIDS = MOCK_CAPITAL_RAIDS;
window.MOCK_GOLD_PASS = MOCK_GOLD_PASS;
window.MOCK_LABELS = MOCK_LABELS;
window.MOCK_LAYOUT_GALLERY = MOCK_LAYOUT_GALLERY;
window.MOCK_CLAN_SEARCH_RESULTS = MOCK_CLAN_SEARCH_RESULTS;

// Unified namespace
window.MOCK_DATA = {
  clans: MOCK_CLANS,
  players: MOCK_PLAYERS,
  wars: MOCK_WARS,
  cwl: MOCK_CWL,
  leaderboards: MOCK_LEADERBOARDS,
  warLog: MOCK_WAR_LOG,
  capitalRaids: MOCK_CAPITAL_RAIDS,
  goldPass: MOCK_GOLD_PASS,
  labels: MOCK_LABELS,
  layoutGallery: MOCK_LAYOUT_GALLERY,
  clanSearchResults: MOCK_CLAN_SEARCH_RESULTS
};
