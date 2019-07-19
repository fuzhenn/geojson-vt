
export default function createFeature(id, type, geom, tags, layer, hasAltitude) {
    const feature = {
        id: typeof id === 'undefined' ? null : id,
        type,
        geometry: geom,
        tags,
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
    };
    if (layer) {
        feature.layer = layer;
    }
    const stride = hasAltitude ? 4 : 3;
    calcBBox(feature, stride);
    return feature;
}

function calcBBox(feature, stride) {
    const geom = feature.geometry;
    const type = feature.type;

    if (type === 'Point' || type === 'MultiPoint' || type === 'LineString') {
        calcLineBBox(feature, geom, stride);

    } else if (type === 'Polygon' || type === 'MultiLineString') {
        for (const line of geom) {
            calcLineBBox(feature, line, stride);
        }

    } else if (type === 'MultiPolygon') {
        for (const polygon of geom) {
            for (const line of polygon) {
                calcLineBBox(feature, line, stride);
            }
        }
    }
}

function calcLineBBox(feature, geom, stride) {
    for (let i = 0; i < geom.length; i += stride) {
        feature.minX = Math.min(feature.minX, geom[i]);
        feature.minY = Math.min(feature.minY, geom[i + 1]);
        feature.maxX = Math.max(feature.maxX, geom[i]);
        feature.maxY = Math.max(feature.maxY, geom[i + 1]);
    }
}
