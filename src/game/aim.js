// Pure geometry for the aim guide: project the cue ball along a direction and
// find the first object ball (or cushion) it would reach.

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// origin: {x,y} cue-ball centre; dir: unit vector; targets: [{id,x,y}];
// bounds: {left,right,top,bottom} of the cloth; radius: ball radius.
export function projectCuePath(origin, dir, targets, bounds, radius) {
  const R = radius * 2;
  let best = null;

  for (const target of targets) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const proj = dx * dir.x + dy * dir.y;
    if (proj <= 0) continue;
    const perp2 = dx * dx + dy * dy - proj * proj;
    if (perp2 > R * R) continue;
    const t = proj - Math.sqrt(R * R - perp2);
    if (t < 0) continue;
    if (!best || t < best.t) best = { t, target };
  }

  let tWall = Infinity;
  if (dir.x > 0) tWall = Math.min(tWall, (bounds.right - radius - origin.x) / dir.x);
  if (dir.x < 0) tWall = Math.min(tWall, (bounds.left + radius - origin.x) / dir.x);
  if (dir.y > 0) tWall = Math.min(tWall, (bounds.bottom - radius - origin.y) / dir.y);
  if (dir.y < 0) tWall = Math.min(tWall, (bounds.top + radius - origin.y) / dir.y);
  if (!Number.isFinite(tWall)) tWall = 0;

  if (best && best.t < tWall) {
    const end = { x: origin.x + dir.x * best.t, y: origin.y + dir.y * best.t };
    const objectDir = normalize(best.target.x - end.x, best.target.y - end.y);
    return { end, t: best.t, hit: { id: best.target.id, center: { x: best.target.x, y: best.target.y }, dir: objectDir } };
  }
  return { end: { x: origin.x + dir.x * tWall, y: origin.y + dir.y * tWall }, t: tWall, hit: null };
}
