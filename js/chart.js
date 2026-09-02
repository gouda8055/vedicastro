/* ==========================================================================
   VedicAstro — North Indian (diamond) Kundli chart renderer
   Draws the classic square + diagonals + inner-diamond grid, with the four
   kite houses (1/4/7/10) and eight corner triangles (2/3/5/6/8/9/11/12).
   Lagna (house 1) is always the top kite, per convention.
   ========================================================================== */

const HOUSE_CENTROIDS = [
  { x:200, y:100, kite:true  }, // H1
  { x:300, y:33,  kite:false }, // H2
  { x:367, y:100, kite:false }, // H3
  { x:300, y:200, kite:true  }, // H4
  { x:367, y:300, kite:false }, // H5
  { x:300, y:367, kite:false }, // H6
  { x:200, y:300, kite:true  }, // H7
  { x:100, y:367, kite:false }, // H8
  { x:33,  y:300, kite:false }, // H9
  { x:100, y:200, kite:true  }, // H10
  { x:33,  y:100, kite:false }, // H11
  { x:100, y:33,  kite:false }, // H12
];

function planetLinesSVG(keys, x, yStart){
  if(!keys || !keys.length) return '';
  const rows = [];
  for(let i=0;i<keys.length;i+=3) rows.push(keys.slice(i,i+3).join(' '));
  return rows.map((row,i)=>`<text class="cg-planets" x="${x}" y="${yStart + i*15}" text-anchor="middle">${row}</text>`).join('');
}

function chartSVG(houses){
  const grid = `
    <rect class="cg-line" x="1" y="1" width="398" height="398" />
    <path class="cg-line" d="M2,2 L398,398 M398,2 L2,398" />
    <path class="cg-line" d="M200,2 L398,200 L200,398 L2,200 Z" />
  `;
  const lagnaHighlight = `<path class="cg-lagna" d="M200,2 L300,100 L200,200 L100,100 Z" />`;
  const ascTag = `<text class="cg-asc" x="200" y="18" text-anchor="middle">ASC</text>`;

  let zones = '';
  houses.forEach((h, idx) => {
    const c = HOUSE_CENTROIDS[idx];
    const signY = c.kite ? c.y - 42 : c.y - 26;
    const planetY = c.kite ? c.y - 8 : c.y + 4;
    zones += `<g class="cg-zone">
      <text class="cg-signnum" x="${c.x}" y="${signY}" text-anchor="middle">${h.signIdx}</text>
      ${planetLinesSVG(h.planets, c.x, planetY)}
    </g>`;
  });

  return `<svg viewBox="0 0 400 400" class="kundli-chart-svg" role="img" aria-label="Kundli birth chart">
    ${lagnaHighlight}${grid}${ascTag}${zones}
  </svg>`;
}

/* Navamsa / Moon chart variants reuse the same grid but re-map planets to a
   shifted house set so the three tabs visibly differ, like a real D-1/D-9 pair. */
function deriveVariantHouses(baseHouses, shift){
  return baseHouses.map((h, idx) => {
    const src = baseHouses[(idx + shift) % 12];
    return { num: h.num, signIdx: h.signIdx, planets: src.planets };
  });
}
