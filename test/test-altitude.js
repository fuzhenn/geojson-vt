
import test from 'tape';
import geojsonvt from '../src/index';

test('input with altitude', (t) => {
    const data = [
        {
            layer: 'line',
            data: {
                type: 'LineString',
                coordinates: [
                    [42.1875, 57.32652122521709, 10],
                    [47.8125, 57.32652122521709, 14],
                    [47.8125, 54.16243396806782, 20],
                    [42.1875, 54.16243396806782, 24]
                ]
            }
        }
    ];
    const index = geojsonvt(data, {
        debug: 1,
        hasAltitude: true,
        buffer: 512
    });

    t.same(index.getTile(5, 19, 9).features, [{
        geometry: [[[3072, 3072, 10], [4608, 3072, 13]]],
        type: 2,
        tags: null,
        layer: 'line',
    }]);

    t.end();
});
