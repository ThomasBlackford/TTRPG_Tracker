// A starter bestiary of common SRD creatures so a fight can be set up in two
// clicks. Values are the SRD's standard (average HP) figures — check them
// against your own book when it matters. Anything custom goes in "My monsters"
// (saved in the campaign database).
export interface BuiltInMonster {
  name: string
  cr: string
  ac: number
  hp: number
  init: number // initiative modifier (Dexterity)
  xp: number
  // Boss-fight extras, where the creature has them.
  legendary?: number // legendary actions per round
  legres?: number // legendary resistances per day
  recharges?: { name: string; min: number }[]
  lair?: boolean
  notes?: string // a short working summary — check your book for the full text
}

export const BUILT_IN_MONSTERS: BuiltInMonster[] = [
  { name: 'Commoner', cr: '0', ac: 10, hp: 4, init: 0, xp: 10 },
  { name: 'Kobold', cr: '1/8', ac: 12, hp: 5, init: 2, xp: 25 },
  { name: 'Giant Rat', cr: '1/8', ac: 12, hp: 7, init: 2, xp: 25 },
  { name: 'Bandit', cr: '1/8', ac: 12, hp: 11, init: 1, xp: 25 },
  { name: 'Cultist', cr: '1/8', ac: 12, hp: 9, init: 1, xp: 25 },
  { name: 'Guard', cr: '1/8', ac: 16, hp: 11, init: 1, xp: 25 },
  { name: 'Noble', cr: '1/8', ac: 15, hp: 9, init: 1, xp: 25 },
  { name: 'Stirge', cr: '1/8', ac: 14, hp: 2, init: 3, xp: 25 },
  { name: 'Goblin', cr: '1/4', ac: 15, hp: 7, init: 2, xp: 50 },
  { name: 'Skeleton', cr: '1/4', ac: 13, hp: 13, init: 2, xp: 50 },
  { name: 'Zombie', cr: '1/4', ac: 8, hp: 22, init: -2, xp: 50 },
  { name: 'Wolf', cr: '1/4', ac: 13, hp: 11, init: 2, xp: 50 },
  { name: 'Dretch', cr: '1/4', ac: 11, hp: 18, init: 0, xp: 50 },
  { name: 'Hobgoblin', cr: '1/2', ac: 18, hp: 11, init: 1, xp: 100 },
  { name: 'Orc', cr: '1/2', ac: 13, hp: 15, init: 1, xp: 100 },
  { name: 'Gnoll', cr: '1/2', ac: 15, hp: 22, init: 1, xp: 100 },
  { name: 'Worg', cr: '1/2', ac: 13, hp: 26, init: 1, xp: 100 },
  { name: 'Thug', cr: '1/2', ac: 11, hp: 32, init: 0, xp: 100 },
  { name: 'Scout', cr: '1/2', ac: 13, hp: 16, init: 2, xp: 100 },
  { name: 'Lizardfolk', cr: '1/2', ac: 15, hp: 22, init: 0, xp: 100 },
  { name: 'Cockatrice', cr: '1/2', ac: 11, hp: 27, init: 1, xp: 100 },
  { name: 'Shadow', cr: '1/2', ac: 12, hp: 16, init: 2, xp: 100 },
  { name: 'Ghoul', cr: '1', ac: 12, hp: 22, init: 2, xp: 200 },
  { name: 'Giant Spider', cr: '1', ac: 14, hp: 26, init: 3, xp: 200 },
  { name: 'Dire Wolf', cr: '1', ac: 14, hp: 37, init: 2, xp: 200 },
  { name: 'Brown Bear', cr: '1', ac: 11, hp: 34, init: 0, xp: 200 },
  { name: 'Bugbear', cr: '1', ac: 16, hp: 27, init: 2, xp: 200 },
  { name: 'Harpy', cr: '1', ac: 11, hp: 38, init: 1, xp: 200 },
  { name: 'Specter', cr: '1', ac: 12, hp: 22, init: 2, xp: 200 },
  { name: 'Quasit', cr: '1', ac: 13, hp: 7, init: 3, xp: 200 },
  { name: 'Animated Armor', cr: '1', ac: 18, hp: 33, init: 0, xp: 200 },
  { name: 'Bandit Captain', cr: '2', ac: 15, hp: 65, init: 2, xp: 450 },
  { name: 'Ogre', cr: '2', ac: 11, hp: 59, init: -1, xp: 450 },
  { name: 'Gelatinous Cube', cr: '2', ac: 6, hp: 84, init: -2, xp: 450 },
  { name: 'Mimic', cr: '2', ac: 12, hp: 58, init: 1, xp: 450 },
  { name: 'Ankheg', cr: '2', ac: 14, hp: 39, init: 0, xp: 450 },
  { name: 'Gargoyle', cr: '2', ac: 15, hp: 52, init: 0, xp: 450 },
  { name: 'Carrion Crawler', cr: '2', ac: 13, hp: 51, init: 1, xp: 450 },
  { name: 'Griffon', cr: '2', ac: 12, hp: 59, init: 2, xp: 450 },
  { name: 'Priest', cr: '2', ac: 13, hp: 27, init: 0, xp: 450 },
  { name: 'Owlbear', cr: '3', ac: 13, hp: 59, init: 1, xp: 700 },
  { name: 'Wight', cr: '3', ac: 14, hp: 45, init: 2, xp: 700 },
  { name: 'Hell Hound', cr: '3', ac: 15, hp: 45, init: 1, xp: 700 },
  { name: 'Minotaur', cr: '3', ac: 14, hp: 76, init: 0, xp: 700 },
  { name: 'Manticore', cr: '3', ac: 14, hp: 68, init: 3, xp: 700 },
  { name: 'Basilisk', cr: '3', ac: 15, hp: 52, init: -1, xp: 700 },
  { name: 'Displacer Beast', cr: '3', ac: 13, hp: 85, init: 2, xp: 700 },
  { name: 'Veteran', cr: '3', ac: 17, hp: 58, init: 1, xp: 700 },
  { name: 'Knight', cr: '3', ac: 18, hp: 52, init: 0, xp: 700 },
  { name: 'Ghost', cr: '4', ac: 11, hp: 45, init: 1, xp: 1100 },
  { name: 'Troll', cr: '5', ac: 15, hp: 84, init: 1, xp: 1800 },
  { name: 'Wraith', cr: '5', ac: 13, hp: 67, init: 3, xp: 1800 },
  { name: 'Hill Giant', cr: '5', ac: 13, hp: 105, init: -1, xp: 1800 },
  { name: 'Vampire Spawn', cr: '5', ac: 15, hp: 82, init: 3, xp: 1800 },
  { name: 'Bulette', cr: '5', ac: 17, hp: 94, init: 0, xp: 1800 },
  { name: 'Fire Elemental', cr: '5', ac: 13, hp: 102, init: 3, xp: 1800 },
  { name: 'Mage', cr: '6', ac: 12, hp: 40, init: 2, xp: 2300 },
  { name: 'Wyvern', cr: '6', ac: 13, hp: 110, init: 0, xp: 2300 },
  { name: 'Chimera', cr: '6', ac: 14, hp: 114, init: 0, xp: 2300 },
  { name: 'Medusa', cr: '6', ac: 15, hp: 127, init: 2, xp: 2300 },
  { name: 'Mind Flayer', cr: '7', ac: 15, hp: 71, init: 1, xp: 2900, notes: 'Mind Blast (recharge 5-6): 60 ft cone, INT save DC 15 or 5d8+4 psychic and stunned. Tentacles: extract brain on a stunned grappled target.' },
  { name: 'Hydra', cr: '8', ac: 15, hp: 172, init: 1, xp: 3900, notes: 'Five heads: bite each. Gains two heads when it loses 25+ damage in a turn; heads regrow unless burned.' },
  { name: 'Frost Giant', cr: '8', ac: 15, hp: 138, init: -1, xp: 3900 },
  { name: 'Young Green Dragon', cr: '8', ac: 18, hp: 136, init: 1, xp: 3900, recharges: [{ name: 'Poison Breath', min: 5 }], notes: 'Poison Breath: 30 ft cone, CON save DC 14, 12d6 poison. Multiattack: bite + 2 claws.' },
  { name: 'Fire Giant', cr: '9', ac: 18, hp: 162, init: -1, xp: 5000 },
  { name: 'Aboleth', cr: '10', ac: 17, hp: 135, init: -1, xp: 5900, legendary: 3, lair: true, notes: 'Tentacle (disease), Tail, Enslave (3/day). Legendary: Detect, Tail Swipe, Psychic Drain (costs 2).' },
  { name: 'Young Red Dragon', cr: '10', ac: 18, hp: 178, init: 0, xp: 5900, recharges: [{ name: 'Fire Breath', min: 5 }], notes: 'Fire Breath: 30 ft cone, DEX save DC 17, 16d6 fire. Multiattack: bite + 2 claws.' },
  { name: 'Vampire', cr: '13', ac: 16, hp: 144, init: 4, xp: 10000, legendary: 3, legres: 3, lair: true, notes: 'Regeneration 20 (not in sunlight or running water). Bite drains max HP. Charm. Shapechanger. Legendary: Move, Unarmed Strike, Bite (costs 2).' },
  { name: 'Beholder', cr: '13', ac: 18, hp: 180, init: 2, xp: 10000, legendary: 3, lair: true, notes: 'Antimagic cone from its central eye. Ten eye rays (3 per turn). Legendary: Eye Ray (costs 1 each).' },
  { name: 'Mummy Lord', cr: '15', ac: 17, hp: 97, init: 0, xp: 13000, legendary: 3, legres: 3, lair: true, notes: 'Rotting fist (mummy rot), Dreadful Glare. Casts cleric spells. Legendary: Attack, Blinding Dust, Blasphemous Word, Channel Negative Energy, Whirlwind of Sand.' },
  { name: 'Adult Blue Dragon', cr: '16', ac: 19, hp: 225, init: 0, xp: 15000, legendary: 3, legres: 3, lair: true, recharges: [{ name: 'Lightning Breath', min: 5 }], notes: 'Lightning Breath: 90 ft line, DEX save DC 19, 12d10 lightning. Multiattack: frightful presence, bite, 2 claws. Legendary: Detect, Tail Attack, Wing Attack (costs 2).' },
  { name: 'Assassin', cr: '8', ac: 15, hp: 78, init: 3, xp: 3900 },
  { name: 'Adult Red Dragon', cr: '17', ac: 19, hp: 256, init: 0, xp: 18000, legendary: 3, legres: 3, lair: true, recharges: [{ name: 'Fire Breath', min: 5 }], notes: 'Fire Breath: 60 ft cone, DEX save DC 21, 18d6 fire. Multiattack: frightful presence, bite, 2 claws. Legendary: Detect, Tail Attack, Wing Attack (costs 2).' },
  { name: 'Lich', cr: '21', ac: 17, hp: 135, init: 3, xp: 33000, legendary: 3, legres: 3, lair: true, notes: 'Casts as an 18th-level wizard. Paralyzing Touch. Rejuvenation via phylactery. Legendary: Cantrip, Paralyzing Touch (costs 2), Frightening Gaze (costs 2), Disrupt Life (costs 3).' }
]
