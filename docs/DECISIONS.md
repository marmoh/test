# Journal des décisions

Chaque écart par rapport aux valeurs de départ de `SPEC.md` est consigné ici (date, quoi, pourquoi, mesure des bots).

| # | Date | Sujet | Décision | Raison |
|---|---|---|---|---|
| 1 | 2026-11-04 | Simulation | Pas fixe 1/30 s, RNG mulberry32 à graine, flux séparés (combat, pouvoirs, bot). | Déterminisme TS ↔ Swift, rejeu. |
| 2 | 2026-11-04 | Haies | Les haies bloquent aussi le déplacement au sol (pas les volants) et la ligne de vue du héros vers les cibles au sol. | La SPEC ne précise que projectiles/vue ; une haie franchissable à pied n'aurait aucun rôle tactique. |
| 3 | 2026-11-04 | Pouvoirs | La SPEC annonce 24 pouvoirs mais en liste 22. Ajout de **Tirs latéraux** (Tir) et **Déflagration** (Éléments). Raretés : 12 communs, 8 rares, 4 épiques. | Respecter le total de 24. |
| 4 | 2026-11-04 | Pouvoirs cumulables | Multitir ×2, Cadence/Dégâts/PV max ×3, Critique ×2, Vitesse ×2 ; les autres uniques. | Éviter les offres mortes et les cumuls absurdes. |
| 5 | 2026-11-04 | Dégâts des projectiles ennemis | Non chiffrés dans la SPEC : pierre 80, spore 60, flèche 70, totem 60, flaque 60/0,5 s, boss 90–100 (×1,5 pour l'onde de choc). | Valeurs de départ, ajustées par les bots. |
| 6 | 2026-11-04 | Ordre de déblocage | Gobelin (ch.1), Gelée (3), Chauve-souris (5), Champignon (7), Loup (9), Squelette (11), Totem (13), Mage (15). | « 1 nouveau type tous les 2 chapitres ». |
| 7 | 2026-11-04 | Élites | Attaque bonus commune : anneau lent de 8 projectiles télégraphié 0,6 s, toutes les 4,5 s. Coût budget supplémentaire 1,2 × coût. | Lisible et uniforme. |
| 8 | 2026-11-04 | Orbes de soin | 8 % de chance par ennemi, 4 % PV max ; ramassés automatiquement à la fin de la salle ; l'Aimant les attire en combat (+50 %). | Donner un rôle à « Aimant à soins ». |
| 9 | 2026-11-04 | Boss et générateur | Le facteur de budget du générateur s'applique aussi aux PV du boss. | Sinon les niveaux boss n'ont aucun levier d'ajustement. |
