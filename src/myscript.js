

mapboxgl.accessToken = 'pk.eyJ1IjoiZ2lyZXNzZSIsImEiOiJjazZ4OHgyMnIwN2J3M21sbWdrcDN4d2N6In0.EIpO5oWBt9Xirex5n_MC9Q';

// Create a new Mapbox GL JS map
const map = new mapboxgl.Map({
  container: 'map',  // Specify the container ID where the map will be rendered
  center: [20, -4],  // Set the initial center of the map to [20, -4]
  zoom: 4.8,  // Set the initial zoom level of the map
  style: 'mapbox://styles/mapbox/light-v10'  // Choose a Mapbox style for the map
});

// Holds visible airport features for filtering
let airports = [];

// Create a popup, but don't add it to the map yet.
const popup = new mapboxgl.Popup({
    closeButton: false
});

const size = 65; // Adjust the size of the pulsing dot

// This implements `StyleImageInterface` to draw a pulsing dot icon on the map.
const pulsingDot = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    onAdd: function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext('2d');
    },

    render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (size / 2) * 0.3;
        const outerRadius = (size / 2) * 0.7 * t + radius;
        const context = this.context;

        context.clearRect(0, 0, this.width, this.height);
        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2
        );
        context.fillStyle = `rgba(255, 200, 200, ${1 - t})`;
        context.fill();

        context.beginPath();
        context.arc(
            this.width / 2,
            this.height / 2,
            radius,
            0,
            Math.PI * 2
        );
        context.fillStyle = 'rgba(255, 100, 100, 1)';
        context.strokeStyle = 'white';
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        this.data = context.getImageData(
            0,
            0,
            this.width,
            this.height
        ).data;

        map.triggerRepaint();

        return true;
    }
};

map.on('load', () => {
    map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });

    map.addSource('pulsing-dot', {
        'type': 'vector',
        'url': 'mapbox://mapbox.04w69w5j'
    });

    map.addLayer({
        'id': 'pulsing-dot',
        'source': 'pulsing-dot',
        'source-layer': 'ne_10m_airports',
        'type': 'symbol',
        'layout': {
            'icon-image': 'pulsing-dot',
            'icon-allow-overlap': true,
        }
    });

    map.on('movestart', () => {
        map.setFilter('pulsing-dot', ['has', 'iata_code']); // Assuming 'iata_code' is the property to filter
    });

    map.on('moveend', () => {
        const features = map.queryRenderedFeatures({ layers: ['pulsing-dot'] });

        if (features) {
            const uniqueFeatures = getUniqueFeatures(features, 'iata_code');
            renderListings(uniqueFeatures);
            airports = uniqueFeatures;
        }
    });

    map.on('mousemove', 'pulsing-dot', (e) => {
        map.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        popup
            .setLngLat(feature.geometry.coordinates)
            .setText(`${feature.properties.name} (${feature.properties.abbrev})`)
            .addTo(map);
    });

    map.on('mouseleave', 'pulsing-dot', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });

    filterEl.addEventListener('keyup', (e) => {
        const value = normalize(e.target.value);

        const filtered = [];
        for (const feature of airports) {
            const name = normalize(feature.properties.name);
            const code = normalize(feature.properties.abbrev);
            if (name.includes(value) || code.includes(value)) {
                filtered.push(feature);
            }
        }

        renderListings(filtered);

        if (filtered.length) {
            map.setFilter('pulsing-dot', [
                'match',
                ['get', 'abbrev'],
                filtered.map((feature) => feature.properties.abbrev),
                true,
                false
            ]);
        }
    });

    renderListings([]);
});

    const filterEl = document.getElementById('feature-filter');
    const listingEl = document.getElementById('feature-listing');


function renderListings(features) {
    const empty = document.createElement('p');
    listingEl.innerHTML = '';
    if (features.length) {
        for (const feature of features) {
            const itemLink = document.createElement('a');
            const label = `${feature.properties.name} (${feature.properties.abbrev})`;
            itemLink.href = feature.properties.wikipedia;
            itemLink.target = '_blank';
            itemLink.textContent = label;
            itemLink.addEventListener('mouseover', () => {
                popup
                    .setLngLat(feature.geometry.coordinates)
                    .setText(label)
                    .addTo(map);
            });
            listingEl.appendChild(itemLink);
        }
        filterEl.parentNode.style.display = 'block';
    } else if (features.length === 0 && filterEl.value !== '') {
        empty.textContent = 'No results found';
        listingEl.appendChild(empty);
    } else {
        empty.textContent = 'Drag the map to populate results';
        listingEl.appendChild(empty);
        filterEl.parentNode.style.display = 'none';
        map.setFilter('pulsing-dot', ['has', 'iata_code']);
    }
}

function normalize(string) {
    return string.trim().toLowerCase();
}

function getUniqueFeatures(features, comparatorProperty) {
    const uniqueIds = new Set();
    const uniqueFeatures = [];
    for (const feature of features) {
        const id = feature.properties[comparatorProperty];
        if (!uniqueIds.has(id)) {
            uniqueIds.add(id);
            uniqueFeatures.push(feature);
        }
    }
    return uniqueFeatures;
}
