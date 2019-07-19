
import test from 'tape';
import geojsonvt from '../src/index';

test('getTile: multi layer', (t) => {
    const data = [
        {
            layer: 'polygon',
            data: {
                type: 'Polygon',
                coordinates: [[
                    [42.1875, 57.32652122521708],
                    [47.8125, 57.32652122521708],
                    [47.8125, 54.16243396806781],
                    [42.1875, 54.16243396806781],
                    [42.1875, 57.32652122521708]
                ]]
            }
        },
        {
            layer: 'line',
            data: {
                type: 'LineString',
                coordinates: [
                    [42.1875, 57.32652122521709],
                    [47.8125, 57.32652122521709],
                    [47.8125, 54.16243396806782],
                    [42.1875, 54.16243396806782]
                ]
            }
        }
    ];
    const index = geojsonvt(data, {
        buffer: 1024
    });

    t.same(index.getTile(5, 19, 9).features, [{
        geometry: [[[3072, 3072], [5120, 3072], [5120, 5120], [3072, 5120], [3072, 3072]]],
        type: 3,
        tags: null,
        layer: 'polygon',
    }, {
        geometry: [[[3072, 3072], [5120, 3072], [5120, 5120], [3072, 5120]]],
        type: 2,
        tags: null,
        layer: 'line',
    }]);

    t.end();
});
