<script setup>
import mapboxgl from "mapbox-gl";
import { ref } from "vue";
import "mapbox-gl/dist/mapbox-gl.css";
</script>

<template>
  <div>
    <div id="map" ref="mapContainer"></div>

    <div class="map-overlay">
      <fieldset>
        <input
          id="feature-filter"
          type="text"
          placeholder="Filter results by name"
          v-model="filterText"
        />
      </fieldset>
      <div id="feature-listing" class="listing"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: "MapboxComponent",
  setup() {
    return { customePop: ref(null) };
  },
  data() {
    return {
      map: null,
      popup: null,
      airports: [],
      filterText: "",
      filteredAirports: [],
      features: "",
      filterEl: null,
      listingEl: null,
      loaded: false,
    };
  },

  mounted() {
    this.initMap();
  },
  methods: {
    initMap: function () {
      this.map = new mapboxgl.Map({
        accessToken:
          "pk.eyJ1Ijoic2hvcnRkaXYiLCJhIjoiY2l3OGc5YmE5MDJzZjJ5bWhkdDZieGdzcSJ9.1z-swTWtcCHYI_RawDJCEw",
        container: this.$refs.mapContainer, // Specify the container ID where the map will be rendered
        center: [135, -27.5], // Set the initial center of the map to [20, -4]
        zoom: 4, // Set the initial zoom level of the map
        // style: "mapbox://styles/mapbox/light-v10", // Choose a Mapbox style for the map
        style: "mapbox://styles/mapbox/streets-v12",
      });
      // Holds visible airport features for filtering

      // // Create a popup, but don't add it to the map yet.
      this.popup = new mapboxgl.Popup({
        closeButton: false,
      });

      const size = 65; // Adjust the size of the pulsing dot
      const _this = this;
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

          _this.map.triggerRepaint();

          return true;
        },
      };

      this.map.on("load", () => {
        this.loaded = true;
        this.map.addSource("airports", {
          type: "vector",
          url: "mapbox://mapbox.04w69w5j",
        });
        this.map.addLayer({
          id: "airport",
          source: "airports",
          "source-layer": "ne_10m_airports",
          type: "circle",
          filter: ["==", "isState", true],
          paint: {
            "circle-color": "#4264fb",
            "circle-radius": 4,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        this.map.on("movestart", () => {
          // this.map.setFilter("pulsing-dot", ["has", "iata_code"]); // Assuming 'iata_code' is the property to filter
          this.map.setFilter("airport", ["has", "abbrev"]);
        });

        this.map.on("moveend", () => {
          const features = this.map.queryRenderedFeatures({
            layers: ["airport"],
          });

          if (features) {
            const uniqueFeatures = this.getUniqueFeatures(
              features,
              "iata_code"
            );
            this.renderListings(uniqueFeatures);
            this.airports = uniqueFeatures;
          }
        });

        this.map.on("mousemove", "airport", (e) => {
          this.map.getCanvas().style.cursor = "pointer";

          const feature = e.features[0];
          this.popup
            .setLngLat(feature.geometry.coordinates)
            .setText(
              `${feature.properties.name} (${feature.properties.abbrev})`
            )
            .addTo(this.map);
          const divElement = document.getElementById("feature-listing");
          let displayText =
            feature.properties.name + " (" + feature.properties.abbrev + ")";
          const specificElement = Array.from(
            divElement.getElementsByTagName("a")
          ).find((a) => a.textContent === displayText);
          specificElement.style.backgroundColor = "yellow";
        });

        this.map.on("mouseleave", "airport", () => {
          this.map.getCanvas().style.cursor = "";
          this.popup.remove();
          document
            .getElementById("feature-listing")
            .querySelectorAll("a")
            .forEach((a) => (a.style.backgroundColor = "transparent"));
        });

        this.filterEl.addEventListener("keyup", (e) => {
          const value = this.normalize(e.target.value);

          const filtered = [];
          for (const feature of this.airports) {
            const name = this.normalize(feature.properties.name);
            const code = this.normalize(feature.properties.abbrev);
            if (name.includes(value) || code.includes(value)) {
              filtered.push(feature);
            }
          }

          this.renderListings(filtered);

          if (filtered.length) {
            this.map.setFilter("airport", [
              "match",
              ["get", "abbrev"],
              filtered.map((feature) => {
                return feature.properties.abbrev;
              }),
              true,
              false,
            ]);
          }
        });

        this.renderListings([]);
      });

      (this.filterEl = document.getElementById("feature-filter")),
        (this.listingEl = document.getElementById("feature-listing"));
    },
    renderListings: function (features) {
      const empty = document.createElement("p");
      this.listingEl.innerHTML = "";
      if (features.length) {
        for (const feature of features) {
          const itemLink = document.createElement("a");
          const label = `${feature.properties.name} (${feature.properties.abbrev})`;
          itemLink.href = feature.properties.wikipedia;
          itemLink.target = "_blank";
          itemLink.textContent = label;
          itemLink.addEventListener("mouseover", () => {
            this.popup
              .setLngLat(feature.geometry.coordinates)
              .setText(label)
              .addTo(this.map);
          });
          this.listingEl.appendChild(itemLink);
        }
        this.filterEl.parentNode.style.display = "block";
      } else if (features.length === 0 && this.filterEl.value !== "") {
        empty.textContent = "No results found";
        this.listingEl.appendChild(empty);
      } else {
        empty.textContent = "Drag the map to populate results";
        this.listingEl.appendChild(empty);
        this.filterEl.parentNode.style.display = "none";
        this.map.setFilter("airport", ["has", "abbrev"]);
      }
    },
    normalize: function (string) {
      return string.trim().toLowerCase();
    },
    getUniqueFeatures: function (features, comparatorProperty) {
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

/* .mapboxgl-popup {
  max-width: 400px;
  font: 12px/20px "Helvetica Neue", Arial, Helvetica, sans-serif;
} */
</style>
