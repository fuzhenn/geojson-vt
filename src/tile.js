
export default function createTile(features, z, tx, ty, options) {
    const tolerance = z === options.maxZoom ? 0 : options.tolerance / ((1 << z) * options.extent);
    const tile = {
        features: [],
        numPoints: 0,
        numSimplified: 0,
        numFeatures: features.length,
        source: null,
        x: tx,
        y: ty,
        z,
        transformed: false,
        minX: 2,
        minY: 1,
        maxX: -1,
        maxY: 0
    };
    for (const feature of features) {
        addFeature(tile, feature, tolerance, options);

        const minX = feature.minX;
        const minY = feature.minY;
        const maxX = feature.maxX;
        const maxY = feature.maxY;

        if (minX < tile.minX) tile.minX = minX;
        if (minY < tile.minY) tile.minY = minY;
        if (maxX > tile.maxX) tile.maxX = maxX;
        if (maxY > tile.maxY) tile.maxY = maxY;
    }
    return tile;
}

function addFeature(tile, feature, tolerance, options) {

    const geom = feature.geometry;
    const type = feature.type;
    const simplified = [];
    const stride = options.hasAltitude ? 4 : 3;

    if (type === 'Point' || type === 'MultiPoint') {
        for (let i = 0; i < geom.length; i += stride) {
            simplified.push(geom[i], geom[i + 1]);
            if (options.hasAltitude) {
                simplified.push(geom[i + 3]);
            }
            tile.numPoints++;
            tile.numSimplified++;
        }

    } else if (type === 'LineString') {
        addLine(simplified, geom, tile, tolerance, false, false, options.hasAltitude);

    } else if (type === 'MultiLineString' || type === 'Polygon') {
        for (let i = 0; i < geom.length; i++) {
            addLine(simplified, geom[i], tile, tolerance, type === 'Polygon', i === 0, options.hasAltitude);
        }

    } else if (type === 'MultiPolygon') {

        for (let k = 0; k < geom.length; k++) {
            const polygon = geom[k];
            for (let i = 0; i < polygon.length; i++) {
                addLine(simplified, polygon[i], tile, tolerance, true, i === 0, options.hasAltitude);
            }
        }
    }

    if (simplified.length) {
        let tags = feature.tags || null;

        if (type === 'LineString' && options.lineMetrics) {
            tags = {};
            for (const key in feature.tags) tags[key] = feature.tags[key];
            tags['mapbox_clip_start'] = geom.start / geom.size;
            tags['mapbox_clip_end'] = geom.end / geom.size;
        }

        const tileFeature = {
            geometry: simplified,
            type: type === 'Polygon' || type === 'MultiPolygon' ? 3 :
            (type === 'LineString' || type === 'MultiLineString' ? 2 : 1),
            tags
        };
        if (feature.layer) {
            tileFeature.layer = feature.layer;
        }
        if (feature.id !== null) {
            tileFeature.id = feature.id;
        }
        tile.features.push(tileFeature);
    }
}

function addLine(result, geom, tile, tolerance, isPolygon, isOuter, hasAltitude) {
    const sqTolerance = tolerance * tolerance;
    const stride = hasAltitude ? 4 : 3;

    if (tolerance > 0 && (geom.size < (isPolygon ? sqTolerance : tolerance))) {
        tile.numPoints += geom.length / stride;
        return;
    }

    const ring = [];

    for (let i = 0; i < geom.length; i += stride) {
        if (tolerance === 0 || geom[i + 2] > sqTolerance) {
            tile.numSimplified++;
            ring.push(geom[i], geom[i + 1]);
            if (hasAltitude) {
                ring.push(geom[i + 3]);
            }
        }
        tile.numPoints++;
    }

    if (isPolygon) rewind(ring, isOuter, hasAltitude);

    result.push(ring);
}

function rewind(ring, clockwise, hasAltitude) {
    const stride = hasAltitude ? 3 : 2;
    let area = 0;
    for (let i = 0, len = ring.length, j = len - stride; i < len; j = i, i += stride) {
        area += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
    }
    if (area > 0 === clockwise) {
        const posX = stride;
        const posY = stride - 1;
        const posA = stride - 2;
        for (let i = 0, len = ring.length; i < len / 2; i += 2) {
            const x = ring[i];
            const y = ring[i + 1];
            let altitude;
            if (hasAltitude) {
                altitude = ring[i + 2];
            }
            ring[i] = ring[len - posX - i];
            ring[i + 1] = ring[len - posY - i];
            if (hasAltitude) {
                ring[i + 2] = ring[len - posA - i];
            }
            ring[len - posX - i] = x;
            ring[len - posY - i] = y;
            if (hasAltitude) {
                ring[len - posA - i] = altitude;
            }
        }
    }
}
