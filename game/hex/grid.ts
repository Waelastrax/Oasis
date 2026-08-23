export type HexCoord = { q: number; r: number };

const DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export const hexKey = ({ q, r }: HexCoord) => `${q},${r}`;

export const hexDistance = (a: HexCoord, b: HexCoord = { q: 0, r: 0 }) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

export const hexNeighbors = ({ q, r }: HexCoord) => DIRECTIONS.map((direction) => ({ q: q + direction.q, r: r + direction.r }));

export function findHexPath(
  start: HexCoord,
  goal: HexCoord,
  isPassable: (coord: HexCoord) => boolean,
  stepCost: (coord: HexCoord) => number,
) {
  const startKey = hexKey(start);
  const goalKey = hexKey(goal);
  const frontier = new Map<string, HexCoord>([[startKey, start]]);
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>([[startKey, 0]]);

  while (frontier.size > 0) {
    let currentKey = "";
    let current = start;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [candidateKey, candidate] of frontier) {
      const score = (costs.get(candidateKey) ?? Number.POSITIVE_INFINITY) + hexDistance(candidate, goal) * 0.85;
      if (score < bestScore) {
        bestScore = score;
        currentKey = candidateKey;
        current = candidate;
      }
    }

    frontier.delete(currentKey);
    if (currentKey === goalKey) break;

    for (const neighbor of hexNeighbors(current)) {
      if (!isPassable(neighbor)) continue;
      const neighborKey = hexKey(neighbor);
      const nextCost = (costs.get(currentKey) ?? 0) + stepCost(neighbor);
      if (nextCost >= (costs.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(neighborKey, nextCost);
      cameFrom.set(neighborKey, currentKey);
      frontier.set(neighborKey, neighbor);
    }
  }

  if (startKey !== goalKey && !cameFrom.has(goalKey)) return [];
  const path: HexCoord[] = [goal];
  let cursor = goalKey;
  while (cursor !== startKey) {
    const previous = cameFrom.get(cursor);
    if (!previous) return [];
    const [q, r] = previous.split(",").map(Number);
    path.push({ q, r });
    cursor = previous;
  }
  return path.reverse();
}
