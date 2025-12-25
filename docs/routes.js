// Caltrain GTFS stop coordinates (north -> south) taken directly from docs/stops.txt
// using the parent-station rows (and 22nd_street) so lat/lon match the feed exactly.
const RAW_STOPS = [
  { code: "SF",   name: "San Francisco",       lat: 37.776404,        lon: -122.394911 },
  { code: "22ND", name: "22nd Street",         lat: 37.756972,        lon: -122.392492 },
  { code: "BAY",  name: "Bayshore",            lat: 37.70766,         lon: -122.401665 },
  { code: "SSF",  name: "South San Francisco", lat: 37.655941416,     lon: -122.404979006 },
  { code: "SBR",  name: "San Bruno",           lat: 37.630460335,     lon: -122.411709042 },
  { code: "MLB",  name: "Millbrae",            lat: 37.5999,          lon: -122.38675 },
  { code: "BRD",  name: "Broadway",            lat: 37.58726,         lon: -122.362 },
  { code: "BUR",  name: "Burlingame",          lat: 37.57985,         lon: -122.34418 },
  { code: "SMT",  name: "San Mateo",           lat: 37.56824,         lon: -122.3239 },
  { code: "HWP",  name: "Hayward Park",        lat: 37.553161,        lon: -122.309494 },
  { code: "HIL",  name: "Hillsdale",           lat: 37.542392678,     lon: -122.301612061 },
  { code: "BEL",  name: "Belmont",             lat: 37.52133,         lon: -122.2763 },
  { code: "SCA",  name: "San Carlos",          lat: 37.508033,        lon: -122.2602 },
  { code: "RWC",  name: "Redwood City",        lat: 37.485865,        lon: -122.2315 },
  { code: "MEN",  name: "Menlo Park",          lat: 37.4548,          lon: -122.18245 },
  { code: "PAO",  name: "Palo Alto",           lat: 37.44322,         lon: -122.16429 },
  { code: "CAL",  name: "California Ave",      lat: 37.428834,        lon: -122.14113 },
  { code: "SAT",  name: "San Antonio",         lat: 37.407239431,     lon: -122.107115562 },
  { code: "MTV",  name: "Mountain View",       lat: 37.395067,        lon: -122.07722 },
  { code: "SVL",  name: "Sunnyvale",           lat: 37.378934,        lon: -122.0315 },
  { code: "LWR",  name: "Lawrence",            lat: 37.3707,          lon: -121.9969 },
  { code: "SNTC", name: "Santa Clara",         lat: 37.353384,        lon: -121.936465 },
  { code: "CP",   name: "College Park",        lat: 37.34289,         lon: -121.91565 },
  { code: "SJD",  name: "San Jose Diridon",    lat: 37.329694,        lon: -121.903208 },
  { code: "TAM",  name: "Tamien",              lat: 37.31269,         lon: -121.8847 },
  { code: "CAP",  name: "Capitol",             lat: 37.284016,        lon: -121.841899 },
  { code: "BLH",  name: "Blossom Hill",        lat: 37.252606,        lon: -121.797907 },
  { code: "MHL",  name: "Morgan Hill",         lat: 37.129644,        lon: -121.650558 },
  { code: "SMN",  name: "San Martin",          lat: 37.085984,        lon: -121.61048 },
  { code: "GLY",  name: "Gilroy",              lat: 37.004466,        lon: -121.566727 },
];

const MAP_BOUNDS = {
  latMax: 37.85049,   // north edge
  latMin: 37.29764,   // south edge
  lonMin: -122.47559, // west edge
  lonMax: -122.03819, // east edge
};

function projectToGrid(stops, width, height, padding = 2) {
  const { latMax, latMin, lonMin, lonMax } = MAP_BOUNDS;

  const xScale = (width  - 1 - 2 * padding) / (lonMax - lonMin);
  const yScale = (height - 1 - 2 * padding) / (latMax - latMin);

  return stops.map((s) => {
    const x = Math.round((s.lon - lonMin) * xScale + padding);
    // higher lat → larger logical y, then drawPixel flips it to appear at top
    const y = Math.round((s.lat - latMin) * yScale + padding);
    return { ...s, x, y };
  });
}

// Expose a helper so index.js can recompute if the display size changes.
function getProjectedStops(width = 64, height = 128) {
  return projectToGrid(RAW_STOPS, width, height, 2);
}

// Default projection for the current LED matrix size.
const STATIONS = getProjectedStops();

const routes = {
  RED: {
    color: [255, 0, 0],
    path: STATIONS.map((s) => [s.x, s.y]),
  },
  BLUE: {
    color: [0, 0, 255],
    // simple horizontal reference line kept for testing; remove if not needed
    path: [
      [2, 40],
      [61, 40],
    ],
  },
};
