/**
 * pnpm bots:balance [--games 40]
 * §6 Test d'équilibrage : sur un panel de niveaux, le bot moyen est forcé de prendre chaque pouvoir
 * au premier choix. Aucun pouvoir ne doit dépasser la médiane de plus de 12 points de taux de réussite.
 * Écrit content/reports/powers.json (lu par levels:validate).
 */
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, POWERS } from '../../sim/src/index.js';
import { loadRooms, roomMap, loadLevel, writeReport } from './content-io.js';

const args = process.argv.slice(2);
const gi = args.indexOf('--games');
const GAMES = gi >= 0 ? Number(args[gi + 1]) : 40;
/** Panel : un niveau normal, un difficile et un boss par royaume (≥ 2 salles pour avoir un choix). */
const PANEL = [5, 7, 20, 65, 67, 80, 125, 127, 140, 185, 187, 200, 245, 247, 260];

const rooms = loadRooms();
const map = roomMap(rooms);
const levels = PANEL.map((n) => loadLevel(n) ?? generateLevel(n, 1, rooms));

const out: { id: string; name: string; rate: number }[] = [];
for (const p of POWERS) {
  let wins = 0;
  let total = 0;
  for (const l of levels) {
    for (let g = 0; g < GAMES; g++) {
      const r = runLevel(l, map, new Bot(BOTS.moyen, seedOf(g, 31)), { talents: talentsForLevel(l.n), attemptSeed: seedOf(g, 32), forceFirstPower: p.id });
      if (r.won) wins++;
      total++;
    }
  }
  out.push({ id: p.id, name: p.name, rate: Math.round((wins / total) * 10000) / 10000 });
  console.log(`${p.name.padEnd(18)} ${((wins / total) * 100).toFixed(1)} %`);
}
const sorted = out.map((o) => o.rate).sort((a, b) => a - b);
const median = (sorted[11] + sorted[12]) / 2;
writeReport('powers.json', JSON.stringify({ games: GAMES, panel: PANEL, median, powers: out }, null, 1) + '\n');
const over = out.filter((o) => o.rate - median > 0.12);
console.log(`médiane ${(median * 100).toFixed(1)} %`);
if (over.length) {
  console.error(`✗ au-dessus de +12 pts : ${over.map((o) => o.name).join(', ')}`);
  process.exit(1);
}
console.log('✓ aucun pouvoir au-dessus de +12 pts');
