// Nizari Isma'ili significant locations
// Coordinates used to computationally generate unique patterns + silhouettes

export const LOCATIONS = {
  india: {
    name: 'India',
    subtitle: 'Gujarat',
    people: 'Khoja & Momna peoples',
    lat: 23.02,
    lon: 72.57,
  },
  pakistan: {
    name: 'Pakistan',
    subtitle: 'Hunza Valley',
    people: 'Hunza / Burusho people',
    lat: 36.32,
    lon: 74.65,
  },
  centralasia: {
    name: 'Central Asia',
    subtitle: 'Badakhshan & Xinjiang',
    people: 'Pamiri people',
    lat: 37.12,
    lon: 71.55,
  },
  iran: {
    name: 'Iran',
    subtitle: 'Kerman Province',
    people: 'Governate of Aga Khan I',
    lat: 30.28,
    lon: 57.08,
  },
  syria: {
    name: 'Syria',
    subtitle: 'Al-Ladhiqiyyah',
    people: 'Misari people',
    lat: 35.52,
    lon: 35.79,
  },
  portugal: {
    name: 'Portugal',
    subtitle: 'Lisbon',
    people: 'Seat of Nizari Isma\'iliyyah',
    lat: 38.72,
    lon: -9.14,
  },
  aswan: {
    name: 'Egypt',
    subtitle: 'Aswan',
    people: '',
    lat: 24.09,
    lon: 32.90,
  },
};

// Geographic order — always maintained when toggling locations
export const GEO_ORDER = ['india', 'pakistan', 'centralasia', 'iran', 'syria', 'portugal', 'aswan'];

// Distinct color per location — used for portion overlays in the design tool
export const LOCATION_COLORS = {
  india:       '#4caf50',  // green
  pakistan:    '#ff9800',  // orange
  centralasia: '#9c27b0',  // purple
  iran:        '#f44336',  // red
  syria:       '#e91e63',  // magenta
  portugal:    '#2196f3',  // blue
  aswan:       '#00bcd4',  // cyan
};

// Option sets — each represents a different arrangement of stops on the wall
export const OPTIONS = {
  1: {
    label: 'Option 1',
    stops: 4,
    locations: ['india', 'pakistan', 'iran', 'aswan'],
  },
  2: {
    label: 'Option 2',
    stops: 7,
    locations: ['india', 'pakistan', 'centralasia', 'iran', 'syria', 'portugal', 'aswan'],
  },
  3: {
    label: 'Option 3',
    stops: 6,
    locations: ['india', 'pakistan', 'centralasia', 'iran', 'syria', 'aswan'],
  },
};
