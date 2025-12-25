# NEXUS Perks Reference (from old Ko-Fi tiers)

## Old Ko-Fi Tiers (DELETED - now just gem packs)

### Tier 1: Supporter - was $3/month
- Supporter badge
- +15% gold from battles
- Access to Supporter Shop
- +5 daily gems (150 bonus gems/month)
- +25% bonus gems on gem pack purchases
- Ad-free

### Tier 2: Champion - was $5/month
Everything from Tier 1, PLUS:
- +20% gold from battles (replaces 15%)
- Golden name color
- 1 free title of choice (under 1000 gems)
- +10 daily gems (300 bonus gems/month)
- +50% bonus gems on gem pack purchases

### Tier 3: Legend - was $10/month
Everything from Tier 2, PLUS:
- +25% gold from battles (replaces 20%)
- Unique border/effects
- 2 free titles of choice (any price)
- Map locations unlock (future)
- +15 daily gems (450 bonus gems/month)
- +75% bonus gems on gem pack purchases

---

## New Model: Gem-Based Store Perks

### Ko-Fi = Gem Packs Only
| Pack | Price | Gems | Bonus |
|------|-------|------|-------|
| Starter | $1 | 100 | - |
| Small | $3 | 350 | +17% |
| Medium | $5 | 650 | +30% |
| Large | $10 | 1,500 | +50% |
| Mega | $20 | 3,500 | +75% |

### Store Perks (buy with gems)

#### Status Badges
| Perk | Monthly | Own Forever |
|------|---------|-------------|
| Supporter Badge | 50 | 400 |
| Champion Badge | 100 | 800 |
| Legend Badge | 200 | 1,500 |

#### Combat Boosts
| Perk | Monthly | Own Forever |
|------|---------|-------------|
| Gold Boost +15% | 60 | 500 |
| Gold Boost +20% | 100 | 800 |
| Gold Boost +25% | 150 | 1,200 |

#### Daily Bonuses (subscription only)
| Perk | Monthly |
|------|---------|
| Daily Gems +5 | 80 |
| Daily Gems +10 | 150 |
| Daily Gems +15 | 200 |

#### Cosmetic Upgrades
| Perk | Monthly | Own Forever |
|------|---------|-------------|
| Ad-Free | 50 | 400 |
| Golden Name | 75 | 600 |
| Unique Border | 150 | 1,200 |
| Shop Access | 30 | 200 |

#### One-Time Tokens
| Item | Cost |
|------|------|
| Title Token (under 100 gems) | 80 |
| Title Token (under 500 gems) | 400 |
| Title Token (any) | 800 |

---

## Implementation Notes
- Ko-Fi webhook → add gems to Supabase profiles.gems
- Store purchases deduct from gems, add to inventory
- Rentals have expiry dates
- "Own forever" = 8x monthly price (good deal)
