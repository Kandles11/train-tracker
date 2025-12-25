
// read shapes.txt and parse into a usable format for rendering
const shapeData = fetch('shapes.txt').then(response => response.text());
const stopData = fetch('stops.txt').then(response => response.text());

const shapes = [];
const stops = [];
const stations = [];
const vehicles = []; // Store current vehicle positions
const map = document.getElementById('map');
map.width = 1200;
map.height = 1200;
const ctx = map.getContext('2d');

const GTFS_RT_URL = "http://transit.api.masont.dev/vehicle_positions";

// Coordinate conversion system
class CoordinateConverter {
    constructor(canvasWidth, canvasHeight, paddingPercent = 0.05) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.paddingPercent = paddingPercent;
        this.minLat = Infinity;
        this.maxLat = -Infinity;
        this.minLon = Infinity;
        this.maxLon = -Infinity;
        this.initialized = false;
    }

    // Calculate bounding box from shape data (and optionally stops)
    calculateBounds(shapes, stops = []) {
        // Include shapes in bounds
        shapes.forEach(shape => {
            const lat = parseFloat(shape.shapePtLat);
            const lon = parseFloat(shape.shapePtLon);
            
            if (!isNaN(lat) && !isNaN(lon)) {
                this.minLat = Math.min(this.minLat, lat);
                this.maxLat = Math.max(this.maxLat, lat);
                this.minLon = Math.min(this.minLon, lon);
                this.maxLon = Math.max(this.maxLon, lon);
            }
        });
        
        // Also include stops in bounds calculation
        stops.forEach(stop => {
            const lat = parseFloat(stop.stop_lat);
            const lon = parseFloat(stop.stop_lon);
            
            if (!isNaN(lat) && !isNaN(lon)) {
                this.minLat = Math.min(this.minLat, lat);
                this.maxLat = Math.max(this.maxLat, lat);
                this.minLon = Math.min(this.minLon, lon);
                this.maxLon = Math.max(this.maxLon, lon);
            }
        });
        
        // Add padding to the bounds
        const latRange = this.maxLat - this.minLat;
        const lonRange = this.maxLon - this.minLon;
        const latPadding = latRange * this.paddingPercent;
        const lonPadding = lonRange * this.paddingPercent;
        
        this.minLat -= latPadding;
        this.maxLat += latPadding;
        this.minLon -= lonPadding;
        this.maxLon += lonPadding;
        
        this.initialized = true;
    }

    // Convert latitude/longitude to canvas coordinates
    // latitude is Y (north/south), longitude is X (east/west)
    // Canvas Y increases downward, so we need to flip it
    latLonToCanvas(lat, lon) {
        if (!this.initialized) {
            throw new Error('CoordinateConverter not initialized. Call calculateBounds first.');
        }

        // Normalize to 0-1 range
        const normalizedX = (lon - this.minLon) / (this.maxLon - this.minLon);
        const normalizedY = (lat - this.minLat) / (this.maxLat - this.minLat);
        
        // Convert to canvas coordinates
        // X: map directly (longitude -> canvas X)
        // Y: flip because latitude increases north but canvas Y increases downward
        const canvasX = normalizedX * this.canvasWidth;
        const canvasY = (1 - normalizedY) * this.canvasHeight;
        
        return { x: canvasX, y: canvasY };
    }
}

const converter = new CoordinateConverter(map.width, map.height);

// parse the shape data into a usable format
// ignore the first line
function parseShapeData(data) {
    data.split('\n').slice(1).forEach(line => {
        if (line.trim()) {
            const [shapeId, shapePtLat, shapePtLon, shapePtSequence, shapeDistTraveled] = line.split(',');
            shapes.push({ 
                shapeId, 
                shapePtLat: parseFloat(shapePtLat), 
                shapePtLon: parseFloat(shapePtLon), 
                shapePtSequence: parseInt(shapePtSequence), 
                shapeDistTraveled: parseFloat(shapeDistTraveled) 
            });
        }
    });
    console.log(`Parsed ${shapes.length} shape points`);
}

// parse stops data and group by station
function parseStopData(data) {
    const lines = data.split('\n').slice(1); // Skip header
    const stopMap = new Map(); // Maps stop_id to stop object
    const stationsByParent = new Map(); // Groups stops by parent_station
    
    lines.forEach(line => {
        if (!line.trim()) return;
        
        const [
            stop_id, stop_code, platform_code, stop_name, stop_desc,
            stop_lat, stop_lon, zone_id, stop_url, location_type,
            parent_station, stop_timezone, position, direction,
            wheelchair_boarding, tts_stop_name
        ] = line.split(',');
        
        const stop = {
            stop_id,
            stop_code,
            stop_name,
            stop_lat: parseFloat(stop_lat),
            stop_lon: parseFloat(stop_lon),
            location_type: parseInt(location_type) || 0,
            parent_station: parent_station || null
        };
        
        stops.push(stop);
        stopMap.set(stop_id, stop);
        
        // If it's a station (location_type === 1), it's a parent station itself
        if (stop.location_type === 1) {
            if (!stationsByParent.has(stop_id)) {
                stationsByParent.set(stop_id, []);
            }
        } else if (stop.parent_station) {
            // Group by parent_station
            if (!stationsByParent.has(stop.parent_station)) {
                stationsByParent.set(stop.parent_station, []);
            }
            stationsByParent.get(stop.parent_station).push(stop);
        }
    });
    
    // Calculate station positions
    stationsByParent.forEach((stopsAtStation, stationId) => {
        const stationStop = stopMap.get(stationId);
        
        if (stationStop && stationStop.location_type === 1) {
            // Use the station's own coordinates
            stations.push({
                station_id: stationId,
                name: stationStop.stop_name,
                lat: stationStop.stop_lat,
                lon: stationStop.stop_lon,
                stops: stopsAtStation
            });
        } else if (stopsAtStation.length > 0) {
            // Calculate average position of all stops at this station
            const avgLat = stopsAtStation.reduce((sum, s) => sum + s.stop_lat, 0) / stopsAtStation.length;
            const avgLon = stopsAtStation.reduce((sum, s) => sum + s.stop_lon, 0) / stopsAtStation.length;
            
            stations.push({
                station_id: stationId,
                name: stopsAtStation[0].stop_name.replace(/ Northbound| Southbound/g, '').trim(),
                lat: avgLat,
                lon: avgLon,
                stops: stopsAtStation
            });
        }
    });
    
    console.log(`Parsed ${stops.length} stops into ${stations.length} stations`);
}

// draw the shapes, using proper coordinate conversion
function drawShapes(shapes) {
    // Group shapes by shapeId to draw continuous paths
    const shapesByRoute = {};
    shapes.forEach(shape => {
        if (!shapesByRoute[shape.shapeId]) {
            shapesByRoute[shape.shapeId] = [];
        }
        shapesByRoute[shape.shapeId].push(shape);
    });

    // Sort each route's points by sequence
    Object.keys(shapesByRoute).forEach(shapeId => {
        shapesByRoute[shapeId].sort((a, b) => a.shapePtSequence - b.shapePtSequence);
    });

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 0.5;

    // Draw each route as a continuous path
    Object.values(shapesByRoute).forEach(routePoints => {
        if (routePoints.length === 0) return;

        ctx.beginPath();
        const firstPoint = converter.latLonToCanvas(routePoints[0].shapePtLat, routePoints[0].shapePtLon);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < routePoints.length; i++) {
            const point = converter.latLonToCanvas(routePoints[i].shapePtLat, routePoints[i].shapePtLon);
            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
    });
}

// draw stations on the canvas
function drawStations(stations) {
    stations.forEach(station => {
        const canvasPos = converter.latLonToCanvas(station.lat, station.lon);
        
        // Draw station marker (circle)
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// draw vehicles on the canvas
function drawVehicles(vehicles) {
    vehicles.forEach(vehicle => {
        const canvasPos = converter.latLonToCanvas(vehicle.lat, vehicle.lon);
        
        // Draw vehicle marker (colored circle, slightly larger than stations)
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000'; // Red for vehicles
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// Fetch and parse vehicle positions from JSON API
async function fetchVehiclePositions() {
    try {
        const response = await fetch(GTFS_RT_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        
        // Extract vehicle positions from JSON structure
        const newVehicles = [];
        if (jsonData.data && jsonData.data.entity) {
            jsonData.data.entity.forEach(entity => {
                if (entity.vehicle && entity.vehicle.position) {
                    const position = entity.vehicle.position;
                    if (position.latitude != null && position.longitude != null) {
                        newVehicles.push({
                            id: entity.vehicle.vehicle?.id || entity.id || 'unknown',
                            lat: position.latitude,
                            lon: position.longitude,
                            bearing: position.bearing || null,
                            speed: position.speed || null,
                            route_id: entity.vehicle.trip?.route_id || null
                        });
                    }
                }
            });
        }
        
        // Update vehicles array
        vehicles.length = 0;
        vehicles.push(...newVehicles);
        
        console.log(`Fetched ${vehicles.length} vehicle positions`);
        
        // Redraw the map with updated vehicle positions
        redrawMap();
        
    } catch (error) {
        console.error('Error fetching vehicle positions:', error);
    }
}

// Redraw the entire map (routes, stations, and vehicles)
function redrawMap() {
    // Clear the canvas
    ctx.clearRect(0, 0, map.width, map.height);
    
    // Draw routes (background)
    drawShapes(shapes);
    
    // Draw stations
    drawStations(stations);
    
    // Draw vehicles on top
    drawVehicles(vehicles);
}


// Load and process both shapes and stops data
Promise.all([shapeData, stopData]).then(([shapeText, stopText]) => {
    parseShapeData(shapeText);
    parseStopData(stopText);
    
    // Initialize coordinate converter with both shape and stop data bounds
    converter.calculateBounds(shapes, stops);
    console.log('Bounds:', {
        minLat: converter.minLat,
        maxLat: converter.maxLat,
        minLon: converter.minLon,
        maxLon: converter.maxLon
    });
    
    // Initial draw of routes and stations
    redrawMap();
    
    // Start fetching vehicle positions every minute
    fetchVehiclePositions(); // Initial fetch
    setInterval(fetchVehiclePositions, 30000); // Update every 60 seconds
});
