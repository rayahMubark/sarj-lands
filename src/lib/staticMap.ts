// Lightweight OpenStreetMap static-map layout — no API key, no interactive
// map library. We composite 1-4 standard 256px OSM raster tiles (from the
// public tile.openstreetmap.org server) into a small square so the given
// coordinate always lands exactly in the center, then draw a marker there.
//
// A single tile can't guarantee that: the point could fall anywhere inside
// it, even at the edge. Centering requires knowing which tile(s) cover a
// window centered on the point's exact pixel position, which is what the
// Web Mercator math below computes.
//
// Note for production: hotlinking tile.openstreetmap.org directly is fine
// for this prototype's traffic, but OSM's tile usage policy expects a
// caching layer (or a paid tile provider) for real production volume.

const TILE_SIZE = 256;

export interface StaticMapTile {
  url: string;
  leftPercent: number;
  topPercent: number;
  sizePercent: number;
}

export interface StaticMapLayout {
  tiles: StaticMapTile[];
}

// Computes the tile mosaic for a `canvasSize` x `canvasSize` square
// centered on (lat, lng) at the given zoom. All returned positions are
// percentages of the canvas, so the caller can render it at any responsive
// size — the marker itself is always exactly centered by construction and
// needs no separate coordinates.
export function layoutStaticMap(
  lat: number,
  lng: number,
  zoom: number,
  canvasSize: number = TILE_SIZE
): StaticMapLayout {
  const tilesPerSide = 2 ** zoom;

  // Continuous pixel position of (lat, lng) across the whole world map at
  // this zoom (standard Web Mercator projection).
  const worldX = ((lng + 180) / 360) * tilesPerSide * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    tilesPerSide *
    TILE_SIZE;

  // Top-left corner of the canvas in that same world-pixel space, chosen so
  // the point sits at the canvas's exact center.
  const originX = worldX - canvasSize / 2;
  const originY = worldY - canvasSize / 2;

  const firstTileX = Math.floor(originX / TILE_SIZE);
  const firstTileY = Math.floor(originY / TILE_SIZE);
  const lastTileX = Math.floor((originX + canvasSize - 1) / TILE_SIZE);
  const lastTileY = Math.floor((originY + canvasSize - 1) / TILE_SIZE);

  const tiles: StaticMapTile[] = [];
  for (let tileY = firstTileY; tileY <= lastTileY; tileY++) {
    for (let tileX = firstTileX; tileX <= lastTileX; tileX++) {
      tiles.push({
        url: `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`,
        leftPercent: roundPercent(((tileX * TILE_SIZE - originX) / canvasSize) * 100),
        topPercent: roundPercent(((tileY * TILE_SIZE - originY) / canvasSize) * 100),
        sizePercent: roundPercent((TILE_SIZE / canvasSize) * 100),
      });
    }
  }

  return { tiles };
}

// Math.tan/Math.log (used above for the Mercator projection) aren't
// guaranteed to return bit-identical results across JS engines — Node's
// SSR pass and the browser's hydration pass have been observed to differ
// by ~1e-10%, which is invisible on screen but enough for React to flag a
// hydration mismatch on the server-rendered `style` string. Rounding to a
// precision many orders of magnitude coarser than that drift keeps server
// and client output byte-identical.
function roundPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}
