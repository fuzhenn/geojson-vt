
import clip from './clip.js';
import createFeature from './feature.js';

export default function wrap(features, options) {
    const buffer = options.buffer / options.extent;
    let merged = features;
    const left  = clip(features, 1, -1 - buffer, buffer,     0, -1, 2, options); // left world copy
    const right = clip(features, 1,  1 - buffer, 2 + buffer, 0, -1, 2, options); // right world copy

    if (left || right) {
        merged = clip(features, 1, -buffer, 1 + buffer, 0, -1, 2, options) || []; // center world copy

        if (left) merged = shiftFeatureCoords(left, 1, options.hasAltitude).concat(merged); // merge left into center
        if (right) merged = merged.concat(shiftFeatureCoords(right, -1, options.hasAltitude)); // merge right into center
    }

    return merged;
}

function shiftFeatureCoords(features, offset, hasAltitude) {
    const newFeatures = [];

    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const type = feature.type;

        let newGeometry;

        if (type === 'Point' || type === 'MultiPoint' || type === 'LineString') {
            newGeometry = shiftCoords(feature.geometry, offset, hasAltitude);

        } else if (type === 'MultiLineString' || type === 'Polygon') {
            newGeometry = [];
            for (const line of feature.geometry) {
                newGeometry.push(shiftCoords(line, offset, hasAltitude));
            }
        } else if (type === 'MultiPolygon') {
            newGeometry = [];
            for (const polygon of feature.geometry) {
                const newPolygon = [];
                for (const line of polygon) {
                    newPolygon.push(shiftCoords(line, offset, hasAltitude));
                }
                newGeometry.push(newPolygon);
            }
        }

        newFeatures.push(createFeature(feature.id, type, newGeometry, feature.tags, feature.layer));
    }

    return newFeatures;
}

function shiftCoords(points, offset, hasAltitude) {
    const newPoints = [];
    newPoints.size = points.size;

    if (points.start !== undefined) {
        newPoints.start = points.start;
        newPoints.end = points.end;
    }

    const stride = hasAltitude ? 4 : 3;

    for (let i = 0; i < points.length; i += stride) {
        newPoints.push(points[i] + offset, points[i + 1], points[i + 2]);
        if (hasAltitude) {
            newPoints.push(points[i + 3]);
        }
    }
    return newPoints;
}
