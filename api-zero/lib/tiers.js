'use strict';
// Plan & batasannya. price dalam Rupiah per 30 hari. daily = request per hari (WIB).
//   rank       : urutan plan; endpoint dengan plan X bisa dipakai user dengan rank >= rank X.
//   maxKeys    : jumlah API key maksimal (Infinity = tanpa batas).
//   customKey  : boleh bikin API key sendiri (custom).
//   hidden     : tidak ditampilkan di halaman harga (developer).
const TIERS = [
  { id: 'free',      name: 'Free',      price: 0,     daily: 100,      maxKeys: 1,        customKey: false, rank: 0, perks: ['100 request/hari', '1 API key', 'Endpoint gratis'] },
  { id: 'basic',     name: 'Basic',     price: 5000,  daily: 1000,     maxKeys: 3,        customKey: false, rank: 1, perks: ['1.000 request/hari', '3 API key', 'Tanpa custom key'] },
  { id: 'premium',   name: 'Premium',   price: 10000, daily: 5000,     maxKeys: 5,        customKey: true,  rank: 2, perks: ['5.000 request/hari', '5 API key', 'Custom API key', 'Buka endpoint Premium'] },
  { id: 'super',     name: 'Super',     price: 15000, daily: 10000,    maxKeys: 10,       customKey: true,  rank: 3, perks: ['10.000 request/hari', '10 API key', 'Custom API key', 'Fitur plan Premium + Super'] },
  { id: 'nebula',    name: 'Nebula',    price: 20000, daily: 20000,    maxKeys: 25,       customKey: true,  rank: 4, perks: ['20.000 request/hari', '25 API key', 'Custom API key', 'Semua fitur plan Premium s/d Nebula'] },
  { id: 'freedom',   name: 'Freedom',   price: 25000, daily: 50000,    maxKeys: Infinity, customKey: true,  rank: 5, perks: ['50.000 request/hari', 'API key tanpa batas', 'Custom API key', 'Unlock semua endpoint'] },
  { id: 'developer', name: 'Developer', price: 0,     daily: Infinity, maxKeys: Infinity, customKey: true,  rank: 9, hidden: true, perks: ['Finansial freedom: unlock all'] }
];
const BY_ID = Object.fromEntries(TIERS.map(t => [t.id, t]));
const PLAN_DAYS = Number(process.env.PLAN_DAYS || 30);
// Plan yang bisa dipasang di endpoint (siapa yang boleh memakainya).
const ENDPOINT_PLANS = ['free', 'basic', 'premium', 'super', 'nebula', 'freedom'];

const tier = id => BY_ID[id] || BY_ID.free;
const isPaid = id => id !== 'free' && id !== 'developer';

// Plan efektif: plan berbayar yang sudah lewat masa aktifnya kembali ke free.
function effectiveTier(user) {
  if (!user) return BY_ID.free;
  if (isPaid(user.tier) && user.tier_expires_at && new Date(user.tier_expires_at) < new Date()) return BY_ID.free;
  return tier(user.tier);
}
const canUse = (user, plan) => effectiveTier(user).rank >= tier(plan || 'free').rank;
const publicTiers = () => TIERS.filter(t => !t.hidden).map(t => ({ ...t, maxKeys: t.maxKeys === Infinity ? null : t.maxKeys, daily: t.daily === Infinity ? null : t.daily }));

module.exports = { TIERS, BY_ID, PLAN_DAYS, ENDPOINT_PLANS, tier, isPaid, effectiveTier, canUse, publicTiers };
