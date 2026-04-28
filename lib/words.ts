import { WordPair } from './types';

// ============================================================
// WORD POOLS — each category has a pool of related words.
// Any 2 words from the same pool can form a pair.
// Roles (sudlat/imposter) are randomly assigned each round.
// ============================================================

export const WORD_POOLS: Record<string, string[]> = {
  // Nature
  'Nature':       ['Coconut', 'Cactus', 'Bamboo', 'Coral', 'Seaweed', 'Tree', 'Flower', 'Mushroom'],
  'Landforms':    ['Volcano', 'Mountain', 'Desert', 'Rainforest', 'Canyon', 'Island', 'Valley', 'Cliff'],
  'Water Bodies': ['Lake', 'River', 'Ocean', 'Pond', 'Waterfall', 'Creek', 'Swamp'],
  'Weather':      ['Hurricane', 'Tornado', 'Rain', 'Snow', 'Storm', 'Hail', 'Thunder', 'Wind'],
  'Space':        ['Sun', 'Moon', 'Star', 'Comet', 'Meteor', 'Planet', 'Asteroid'],
  'Elements':     ['Fire', 'Smoke', 'Rock', 'Sand', 'Ice', 'Lava', 'Dust'],

  // Sports
  'Combat Sports':    ['Boxing', 'Wrestling', 'Karate', 'Fencing', 'Judo', 'Taekwondo'],
  'Racket Sports':    ['Tennis', 'Badminton', 'Table Tennis', 'Squash'],
  'Team Sports':      ['Basketball', 'Football', 'Volleyball', 'Baseball', 'Soccer', 'Rugby'],
  'Water Sports':     ['Swimming', 'Diving', 'Surfing', 'Kayaking', 'Water Polo'],
  'Board Games':      ['Chess', 'Checkers', 'Scrabble', 'Monopoly', 'Uno'],
  'Endurance Sports': ['Running', 'Cycling', 'Marathon', 'Triathlon'],
  'Target Sports':    ['Golf', 'Bowling', 'Archery', 'Darts', 'Billiards'],

  // Food
  'Fast Food':   ['Pizza', 'Burger', 'Hotdog', 'Taco', 'Fries', 'Shawarma'],
  'Staple Food': ['Rice', 'Bread', 'Noodles', 'Pasta', 'Potato', 'Corn'],
  'Meat':        ['Chicken', 'Beef', 'Pork', 'Lamb', 'Fish', 'Turkey'],
  'Desserts':    ['Cake', 'Ice Cream', 'Halo-halo', 'Sundae', 'Brownie', 'Donut', 'Pie'],
  'Beverages':   ['Juice', 'Smoothie', 'Coffee', 'Tea', 'Milkshake', 'Soda'],
  'Condiments':  ['Vinegar', 'Soy Sauce', 'Ketchup', 'Mustard', 'Hot Sauce', 'Mayo'],
  'Sweets':      ['Chocolate', 'Candy', 'Marshmallow', 'Gummy Bear', 'Lollipop'],

  // Animals
  'Pets':           ['Cat', 'Dog', 'Hamster', 'Rabbit', 'Goldfish', 'Parrot'],
  'Wild Animals':   ['Lion', 'Tiger', 'Bear', 'Elephant', 'Wolf', 'Gorilla'],
  'Marine Animals': ['Dolphin', 'Shark', 'Whale', 'Octopus', 'Squid', 'Jellyfish'],
  'Farm Animals':   ['Horse', 'Cow', 'Rooster', 'Pig', 'Sheep', 'Donkey', 'Goat'],
  'Reptiles':       ['Snake', 'Lizard', 'Crocodile', 'Turtle', 'Gecko', 'Iguana'],
  'Primates':       ['Monkey', 'Gorilla', 'Chimpanzee', 'Orangutan'],
  'Birds':          ['Eagle', 'Owl', 'Parrot', 'Penguin', 'Flamingo', 'Crow'],
  'Insects':        ['Ant', 'Bee', 'Butterfly', 'Spider', 'Mosquito', 'Dragonfly'],

  // Technology
  'Wireless Tech':      ['Bluetooth', 'Wi-Fi', 'NFC', 'Hotspot', '5G'],
  'Computing Devices':  ['Laptop', 'PC', 'Tablet', 'Cellphone', 'Console', 'Smartwatch'],
  'Input Devices':      ['Keyboard', 'Mouse', 'Controller', 'Touchscreen', 'Microphone'],
  'Display Tech':       ['Monitor', 'TV', 'Projector', 'VR Headset'],
  'Audio Devices':      ['Speaker', 'Headphones', 'Earbuds', 'Microphone', 'Soundbar'],
  'Storage Devices':    ['USB', 'SD Card', 'Hard Drive', 'SSD', 'Cloud Storage'],
  'Cybersecurity':      ['VPN', 'Firewall', 'Antivirus', 'Encryption', 'Password'],
  'Scanning Tech':      ['QR Code', 'Barcode', 'Fingerprint', 'Face ID'],

  // Places
  'Transport Hubs': ['Airport', 'Train Station', 'Seaport', 'Bus Terminal'],
  'Healthcare':     ['Hospital', 'Clinic', 'Pharmacy', 'Dentist'],
  'Shopping':       ['Mall', 'Market', 'Supermarket', 'Convenience Store'],
  'Accommodation':  ['Hotel', 'Resort', 'Hostel', 'Airbnb', 'Motel'],
  'Recreation':     ['Park', 'Zoo', 'Museum', 'Arcade', 'Cinema', 'Beach'],
  'Food Places':    ['Restaurant', 'Cafe', 'Food Court', 'Bar', 'Bakery'],
  'Settlements':    ['City', 'Village', 'Town', 'Suburb'],
  'Education':      ['School', 'University', 'Library', 'Daycare'],

  // Objects
  'Furniture':     ['Bed', 'Couch', 'Chair', 'Table', 'Desk', 'Shelf', 'Cabinet'],
  'Kitchen Tools': ['Knife', 'Spoon', 'Fork', 'Pan', 'Pot', 'Whisk'],
  'Containers':    ['Bottle', 'Cup', 'Jar', 'Bowl', 'Thermos', 'Mug'],
  'Bags':          ['Backpack', 'Suitcase', 'Handbag', 'Wallet', 'Pouch'],
  'Lighting':      ['Candle', 'Lantern', 'Flashlight', 'Lamp', 'Torch'],
  'Time Devices':  ['Clock', 'Watch', 'Timer', 'Hourglass', 'Sundial'],
  'Weather Gear':  ['Umbrella', 'Raincoat', 'Jacket', 'Boots', 'Poncho'],
  'Eyewear':       ['Glasses', 'Goggles', 'Sunglasses', 'Contact Lens'],

  // Concepts
  'Emotions':        ['Happiness', 'Excitement', 'Fear', 'Anger', 'Sadness', 'Surprise'],
  'Relationships':   ['Love', 'Friendship', 'Rivalry', 'Trust', 'Loyalty'],
  'Aspirations':     ['Dream', 'Goal', 'Ambition', 'Hope', 'Vision'],
  'Outcomes':        ['Success', 'Failure', 'Victory', 'Defeat', 'Draw'],
  'Power Concepts':  ['Freedom', 'Power', 'Justice', 'Authority', 'Rights'],
  'Abstract Value':  ['Time', 'Money', 'Knowledge', 'Wisdom', 'Experience'],
  'Truth Concepts':  ['Truth', 'Lie', 'Secret', 'Rumor', 'Fact'],
  'Identity':        ['Camouflage', 'Disguise', 'Mask', 'Costume', 'Alias'],
};

// All category names for iteration
const CATEGORIES = Object.keys(WORD_POOLS);

// Per-room history to prevent recent repeats (roomId → pairKeys)
const roomHistory = new Map<string, string[]>();
const HISTORY_SIZE = 10;

/**
 * Create a unique key for a word pair (order-independent)
 */
function pairKey(category: string, w1: string, w2: string): string {
  const sorted = [w1, w2].sort();
  return `${category}::${sorted[0]}::${sorted[1]}`;
}

/**
 * Pick 2 random distinct words from an array
 */
function pickTwo(words: string[]): [string, string] {
  const i = Math.floor(Math.random() * words.length);
  let j = Math.floor(Math.random() * (words.length - 1));
  if (j >= i) j++;
  return [words[i], words[j]];
}

/**
 * Get a random word pair with history-aware selection.
 * - Picks a random category, then 2 random words from its pool
 * - Randomly swaps roles (50/50 who is sudlat vs imposter)
 * - Avoids recently used pairs for the given room
 * - Falls back gracefully if all pairs exhausted
 */
export function getRandomWordPair(roomId?: string): WordPair {
  const history = roomId ? (roomHistory.get(roomId) ?? []) : [];
  const historySet = new Set(history);

  // Shuffle categories to avoid bias
  const shuffledCategories = [...CATEGORIES].sort(() => Math.random() - 0.5);

  for (const category of shuffledCategories) {
    const pool = WORD_POOLS[category];
    if (pool.length < 2) continue;

    // Try up to 5 random pairs from this category
    for (let attempt = 0; attempt < 5; attempt++) {
      const [w1, w2] = pickTwo(pool);
      const key = pairKey(category, w1, w2);

      if (!historySet.has(key)) {
        // Randomly assign roles — 50/50 swap
        const swap = Math.random() < 0.5;
        const result: WordPair = {
          category,
          sudlat: swap ? w2 : w1,
          imposter: swap ? w1 : w2,
        };

        // Update history
        if (roomId) {
          history.push(key);
          if (history.length > HISTORY_SIZE) history.shift();
          roomHistory.set(roomId, history);
        }

        return result;
      }
    }
  }

  // Fallback: clear history and pick fresh (all pairs were recently used)
  if (roomId) roomHistory.delete(roomId);
  return getRandomWordPair(undefined);
}

/**
 * Clear history for a room (call on room deletion if needed)
 */
export function clearWordHistory(roomId: string): void {
  roomHistory.delete(roomId);
}