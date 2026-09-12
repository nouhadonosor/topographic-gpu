const renderDefaults = {
  width: 1280,
  height: 900,
  padding: 40,
  lineWidth: 1,
  background: '#35280d',
  fill: '#ffc857',
  contour: '#010101',
  cellSize: 1.5,
  noiseScale: 340,
  persistence: 0.24,
  octaves: 6,
  sigmoidIntensity: 8.5,
  contourDensity: 13,
  thresholdRange: 0.9,
  gradientEnabled: true,
  gradientStops: [
    { position: 0, color: '#ffc857' },
    { position: 0.5, color: '#f07b52' },
    { position: 1, color: '#d64550' }
  ],
  animationSpeed: 0.15,
  perfectLoop: false,
  animationMode: 'evolve',
  videoBitrate: 80,
  seed: 1,
  animate: false,
  duration: 5,
  panX: 0,
  panY: 0
};
const shareOptionKeys = Object.keys(renderDefaults);

const animationModeIds = {
  evolve: 0,
  drift: 1,
  tide: 2,
  breathe: 3,
  warp: 4,
  rotate: 5
};

const resolutionPresets = {
  hd: [1280, 720],
  'full-hd': [1920, 1080],
  qhd: [2560, 1440],
  '4k': [3840, 2160],
  ultrawide: [2560, 1080],
  'ultrawide-qhd': [3440, 1440]
};

const optionRanges = {
  width: [320, 3840], height: [240, 2160], padding: [0, 160], lineWidth: [0.25, 5],
  cellSize: [1, 12], noiseScale: [40, 700], persistence: [0.1, 0.95], octaves: [1, 20],
  sigmoidIntensity: [0.5, 20], contourDensity: [1, 40], thresholdRange: [0.05, 1],
  animationSpeed: [0, 10], videoBitrate: [1, 100], seed: [0, 100], duration: [1, 30]
};

function getClosestResolutionPreset(width, height) {
  return Object.entries(resolutionPresets).reduce((closest, entry) => {
    const [key, dimensions] = entry;
    const distance = Math.hypot(dimensions[0] - width, dimensions[1] - height);
    return distance < closest.distance ? { key, distance } : closest;
  }, { key: 'hd', distance: Number.POSITIVE_INFINITY }).key;
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64ToBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function getOptionsFromUrl() {
  const encoded = new URLSearchParams(window.location.search).get('settings');
  const defaults = () => Object.assign({}, renderDefaults, { gradientStops: renderDefaults.gradientStops.map(stop => Object.assign({}, stop)) });
  if (!encoded) return defaults();

  let parsed;
  try {
    const stream = new Blob([base64ToBytes(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'));
    parsed = JSON.parse(await new Response(stream).text());
  } catch {
    return defaults();
  }
  if (Array.isArray(parsed)) parsed = Object.fromEntries(shareOptionKeys.map((key, index) => [key, parsed[index]]));

  const options = defaults();
  Object.keys(renderDefaults).forEach(key => {
    const value = parsed[key];
    if (typeof value === 'number' && Number.isFinite(value) && (!optionRanges[key] || (value >= optionRanges[key][0] && value <= optionRanges[key][1]))) options[key] = value;
    if (typeof value === 'string' && key === 'animationMode' && animationModeIds[value] !== undefined) options[key] = value;
    if (typeof value === 'string' && ['background', 'fill', 'contour'].includes(key) && /^#[0-9a-f]{6}$/i.test(value)) options[key] = value.toLowerCase();
    if (typeof value === 'boolean' && ['gradientEnabled', 'perfectLoop', 'animate'].includes(key)) options[key] = value;
  });
  if (Array.isArray(parsed.gradientStops) && parsed.gradientStops.length >= 2 && parsed.gradientStops.length <= 8) {
    const stops = parsed.gradientStops.filter(stop => stop && Number.isFinite(stop.position) && stop.position >= 0 && stop.position <= 1 && typeof stop.color === 'string' && /^#[0-9a-f]{6}$/i.test(stop.color));
    if (stops.length === parsed.gradientStops.length && stops.every((stop, index) => index === 0 || stop.position >= stops[index - 1].position)) {
      options.gradientStops = stops.map(stop => ({ position: stop.position, color: stop.color.toLowerCase() }));
    }
  }
  return options;
}

async function writeOptionsToUrl(options) {
  const url = new URL(window.location.href);
  const stream = new Blob([JSON.stringify(shareOptionKeys.map(key => options[key]))]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  url.searchParams.set('settings', bytesToBase64(compressed));
  window.history.replaceState(null, '', url);
}
