/** pnpm rooms:check — valide les 24 gabarits (§3). */
import { validateRoom } from '../../sim/src/arena.js';
import { loadRooms } from './content-io.js';

const rooms = loadRooms();
let bad = 0;
for (const r of rooms) {
  const errs = validateRoom(r);
  if (errs.length) {
    bad++;
    console.error(`✗ ${r.id} : ${errs.join(' ; ')}`);
  }
}
if (rooms.length !== 24) {
  console.error(`✗ 24 gabarits attendus, ${rooms.length} trouvés`);
  bad++;
}
if (bad) process.exit(1);
console.log(`✓ ${rooms.length} gabarits valides`);
