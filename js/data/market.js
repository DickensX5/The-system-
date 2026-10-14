// Market configuration: price rules and the Rare Exchange recipes. Local, offline economy only.
import { ITEM_BY_ID, currencyOf } from './rewards.js';

export const BUY_MULT = 3;                    // buy price = sell value x 3
export const buyPrice = (item) => item.value * BUY_MULT;
export const sellPrice = (item) => item.value;
export const isShopItem = (item) => item.shop !== false && item.binding !== 'bound' && item.kind !== 'certificate' && item.kind !== 'currency' && !item.effect;

// Rare Exchange needs a Royal Invitation in the inventory (not consumed). Romance items only.
export const EXCHANGE_PASS = 'rom_royal-invitation';
export const EXCHANGE = [
  { id: 'x-key', give: [['rom_charm-fragment', 5]], get: ['rom_lootbox-key', 1] },
  { id: 'x-moonlit', give: [['rom_heart-crystal', 3]], get: ['rom_moonlit-rose', 1] },
  { id: 'x-crown', give: [['rom_rare-title-fragment', 3]], get: ['rom_heartbound-crown', 1] },
  { id: 'x-goldkey', give: [['rom_golden-rose-petal', 4]], get: ['rom_golden-heart-key', 1] },
  { id: 'x-celestial', give: [['rom_moonlit-rose', 2], ['rom_echo-of-kindness', 2]], get: ['rom_celestial-rose', 1] },
  { id: 'x-sovereign', give: [['rom_celestial-rose', 2], ['rom_eternal-rose', 1]], get: ['rom_heart-sovereign-crest', 1] },
].map((o) => ({ ...o, give: o.give.map(([id, n]) => ({ id, n })), get: { id: o.get[0], n: o.get[1] } }));
for (const o of EXCHANGE) for (const x of [...o.give, o.get]) if (!ITEM_BY_ID[x.id]) throw new Error('Exchange references missing item ' + x.id);
export { currencyOf };
