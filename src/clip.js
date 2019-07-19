
import createFeature from './feature';

/* clip features between two axis-parallel lines:
 *     |        |
 *  ___|___     |     /
 * /   |   \____|____/
 *     |        |
 */

export default function clip(features, scale, k1, k2, axis, minAll, maxAll, options) {

    k1 /= scale;
    k2 /= scale;

    if (minAll >= k1 && maxAll < k2) return features; // trivial accept
    else if (maxAll < k1 || minAll >= k2) return null; // trivial reject

    const clipped = [];

    for (const feature of features) {
        const geometry = feature.geometry;
        let type = feature.type;

        const min = axis === 0 ? feature.minX : feature.minY;
        const max = axis === 0 ? feature.maxX : feature.maxY;

        if (min >= k1 && max < k2) { // trivial accept
            clipped.push(feature);
            continue;
        } else if (max < k1 || min >= k2) { // trivial reject
            continue;
        }

        let newGeometry = [];

        if (type === 'Point' || type === 'MultiPoint') {
            clipPoints(geometry, newGeometry, k1, k2, axis, options.hasAltitude);

        } else if (type === 'LineString') {
            clipLine(geometry, newGeometry, k1, k2, axis, false, options.lineMetrics, options.hasAltitude);

        } else if (type === 'MultiLineString') {
            clipLines(geometry, newGeometry, k1, k2, axis, false, options.hasAltitude);

        } else if (type === 'Polygon') {
            clipLines(geometry, newGeometry, k1, k2, axis, true, options.hasAltitude);

        } else if (type === 'MultiPolygon') {
            for (const polygon of geometry) {
                const newPolygon = [];
                clipLines(polygon, newPolygon, k1, k2, axis, true, options.hasAltitude);
                if (newPolygon.length) {
                    newGeometry.push(newPolygon);
                }
            }
        }

        if (newGeometry.length) {
            if (options.lineMetrics && type === 'LineString') {
                for (const line of newGeometry) {
                    clipped.push(createFeature(feature.id, type, line, feature.tags, feature.layer, options.hasAltitude));
                }
                continue;
            }

            if (type === 'LineString' || type === 'MultiLineString') {
                if (newGeometry.length === 1) {
                    type = 'LineString';
                    newGeometry = newGeometry[0];
                } else {
                    type = 'MultiLineString';
                }
            }
            if (type === 'Point' || type === 'MultiPoint') {
                type = newGeometry.length === 3 ? 'Point' : 'MultiPoint';
            }

            clipped.push(createFeature(feature.id, type, newGeometry, feature.tags, feature.layer, options.hasAltitude));
        }
    }

    return clipped.length ? clipped : null;
}

function clipPoints(geom, newGeom, k1, k2, axis, hasAltitude) {
    const stride = hasAltitude ? 4 : 3;
    for (let i = 0; i < geom.length; i += stride) {
        const a = geom[i + axis];

        if (a >= k1 && a <= k2) {
            newGeom.push(geom[i]);
            newGeom.push(geom[i + 1]);
            newGeom.push(geom[i + 2]);
            if (hasAltitude) {
                newGeom.push(geom[i + 3]);
            }
        }
    }
}

function clipLine(geom, newGeom, k1, k2, axis, isPolygon, trackMetrics, hasAltitude) {

    let slice = newSlice(geom);
    const intersect = axis === 0 ? intersectX : intersectY;
    let len = geom.start;
    let segLen, t;

    const stride = hasAltitude ? 4 : 3;

    for (let i = 0; i < geom.length - stride; i += stride) {
        const ax = geom[i];
        const ay = geom[i + 1];
        const az = geom[i + 2];
        const bx = geom[i + stride];
        const by = geom[i + stride + 1];
        let ah, bh;
        if (hasAltitude) {
            ah = geom[i + 3];
            bh = geom[i + stride + 3];
        }
        const a = axis === 0 ? ax : ay;
        const b = axis === 0 ? bx : by;
        let exited = false;

        if (trackMetrics) segLen = Math.sqrt(Math.pow(ax - bx, 2) + Math.pow(ay - by, 2));

        if (a < k1) {
            // ---|-->  | (line enters the clip region from the left)
            if (b > k1) {
                t = intersect(slice, ax, ay, bx, by, k1);
                if (hasAltitude) {
                    slice.push(newHeight(ah, bh, t));
                }
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else if (a > k2) {
            // |  <--|--- (line enters the clip region from the right)
            if (b < k2) {
                t = intersect(slice, ax, ay, bx, by, k2);
                if (hasAltitude) {
                    slice.push(newHeight(ah, bh, t));
                }
                if (trackMetrics) slice.start = len + segLen * t;
            }
        } else {
            addPoint(slice, ax, ay, az);
            if (hasAltitude) {
                slice.push(ah);
            }
        }
        if (b < k1 && a >= k1) {
            // <--|---  | or <--|-----|--- (line exits the clip region on the left)
            t = intersect(slice, ax, ay, bx, by, k1);
            if (hasAltitude) {
                slice.push(newHeight(ah, bh, t));
            }
            exited = true;
        }
        if (b > k2 && a <= k2) {
            // |  ---|--> or ---|-----|--> (line exits the clip region on the right)
            t = intersect(slice, ax, ay, bx, by, k2);
            if (hasAltitude) {
                slice.push(newHeight(ah, bh, t));
            }
            exited = true;
        }

        if (!isPolygon && exited) {
            if (trackMetrics) slice.end = len + segLen * t;
            newGeom.push(slice);
            slice = newSlice(geom);
        }

        if (trackMetrics) len += segLen;
    }

    // add the last point
    let last = geom.length - stride;
    const ax = geom[last];
    const ay = geom[last + 1];
    const az = geom[last + 2];
    const a = axis === 0 ? ax : ay;
    if (a >= k1 && a <= k2) addPoint(slice, ax, ay, az);
    if (a >= k1 && a <= k2) {
        if (hasAltitude) {
            const ah = geom[last + 3];
            slice.push(ah);
        }
    }

    // close the polygon if its endpoints are not the same after clipping
    last = slice.length - stride;
    if (isPolygon && last >= stride && (slice[last] !== slice[0] || slice[last + 1] !== slice[1])) {
        addPoint(slice, slice[0], slice[1], slice[2]);
        if (hasAltitude) {
            slice.push(slice[3]);
        }
    }

    // add the final slice
    if (slice.length) {
        newGeom.push(slice);
    }
}

function newSlice(line) {
    const slice = [];
    slice.size = line.size;
    slice.start = line.start;
    slice.end = line.end;
    return slice;
}

function clipLines(geom, newGeom, k1, k2, axis, isPolygon, hasAltitude) {
    for (const line of geom) {
        clipLine(line, newGeom, k1, k2, axis, isPolygon, false, hasAltitude);
    }
}

function addPoint(out, x, y, z) {
    out.push(x);
    out.push(y);
    out.push(z);
}

function intersectX(out, ax, ay, bx, by, x) {
    const t = (x - ax) / (bx - ax);
    out.push(x);
    out.push(ay + (by - ay) * t);
    out.push(1);
    return t;
}

function intersectY(out, ax, ay, bx, by, y) {
    const t = (y - ay) / (by - ay);
    out.push(ax + (bx - ax) * t);
    out.push(y);
    out.push(1);
    return t;
}

function newHeight(ah, bh, t) {
    return ah + (bh - ah) * t;
}
