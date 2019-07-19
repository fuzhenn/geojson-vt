
import simplify from './simplify';
import createFeature from './feature';

// converts GeoJSON feature into an intermediate projected JSON vector format with simplification data

export default function convert(data, options) {
    const features = [];

    if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
            convertLayerData(features, data[i].layer, data[i].data, options);
        }
        return features;
    }

    if (data.type === 'FeatureCollection') {
        for (let i = 0; i < data.features.length; i++) {
            convertFeature(features, data.features[i], options, i);
        }

    } else if (data.type === 'Feature') {
        convertFeature(features, data, options);

    } else {
        // single geometry or a geometry collection
        convertFeature(features, {geometry: data}, options);
    }

    return features;
}

function convertLayerData(features, layer, data, options) {
    // FIXME: ugly to pass 'layer' to 'convertFeature' in this way
    options.layer = layer;

    if (data.type === 'FeatureCollection') {
        for (let i = 0; i < data.features.length; i++) {
            convertFeature(features, data.features[i], options, i);
        }

    } else if (data.type === 'Feature') {
        convertFeature(features, data, options);

    } else {
        // single geometry or a geometry collection
        convertFeature(features, {geometry: data}, options);
    }
}

function convertFeature(features, geojson, options, index) {
    if (!geojson.geometry) return;

    const coords = geojson.geometry.coordinates;
    const type = geojson.geometry.type;
    const tolerance = Math.pow(options.tolerance / ((1 << options.maxZoom) * options.extent), 2);
    let geometry = [];
    let id = geojson.id;
    if (options.promoteId) {
        id = geojson.properties[options.promoteId];
    } else if (options.generateId) {
        id = index || 0;
    }
    if (type === 'Point') {
        convertPoint(coords, geometry, options.hasAltitude);

    } else if (type === 'MultiPoint') {
        for (const p of coords) {
            convertPoint(p, geometry, options.hasAltitude);
        }

    } else if (type === 'LineString') {
        convertLine(coords, geometry, tolerance, false, options.hasAltitude);

    } else if (type === 'MultiLineString') {
        if (options.lineMetrics) {
            // explode into linestrings to be able to track metrics
            for (const line of coords) {
                geometry = [];
                convertLine(line, geometry, tolerance, false, options.hasAltitude);
                features.push(createFeature(id, 'LineString', geometry, geojson.properties, options.layer, options.hasAltitude));
            }
            return;
        } else {
            convertLines(coords, geometry, tolerance, false, options.hasAltitude);
        }

    } else if (type === 'Polygon') {
        convertLines(coords, geometry, tolerance, true, options.hasAltitude);

    } else if (type === 'MultiPolygon') {
        for (const polygon of coords) {
            const newPolygon = [];
            convertLines(polygon, newPolygon, tolerance, true, options.hasAltitude);
            geometry.push(newPolygon);
        }
    } else if (type === 'GeometryCollection') {
        for (const singleGeometry of geojson.geometry.geometries) {
            convertFeature(features, {
                id,
                geometry: singleGeometry,
                properties: geojson.properties
            }, options, index);
        }
        return;
    } else {
        throw new Error('Input data is not a valid GeoJSON object.');
    }

    features.push(createFeature(id, type, geometry, geojson.properties, options.layer, options.hasAltitude));
}

function convertPoint(coords, out, hasAltitude) {
    out.push(projectX(coords[0]));
    out.push(projectY(coords[1]));
    out.push(0);

    if (hasAltitude) {
        out.push(coords[2]);
    }
}

function convertLine(ring, out, tolerance, isPolygon, hasAltitude) {
    let x0, y0;
    let size = 0;

    for (let j = 0; j < ring.length; j++) {
        const x = projectX(ring[j][0]);
        const y = projectY(ring[j][1]);

        out.push(x);
        out.push(y);
        out.push(0);

        if (hasAltitude) {
            out.push(ring[j][2]);
        }

        if (j > 0) {
            if (isPolygon) {
                size += (x0 * y - x * y0) / 2; // area
            } else {
                size += Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2)); // length
            }
        }
        x0 = x;
        y0 = y;
    }

    const stride = hasAltitude ? 4 : 3;
    const last = out.length - stride;
    out[2] = 1;
    simplify(out, 0, last, tolerance, stride);
    out[last + 2] = 1;

    out.size = Math.abs(size);
    out.start = 0;
    out.end = out.size;
}

function convertLines(rings, out, tolerance, isPolygon, hasAltitude) {
    for (let i = 0; i < rings.length; i++) {
        const geom = [];
        convertLine(rings[i], geom, tolerance, isPolygon, hasAltitude);
        out.push(geom);
    }
}

function projectX(x) {
    return x / 360 + 0.5;
}

function projectY(y) {
    const sin = Math.sin(y * Math.PI / 180);
    const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
    return y2 < 0 ? 0 : y2 > 1 ? 1 : y2;
}
