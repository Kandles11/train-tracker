import asyncio
import os
import time
from contextlib import asynccontextmanager
from typing import Optional
import aiohttp
from dotenv import load_dotenv
from google.transit import gtfs_realtime_pb2
from google.protobuf.json_format import MessageToDict
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables from .env file
load_dotenv()

# Global storage for vehicle position data
vehicle_positions_data: Optional[dict] = None
last_update_time: Optional[float] = None

API_KEY = os.getenv("API_KEY")
AGENCY = os.getenv("AGENCY", "CT")  # Default to "CT" if not set

if not API_KEY:
    raise ValueError("API_KEY environment variable is required. Please set it in your .env file.")

GTFS_RT_URL = f"http://api.511.org/transit/vehiclepositions?api_key={API_KEY}&agency={AGENCY}"


async def fetch_vehicle_positions():
    """Fetch vehicle positions from the 511.org API and store in memory."""
    global vehicle_positions_data, last_update_time
    
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(GTFS_RT_URL, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        # Read the protobuf data
                        content = await response.read()
                        
                        # Parse protobuf
                        feed = gtfs_realtime_pb2.FeedMessage()
                        feed.ParseFromString(content)
                        
                        # Convert to dict for JSON serialization
                        vehicle_positions_data = MessageToDict(
                            feed,
                            always_print_fields_with_no_presence=True,
                            preserving_proto_field_name=True
                        )
                        last_update_time = time.time()
                        
                        print(f"Successfully fetched {len(feed.entity)} vehicle entities")
                    else:
                        print(f"Error fetching data: HTTP {response.status}")
            except asyncio.TimeoutError:
                print("Timeout error while fetching vehicle positions")
            except Exception as e:
                print(f"Exception occurred while fetching vehicle positions: {e}")
            
            # Wait 60 seconds before next fetch
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage the lifecycle of background tasks."""
    # Start the background polling task
    task = asyncio.create_task(fetch_vehicle_positions())
    yield
    # Cleanup: cancel the task when the app shuts down
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Caltrain RT Transit Data API", lifespan=lifespan)

# Add CORS middleware for public API access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Public API - allow requests from any origin
    allow_credentials=False,  # Must be False when allow_origins is ["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint providing API information."""
    return {
        "message": "Caltrain RT Transit Data API",
        "endpoints": {
            "vehicle_positions": "/vehicle_positions",
            "docs": "/docs"
        }
    }


@app.get("/vehicle_positions")
async def get_vehicle_positions():
    """Get the latest vehicle position data from the GTFS-RT feed."""
    if vehicle_positions_data is None:
        raise HTTPException(
            status_code=503,
            detail="Vehicle position data not yet available. Please try again in a moment."
        )
    
    return {
        "data": vehicle_positions_data,
        "last_update_time": last_update_time
    }