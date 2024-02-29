<script setup>
import mapboxgl from "mapbox-gl";
</script>

<template>
  <div>
    <div id="map" ref="mapCanvas">
      <slot name="map-layer" :mapContext="mapContext" :loaded="loaded"></slot>
    </div>

    <div class="map-overlay">
      <fieldset>
        <input
          id="feature-filter"
          type="text"
          placeholder="Filter results by name"
          v-model="filterText"
          @keyup="filterFeatures"
        />
      </fieldset>
      <div id="feature-listing" class="listing">
        <!-- <p v-if="filteredAirports.length === 0 && filterText !== ''">
          No results found
        </p>
        <p v-else-if="filteredAirports.length === 0">
          Drag the map to populate results
        </p>
        <a
          v-for="feature in filteredAirports"
          :key="feature.properties.iata_code"
          :href="feature.properties.wikipedia"
          target="_blank"
          @mouseover="showPopup(feature)"
        >
          {{ feature.properties.name }} ({{ feature.properties.abbrev }})
        </a> -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "MapboxComponent",
  data() {
    return {
      mapContext: null,
      popup: null,
      airports: [],
      filterText: "",
      filteredAirports: [],
      features: "",
    };
  },
  mounted() {
    this.initializeMap();
    this.filterFeatures();
  },
  methods: {
    initializeMap() {
      // Your map initialization code here
      // Remember to replace the access token with your own
      mapboxgl.accessToken =
        "pk.eyJ1Ijoic2hvcnRkaXYiLCJhIjoiY2l3OGc5YmE5MDJzZjJ5bWhkdDZieGdzcSJ9.1z-swTWtcCHYI_RawDJCEw";
      console.log("this.futures", this.features);
      // Initialize the map here using `this.$refs.mapContainer` instead of "map"
      const map = new mapboxgl.Map({
        container: "map", // Specify the container ID where the map will be rendered
        center: [20, -4], // Set the initial center of the map to [20, -4]
        zoom: 4.8, // Set the initial zoom level of the map
        style: "mapbox://styles/mapbox/light-v10", // Choose a Mapbox style for the map
      });

      this.mapContext = map
      // Holds visible airport features for filtering
      let airports = [];

      // // Create a popup, but don't add it to the map yet.
      const popup = new mapboxgl.Popup({
        closeButton: false,
      });

      const size = 65; // Adjust the size of the pulsing dot

      // // This implements `StyleImageInterface` to draw a pulsing dot icon on the map.
      const pulsingDot = {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),

        onAdd: function () {
          const canvas = document.createElement("canvas");
          canvas.width = this.width;
          canvas.height = this.height;
          this.context = canvas.getContext("2d");
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
          context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
          context.fillStyle = "rgba(255, 100, 100, 1)";
          context.strokeStyle = "white";
          context.lineWidth = 2 + 4 * (1 - t);
          context.fill();
          context.stroke();

          this.data = context.getImageData(0, 0, this.width, this.height).data;

          map.triggerRepaint();

          return true;
        },
      };

      map.on("load", () => {
        map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });

        map.addSource("pulsing-dot", {
          type: "vector",
          url: "mapbox://mapbox.04w69w5j",
        });

        map.addLayer({
          id: "pulsing-dot",
          source: "pulsing-dot",
          "source-layer": "ne_10m_airports",
          type: "symbol",
          layout: {
            "icon-image": "pulsing-dot",
            "icon-allow-overlap": true,
          },
        });

        map.on("movestart", () => {
          map.setFilter("pulsing-dot", ["has", "iata_code"]); // Assuming 'iata_code' is the property to filter
        });

        map.on("moveend", () => {
          const features = map.queryRenderedFeatures({
            layers: ["pulsing-dot"],
          });

          if (features) {
            const uniqueFeatures = getUniqueFeatures(features, "iata_code");
            renderListings(uniqueFeatures);
            airports = uniqueFeatures;
          }
        });

        map.on("mousemove", "pulsing-dot", (e) => {
          map.getCanvas().style.cursor = "pointer";

          const feature = e.features[0];
          popup
            .setLngLat(feature.geometry.coordinates)
            .setText(
              `${feature.properties.name} (${feature.properties.abbrev})`
            )
            .addTo(map);
        });

        map.on("mouseleave", "pulsing-dot", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        filterEl.addEventListener("keyup", (e) => {
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
            map.setFilter("pulsing-dot", [
              "match",
              ["get", "abbrev"],
              filtered.map((feature) => feature.properties.abbrev),
              true,
              false,
            ]);
          }
        });

        renderListings([]);
        this.filterFeatures();
      });

      const filterEl = document.getElementById("feature-filter");
      const listingEl = document.getElementById("feature-listing");

      function renderListings(features) {
        const empty = document.createElement("p");
        listingEl.innerHTML = "";
        if (features.length) {
          for (const feature of features) {
            const itemLink = document.createElement("a");
            const label = `${feature.properties.name} (${feature.properties.abbrev})`;
            itemLink.href = feature.properties.wikipedia;
            itemLink.target = "_blank";
            itemLink.textContent = label;
            itemLink.addEventListener("mouseover", () => {
              popup
                .setLngLat(feature.geometry.coordinates)
                .setText(label)
                .addTo(map);
            });
            listingEl.appendChild(itemLink);
          }
          filterEl.parentNode.style.display = "block";
        } else if (features.length === 0 && filterEl.value !== "") {
          empty.textContent = "No results found";
          listingEl.appendChild(empty);
        } else {
          empty.textContent = "Drag the map to populate results";
          listingEl.appendChild(empty);
          filterEl.parentNode.style.display = "none";
          map.setFilter("pulsing-dot", ["has", "iata_code"]);
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
      // ...
    },
    filterFeatures() {
      console.log("hello");
      // Your filter logic here
    },
    showPopup(feature) {
      console.log("how");
    },
    // Other methods...
  },
};
</script>

<style scoped>
/* Your CSS styles here */
body {
  margin: 0;
  padding: 0;
}
#map {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}

#map {
  position: absolute;
  left: 25%;
  top: 0;
  bottom: 0;
  width: 75%;
}
.map-overlay {
  position: absolute;
  width: 25%;
  top: 0;
  bottom: 0;
  left: 0;
  font: 12px/20px "Helvetica Neue", Arial, Helvetica, sans-serif;
  background-color: #efefef;
  max-height: 100%;
  overflow: hidden;
}

.map-overlay fieldset {
  display: none;
  background: #ddd;
  border: none;
  padding: 10px;
  margin: 0;
}

.map-overlay input {
  display: block;
  border: none;
  width: 100%;
  border-radius: 3px;
  padding: 10px;
  margin: 0;
  box-sizing: border-box;
}

.map-overlay .listing {
  overflow: auto;
  max-height: 100%;
}

.map-overlay .listing > * {
  display: block;
  padding: 5px 10px;
  margin: 0;
}

.map-overlay .listing a {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: #404;
  text-decoration: none;
}

.map-overlay .listing a:last-child {
  border: none;
}

.map-overlay .listing a:hover {
  background: #f0f0f0;
}
</style>
