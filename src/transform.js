
// Transforms the coordinates of each feature in the given tile from
// mercator-projected space into (extent x extent) tile space.
export default function transformTile(tile, extent, hasAltitude) {
    if (tile.transformed) return tile;

    const z2 = 1 << tile.z;
    const tx = tile.x;
    const ty = tile.y;

    const stride = hasAltitude ? 3 : 2;

    for (const feature of tile.features) {
        const geom = feature.geometry;
        const type = feature.type;

        feature.geometry = [];

        if (type === 1) {
            for (let j = 0; j < geom.length; j += stride) {
                feature.geometry.push(transformPoint(geom[j], geom[j + 1], extent, z2, tx, ty));
                if (hasAltitude) {
                    feature.geometry[feature.geometry.length - 1].push(geom[j + 2]);
                }
            }
        } else {
            for (let j = 0; j < geom.length; j++) {
                const ring = [];
                for (let k = 0; k < geom[j].length; k += stride) {
                    ring.push(transformPoint(geom[j][k], geom[j][k + 1], extent, z2, tx, ty));
                    if (hasAltitude) {
                        ring[ring.length - 1].push(geom[j][k + 2]);
                    }
                }
                feature.geometry.push(ring);
            }
        }
    }

    tile.transformed = true;

    return tile;
}

function transformPoint(x, y, extent, z2, tx, ty) {
    return [
        Math.round(extent * (x * z2 - tx)),
        Math.round(extent * (y * z2 - ty))];
}
