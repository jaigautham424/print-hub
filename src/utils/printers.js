const { execSync } = require('child_process');

function detectPrinters() {
  try {
    const output = execSync('powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Type | ConvertTo-Json"', {
      encoding: 'utf-8',
      timeout: 15000,
    });

    let printers = [];
    const parsed = JSON.parse(output);
    const arr = Array.isArray(parsed) ? parsed : [parsed];

    for (const p of arr) {
      if (!p.Name || p.Type === 4) continue; // skip virtual/file printers
      const statusMap = { 0: 'idle', 1: 'idle', 2: 'busy', 3: 'idle', 4: 'idle' };
      printers.push({
        name: p.Name,
        system_name: p.Name,
        port_name: p.PortName || 'Unknown',
        driver_name: p.DriverName || 'Unknown',
        status: statusMap[p.PrinterStatus] || 'idle',
        is_online: p.PrinterStatus !== 4,
      });
    }

    return printers.length > 0 ? printers : getFallbackPrinters();
  } catch (err) {
    return getFallbackPrinters();
  }
}

function getFallbackPrinters() {
  try {
    const output = execSync('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', {
      encoding: 'utf-8',
      timeout: 10000,
    });

    const printers = [];
    const lines = output.split('\n').map(l => l.trim()).filter(l => l && !l.includes('WARNING'));
    for (const name of lines) {
      printers.push({
        name,
        system_name: name,
        port_name: 'Unknown',
        driver_name: 'Unknown',
        status: 'idle',
        is_online: true,
      });
    }
    return printers;
  } catch (err) {
    return [];
  }
}

function getDefaultPrinter() {
  try {
    const output = execSync('powershell -Command "(Get-Printer | Where-Object {$_.Default -eq $true}).Name"', {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const name = output.trim();
    return name || null;
  } catch (err) {
    return null;
  }
}

module.exports = { detectPrinters, getDefaultPrinter };
