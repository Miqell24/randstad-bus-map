// Wyznacza zakres mapy Randstadu z KRAJOWEGO feedu holenderskiego
// (gtfs.ovapi.nl, 3167 linii całego kraju) i zapisuje do data/scope.json:
//
//  Randstad to nie miasto z promieniem, tylko pas pięciu miast — Amsterdam,
//  Haarlem, Lejda, Haga i Rotterdam — więc zamiast koła używamy PROSTOKĄTA:
//   - rdzeń 51.78–52.52 N, 4.10–5.05 E (Zaandam i Purmerend na północy,
//     Dordrecht na południu, Hoek van Holland na zachodzie, Gouda i Alphen
//     na wschodzie; Utrecht 5.12 E i Almere 5.22 E świadomie poza kadrem —
//     to wschodnie skrzydło Randstadu, osobna aglomeracja);
//   - linia wchodzi, gdy >=50% jej przystanków leży w rdzeniu…
//   - …żaden nie wypada poza ramkę zewnętrzną 51.68–52.60 N, 3.95–5.08 E…
//   - …i żaden nie stoi w brabanckim narożniku (patrz NOTCH niżej).
//     Ta ramka JEST kadrem mapy i jednocześnie zasięgiem ekstraktów OSM, więc
//     żaden przystanek nie ląduje poza pobranymi kaflami. Odcina to ogony do
//     Utrechtu (5.11 E) i Hilversum (5.18 E) — wschodnie skrzydło Randstadu,
//     którego użytkownik nie zamawiał — oraz kursy w głąb Gelderlandu.
//
//  autobusy (3), tramwaje (0), metro (1). Poza mapą:
//   - kolej (2): feed nie daje numerów linii — NS nazywa każdy pociąg
//     „Intercity" albo „Sprinter", a numer serii (SPR4000) jest wewnętrzny
//     i nie ma go na peronie. Ta sama decyzja co przy „TÅG" w Göteborgu;
//   - promy (4): GVB-owskie F1–F22 przez IJ i Waterbus do Dordrechtu —
//     silnik nie ma grafu wodnego;
//   - Electrische Museumtramlijn Amsterdam (linia 30): zabytkowa,
//     niedzielna trasa muzealna, nie sieć komunikacyjna.
//
//  KLUCZE LINII. W Randstadzie jeżdżą TRZY niezależne sieci tramwajowe i
//  kilkanaście koncesji autobusowych, każda numerowana od 1 — „tramwaj 1"
//  to co innego w Amsterdamie, Hadze i Rotterdamie. Nie mają wspólnego
//  torowiska ani jezdni, więc na ulicy nic nie drukuje się dwa razy, ale w
//  jednym pliku muszą mieć różne klucze. Numer używany przez więcej niż
//  jednego przewoźnika dostaje w KLUCZU jego kod (a1, h1, r1…), a build.mjs
//  drukuje goły numer przez LBL — zasada z Rybnika. Panel grupuje listę po
//  przewoźniku, więc trzy „1" siedzą pod trzema nagłówkami.
//
// Uruchamiane przez download.sh po pobraniu GTFS; build.mjs wymaga wyniku.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iterCsv, readCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');

const CORE = { s: 51.78, n: 52.52, w: 4.10, e: 5.05 };
const OUTER = { s: 51.68, n: 52.60, w: 3.95, e: 5.08 };
const CORE_SHARE = 0.5;
// Prostokąt łapie jeszcze jeden narożnik, który Randstadem nie jest: Land van
// Heusden en Altena (Werkendam, Sleeuwijk, Woudrichem, Almkerk) leży za Boven-
// Merwede, w Brabancji Północnej — innej prowincji, więc i poza ekstraktami
// OSM, przez co obie tamtejsze linie Bravo i tak nie miały po czym się
// dopasować. Granicą jest sama rzeka i widać ją w danych: najdalej na północ
// wysunięty słupek brabancki to Sleeuwijk 51.8179, najdalej na południe
// zuidhollandzki — Boven-Hardinxveld 51.8197. Próg 51.819 leży w korycie.
// (Gorinchem, Hardinxveld i Giessenburg zostają — to Alblasserwaard.)
const NOTCH = (p) => p[0] < 51.819 && p[1] > 4.85;

// agency_name → krótki kod przewoźnika. Kod trafia do klucza tylko przy
// kolizji numerów i do meta.op, po którym panel grupuje listę linii.
const OP_CODE = [
  [/^GVB/i, 'gvb'], [/^HTM/i, 'htm'], [/^RET/i, 'ret'],
  [/^Connexxion/i, 'conn'], [/^MeerPlus/i, 'meer'], [/^Qbuzz/i, 'qbuzz'],
  [/^EBS/i, 'ebs'], [/^U-OV/i, 'uov'], [/^Transdev/i, 'tdev'],
  [/^Arriva/i, 'arriva'], [/^RRReis/i, 'rreis'], [/^Bravo/i, 'bravo'],
  [/^Waterbus/i, 'water'], [/^NS/i, 'ns'],
];
const opCode = (name) => {
  for (const [re, code] of OP_CODE) if (re.test(name)) return code;
  return (name || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 6) || 'other';
};

const t0 = Date.now();
const log = (m) => console.log(`[scope ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const agency = new Map();
for (const a of await readCsv(join(GD, 'agency.txt'))) agency.set(a.agency_id, (a.agency_name || '').trim());

const MODE_OF = { 3: 'bus', 0: 'tram', 1: 'metro' };
// „Stopbus/Snelbus ipv trein" to holenderska szynowa komunikacja zastępcza
// (dosłownie „autobus zamiast pociągu") — reguła pótló z Budapesztu.
const RAIL_BUS = /ipv trein/i;
// kursy na telefon: U-Flex, BestelBuzz, HopOn, OV op Maat — mają numer, nie
// mają trasy (to samo, co Närtrafiken w Göteborgu i Szwecji)
const ON_DEMAND = /\b(flex|bestelbuzz|hopon|ov op maat|ovom)\b/i;
const kind = new Map(), sname = new Map(), sop = new Map();
let skipped = { railbus: 0, demand: 0, museum: 0 };
for (const r of await readCsv(join(GD, 'routes.txt'))) {
  const m = MODE_OF[r.route_type];
  if (!m) continue;
  const an = agency.get(r.agency_id) || '';
  const sn = (r.route_short_name || '').trim(), ln = (r.route_long_name || '').trim();
  if (/Museumtram/i.test(an)) { skipped.museum++; continue; }   // linia 30, zabytkowa
  if (RAIL_BUS.test(ln) || RAIL_BUS.test(sn)) { skipped.railbus++; continue; }
  if (ON_DEMAND.test(ln) || ON_DEMAND.test(sn)) { skipped.demand++; continue; }
  kind.set(r.route_id, m);
  sname.set(r.route_id, sn);
  sop.set(r.route_id, opCode(an));
}
log(`odsiane u źródła: ${skipped.railbus} autobusów za pociąg, `
  + `${skipped.demand} kursów na telefon, ${skipped.museum} muzealnych`);
log(`kandydatów: ${[...kind.values()].filter((v) => v === 'bus').length} bus, `
  + `${[...kind.values()].filter((v) => v === 'tram').length} tram, `
  + `${[...kind.values()].filter((v) => v === 'metro').length} metro`);

const stopPos = new Map();
for await (const s of iterCsv(join(GD, 'stops.txt'))) {
  const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) stopPos.set(s.stop_id, [lat, lon]);
}
const t2r = new Map();
for await (const t of iterCsv(join(GD, 'trips.txt'))) {
  if (kind.has(t.route_id)) t2r.set(t.trip_id, t.route_id);
}
log(`kursów do zmierzenia: ${t2r.size}`);

const rStops = new Map();
for await (const st of iterCsv(join(GD, 'stop_times.txt'))) {
  const rid = t2r.get(st.trip_id);
  if (!rid) continue;
  let s = rStops.get(rid);
  if (!s) rStops.set(rid, (s = new Set()));
  s.add(st.stop_id);
}
log(`tras z przystankami: ${rStops.size}`);

const inBox = (p, b) => p[0] >= b.s && p[0] <= b.n && p[1] >= b.w && p[1] <= b.e;
const out = { bus: [], tram: [], metro: [], key: {}, op: {} };
let cutOuter = 0, cutShare = 0, cutNotch = 0;
for (const [rid, stops] of rStops) {
  let n = 0, inside = 0, outside = false, brabant = false;
  for (const sid of stops) {
    const p = stopPos.get(sid);
    if (!p) continue;
    n++;
    if (inBox(p, CORE)) inside++;
    if (!inBox(p, OUTER)) outside = true;
    if (NOTCH(p)) brabant = true;
  }
  if (!n) continue;
  if (inside / n < CORE_SHARE) { cutShare++; continue; }
  if (outside) { cutOuter++; continue; }
  if (brabant) { cutNotch++; continue; }
  out[kind.get(rid)].push(rid);
  out.op[rid] = sop.get(rid);
}
for (const k of ['bus', 'tram', 'metro']) out[k].sort();
log(`wybrano: bus ${out.bus.length}, tram ${out.tram.length}, metro ${out.metro.length} `
  + `(odrzucone: ${cutShare} spoza rdzenia, ${cutOuter} wychodzące poza ramkę, `
  + `${cutNotch} z brabanckiego narożnika)`);

// ---------- numery używane przez kilku przewoźników ----------
for (const mode of ['bus', 'tram', 'metro']) {
  const byName = new Map();
  for (const rid of out[mode]) {
    const sn = sname.get(rid);
    let a = byName.get(sn);
    if (!a) byName.set(sn, (a = []));
    a.push(rid);
  }
  let pref = 0;
  const clash = [];
  for (const [sn, rids] of byName) {
    if (rids.length < 2) continue;
    const ops = new Set(rids.map((r) => sop.get(r)));
    if (ops.size > 1) {
      // różni przewoźnicy: kod przewoźnika przed numerem
      for (const rid of rids) { out.key[rid] = sop.get(rid) + ':' + sn; pref++; }
      clash.push(sn);
    } else {
      // ten sam przewoźnik dwa razy pod tym samym numerem (okresowe warianty)
      // — zostają sklejone, bo to jedna linia w dwóch wierszach feedu
    }
  }
  log(`${mode}: kluczy z kodem przewoźnika ${pref}${clash.length ? ` (numery: ${clash.sort().join(', ')})` : ''}`);
}

writeFileSync(join(ROOT, 'data/scope.json'), JSON.stringify(out, null, 0));
log('zapisano data/scope.json');
