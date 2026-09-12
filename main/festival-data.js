window.festivalEvents = [
  {
    id: 'ars-electronica',
    name: 'Ars Electronica Festival',
    category: 'Art & technology',
    description: 'Center for media art, AI and interactive installations in Linz.',
    lat: 48.3098,
    lng: 14.2842
  },
  {
    id: 'linz-kultur-sommer',
    name: 'Linz Summer Culture',
    category: 'Culture',
    description: 'Summer cultural and music events across the city.',
    lat: 48.3056,
    lng: 14.2864
  },
  {
    id: 'jazz-city',
    name: 'Jazz in the City',
    category: 'Music',
    description: 'Live jazz in the city center and on public squares.',
    lat: 48.3034,
    lng: 14.2889
  },
  {
    id: 'film-festival',
    name: 'Film Festival Linz',
    category: 'Film',
    description: 'Film screenings, discussions and events in the cultural district.',
    lat: 48.3007,
    lng: 14.2878
  },
  {
    id: 'donaufest',
    name: 'Danube Festival',
    category: 'Leisure',
    description: 'Open-air events and crowds along the Danube waterfront.',
    lat: 48.3008,
    lng: 14.2857
  },
  {
    id: 'nachtleben',
    name: 'Linz Nightline',
    category: 'Nightlife',
    description: 'Music, clubs and evening programming in downtown Linz.',
    lat: 48.2995,
    lng: 14.3120
  }
];

window.festivalLocations = [
  { name: 'Ars Electronica Center', type: 'Museum / AI / VR', lat: 48.3098, lng: 14.2842, description: 'Center for media art, Deep Space 8K and AI labs in Linz.' },
  { name: 'OK Center / OK Quarter', type: 'Exhibition / Art / Festival', lat: 48.3032, lng: 14.2902, description: 'Major art and festival venue in central Linz.' },
  { name: 'Lentos Art Museum Linz', type: 'Museum / Exhibition', lat: 48.3085, lng: 14.2875, description: 'Contemporary art and exhibitions right in the city center.' },
  { name: 'Main Square Linz', type: 'City square / info / food', lat: 48.3056, lng: 14.2864, description: 'Central city square with cafés, market and festival atmosphere.' },
  { name: 'Danube Park / Danube Waterfront', type: 'Walking / viewpoint / leisure', lat: 48.3008, lng: 14.2857, description: 'Beautiful riverside promenade along the Danube in Linz.' },
  { name: 'Med Campus JKU Linz', type: 'Science / technology', lat: 48.3005, lng: 14.2990, description: 'Technology and science locations around Johannes Kepler University.' },
  { name: 'Posthof Linz', type: 'Culture / concert / nightlife', lat: 48.2995, lng: 14.3120, description: 'Popular venue for concerts, culture and evening programs.' },
  { name: 'State Gallery Linz / City Museum', type: 'Museum / culture', lat: 48.3051, lng: 14.2837, description: 'Cultural and art institution in the heart of Linz.' },
  { name: 'Cubus Restaurant & Bistro', type: 'Food / drinks', lat: 48.3099, lng: 14.2843, description: 'Good restaurant close to the Ars Electronica Center.' },
  { name: 'Foodcourt at Main Square', type: 'Food / street food', lat: 48.3058, lng: 14.2862, description: 'Many options for snacks, lunch and street food in the center.' },
  { name: 'Public toilet at Main Square', type: 'Toilet / WC', lat: 48.3059, lng: 14.2861, description: 'Public restroom in central Linz.' },
  { name: 'Castle Museum / Old Town', type: 'Sightseeing / city history', lat: 48.3052, lng: 14.2857, description: 'Historic district with old-town character and landmarks.' },

  // Real data points from the project datasets in /data and the Ars Electronica open-data catalog
  { name: 'Adalbert Stifter Institute AED', type: 'Emergency / defibrillator', lat: 48.307533, lng: 14.288317, description: 'Accessible public defibrillator near Adalbert-Stifter-Platz in the city center.' },
  { name: 'Landhausplatz AED', type: 'Emergency / defibrillator', lat: 48.304633, lng: 14.286183, description: 'Emergency defibrillator at Landhausplatz in central Linz.' },
  { name: 'Am Winterhafen AED', type: 'Emergency / defibrillator', lat: 48.318367, lng: 14.304317, description: 'Defibrillator at the Winterhafen area on the Danube side.' },
  { name: 'Volksschule / city AED', type: 'Emergency / defibrillator', lat: 48.29269, lng: 14.29573, description: 'Public emergency defibrillator location near the city center and residential area.' },
  { name: 'White Birch Tree', type: 'Nature / tree landmark', lat: 48.31945538154956, lng: 14.2592497676175, description: 'A real birch tree from the municipal tree inventory in Linz.' },
  { name: 'Bird Cherry Tree', type: 'Nature / tree landmark', lat: 48.29718299366039, lng: 14.27669267338376, description: 'A real bird cherry tree from the Linz tree atlas.' },
  { name: 'Walnut Tree', type: 'Nature / tree landmark', lat: 48.32541074464426, lng: 14.30435018403341, description: 'A real walnut tree from the city tree database, located on the north side of Linz.' },
  { name: 'Tulip Tree', type: 'Nature / tree landmark', lat: 48.33178185431577, lng: 14.30248072184989, description: 'A real tulip tree from the Linz tree registry in a green urban area.' },

  // Additional points inspired by the Ars Electronica open-data datasets list
  { name: 'Public WC at Hauptplatz', type: 'Public toilet / city service', lat: 48.3053, lng: 14.2867, description: 'Public toilet facility in the central city area, useful for day visitors and festival guests.' },
  { name: 'Drinking fountain at Volksgarten', type: 'Water / public utility', lat: 48.2947, lng: 14.2930, description: 'Public drinking fountain and cooling stop in the city park area of Linz.' },
  { name: 'Linz AG bus stop at Hauptplatz', type: 'Transit / mobility', lat: 48.3056, lng: 14.2864, description: 'Key mobility hub and public transport stop close to the city center and festival routes.' },
  { name: 'Donaupark playground', type: 'Leisure / family / sport', lat: 48.3008, lng: 14.2857, description: 'A public recreation area with open space, greenery and practical outdoor activity options.' },
  { name: 'Public Wi-Fi hotspot at Main Square', type: 'Connectivity / digital service', lat: 48.3057, lng: 14.2865, description: 'Public Wi-Fi hotspot near the central square for visitors and festival-goers.' },
  { name: 'Pöstlingberg viewpoint', type: 'Sightseeing / panorama', lat: 48.3235, lng: 14.2573, description: 'Historic lookout point above Linz with sweeping views over the city and Danube.' },
  { name: 'Posthof cultural venue', type: 'Culture / events / music', lat: 48.2995, lng: 14.3120, description: 'Cultural venue in Linz that hosts concerts, events, and late-night programming.' },
  { name: 'Biesenfeld park berry hedge', type: 'Food / nature / local discovery', lat: 48.3001, lng: 14.2948, description: 'Edible berry planting area listed in Linz city datasets highlighting urban food culture.' },
  { name: 'Auhof sports area', type: 'Sport / wellness', lat: 48.333383, lng: 14.320917, description: 'Sports and recreational area in the northern part of Linz, useful for active visitors.' },
  { name: 'Lentos Art Museum', type: 'Culture / museum', lat: 48.3085, lng: 14.2875, description: 'Contemporary art museum and one of the most relevant culture venues in central Linz.' },
  { name: 'Austrian city park / urban green space', type: 'Nature / rest / walking', lat: 48.3127, lng: 14.2809, description: 'Open green area in the city suitable for a walk, break, or quick public stop.' },
  { name: 'Old Town heritage route', type: 'Sightseeing / culture', lat: 48.3052, lng: 14.2837, description: 'Historic district route in central Linz with architecture, cafes and landmarks.' },

  // More everyday essentials and city help points for visitors who do not know Linz yet
  { name: 'Müller Apotheke Linz', type: 'Pharmacy / health', lat: 48.3049, lng: 14.2874, description: 'Pharmacy near the city center for essentials, travel health products and advice.' },
  { name: 'Linz City Pharmacy', type: 'Pharmacy / health', lat: 48.3087, lng: 14.2870, description: 'Convenient pharmacy stop close to major cultural and festival routes.' },
  { name: 'Aldi Linz City Center', type: 'Supermarket / groceries', lat: 48.3050, lng: 14.2938, description: 'Budget supermarket for snacks, water, and quick essentials near central Linz.' },
  { name: 'Hofer Hauptplatz', type: 'Supermarket / groceries', lat: 48.3054, lng: 14.2855, description: 'Neighborhood supermarket with easy access for last-minute groceries and refreshments.' },
  { name: 'Billa Main Square', type: 'Supermarket / groceries', lat: 48.3057, lng: 14.2868, description: 'Large supermarket just off the central square for food and everyday items.' },
  { name: 'Bakeria Linz Old Town', type: 'Bakery / breakfast', lat: 48.3060, lng: 14.2847, description: 'Fresh bakery for breakfast, coffee, and easy warm snacks before exploring the city.' },
  { name: 'Tabakfabrik bakery – Honeder', type: 'Bakery / breakfast / local food', lat: 48.3113, lng: 14.2887, description: 'One of the bakeries around the Tabakfabrik area in Linz, known for fresh bread and local bakery favorites.' },
  { name: 'Tabakfabrik bakery – second bakery', type: 'Bakery / coffee / local food', lat: 48.3110, lng: 14.2892, description: 'A second bakery in the Tabakfabrik district, perfect for coffee, pastries and quick city breaks.' },
  { name: 'Café Kulturzentrum', type: 'Cafe / coffee / rest', lat: 48.3046, lng: 14.2893, description: 'Good coffee and seating area close to the cultural quarter and museums.' },
  { name: 'Linz Bike Rental Center', type: 'Transport / bicycle', lat: 48.3071, lng: 14.2890, description: 'Bike rental point for moving around the city quickly and enjoying the Danube route.' },
  { name: 'City Tourist Info Linz', type: 'Information / visitor help', lat: 48.3058, lng: 14.2862, description: 'Tourist information point to get maps, tips and local recommendations in central Linz.' },
  { name: 'Austrian Cultural House', type: 'Culture / events / information', lat: 48.3032, lng: 14.2908, description: 'Important cultural hub with events, public art and useful local information.' },
  { name: 'Pension / Hotel District', type: 'Accommodation / rest', lat: 48.3039, lng: 14.2915, description: 'Area with hotels, hostels and lodging options close to the main city center.' },
  { name: 'ÖBB / central rail station area', type: 'Transport / train / station', lat: 48.2916, lng: 14.2934, description: 'Important rail station area with train connections, taxis and onward travel options.' },
  { name: 'Linz Public Library', type: 'Library / quiet place / Wi-Fi', lat: 48.3075, lng: 14.2850, description: 'Quiet public library and digital space with seating, internet access and city information.' },
  { name: 'Friedensplatz park', type: 'Park / rest / walking', lat: 48.3025, lng: 14.2788, description: 'Relaxing green space near central Linz for a break, walk or quick pause.' },
  { name: 'Stadtpark Linz', type: 'Park / nature / picnic', lat: 48.3108, lng: 14.2793, description: 'Large city park with paths, greenery and an easy place to rest between activities.' },
  { name: 'Danube cycle path', type: 'Walking / cycling / scenic route', lat: 48.3001, lng: 14.2865, description: 'Scenic route along the Danube ideal for cycling, walking and taking in city views.' },
  { name: 'Linz central tram stop', type: 'Transit / mobility', lat: 48.3061, lng: 14.2869, description: 'Core tram and public transport stop for getting around Linz quickly and comfortably.' },
  { name: 'Night market central Linz', type: 'Food / nightlife / culture', lat: 48.3050, lng: 14.2875, description: 'Popular evening venue for food, drinks and lively local atmosphere during festival time.' },
  { name: 'Rotax Max Dome', type: 'Leisure / indoor activity / sport', lat: 48.2999, lng: 14.2951, description: 'Indoor karting and motorsport venue for active leisure, group fun and an exciting break from sightseeing.' },
  { name: 'JumpDome Linz', type: 'Leisure / family / indoor fun', lat: 48.3182, lng: 14.2974, description: 'Indoor trampoline park for active leisure, family fun and energetic daytime outings in Linz.' },
  { name: 'Parkbad Linz', type: 'Leisure / wellness / swimming', lat: 48.2984, lng: 14.2760, description: 'Public indoor and outdoor pool complex with wellness, swimming and relaxation options for all ages.' }
];
