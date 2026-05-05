const geocodePlace = async (placeName, city) => {
    if (!placeName) return { lat: null, lng: null };

    // If placeName looks like an activity title, extract the venue part
    // e.g. "Boardgame Night at Ferry Building" → "Ferry Building"
    const atIndex = placeName.toLowerCase().indexOf(' at ');
    const inIndex = placeName.toLowerCase().indexOf(' in ');
    const splitIndex = atIndex !== -1 ? atIndex + 4 : inIndex !== -1 ? inIndex + 4 : -1;
    const cleanName = splitIndex !== -1 ? placeName.substring(splitIndex) : placeName;

    const tryGeocode = async (name) => {
        try {
            const query = encodeURIComponent(`${name}, ${city}`);
            const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'TravelPlannerApp/1.0 (contact@youremail.com)',
                    'Accept-Language': 'en'
                }
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.length) return null;
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch {
            return null;
        }
    };

    // Try original name first, then fall back to extracted venue
    const result = await tryGeocode(placeName) 
        ?? await tryGeocode(cleanName) 
        ?? { lat: null, lng: null };

    return result;
};

module.exports = { geocodePlace };