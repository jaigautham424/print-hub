const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const skipNames = ['loopback', 'pseudo', 'isatap', 'tunnel', 'teredo', '6to4'];
  const wifiNames = ['wi-fi', 'wlan', 'wireless', 'wifi'];
  const hotspotNames = ['local area connection', 'microsoft wi-fi direct', 'mobile', 'hotspot', 'tether', 'rndis'];

  function findIP(filterFn) {
    for (const name of Object.keys(interfaces)) {
      const lower = name.toLowerCase();
      if (skipNames.some(s => lower.includes(s))) continue;
      if (!filterFn(lower)) continue;
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return { address: iface.address, interface: name };
        }
      }
    }
    return null;
  }

  // Priority 1: WiFi (the main internet connection)
  const wifi = findIP(lower => wifiNames.some(w => lower.includes(w)));
  if (wifi) return wifi.address;

  // Priority 2: Hotspot/tethering adapter
  const hotspot = findIP(lower => hotspotNames.some(h => lower.includes(h)));
  if (hotspot) return hotspot.address;

  // Priority 3: Any non-internal IPv4
  const any = findIP(() => true);
  if (any) return any.address;

  return '127.0.0.1';
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const skipNames = ['loopback', 'pseudo', 'isatap', 'tunnel', 'teredo', '6to4'];
  const wifiNames = ['wi-fi', 'wlan', 'wireless', 'wifi'];
  const results = [];

  for (const name of Object.keys(interfaces)) {
    const lower = name.toLowerCase();
    if (skipNames.some(s => lower.includes(s))) continue;
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const type = wifiNames.some(w => lower.includes(w)) ? 'wifi' : 'other';
        results.push({ name, address: iface.address, mac: iface.mac, type });
      }
    }
  }
  return results;
}

function getNetworkName() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return name;
      }
    }
  }
  return 'Unknown';
}

function getMacAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.mac;
      }
    }
  }
  return 'Unknown';
}

module.exports = { getLocalIP, getNetworkInfo, getNetworkName, getMacAddress };
