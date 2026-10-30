import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

function useServerUrl() {
  const [url, setUrl] = useState('http://localhost:3000');
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServerUrl().then(setUrl).catch(() => {});
      window.electronAPI.getServerStatus().then((status) => {
        if (status.running && status.port) setUrl(`http://localhost:${status.port}`);
      }).catch(() => {});
      window.electronAPI.onServerStatus((data) => {
        if (data.port) setUrl(`http://localhost:${data.port}`);
      });
    }
  }, []);
  return url;
}

export function AppProvider({ children }) {
  const [darkMode, setDarkMode] = useState(true);
  const [stats, setStats] = useState(null);
  const [serverStatus, setServerStatus] = useState({ running: false });
  const [activities, setActivities] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [devices, setDevices] = useState([]);
  const [jobs, setJobs] = useState([]);
  const apiBase = useServerUrl();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    fetchStats();
    fetchPrinters();
    fetchDevices();
    fetchJobs();
    fetchStatus();

    const interval = setInterval(() => {
      fetchStats();
      fetchPrinters();
      fetchDevices();
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [apiBase]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${apiBase}/api/dashboard`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/api/status`);
      const data = await res.json();
      setServerStatus(data);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchPrinters = async () => {
    try {
      const res = await fetch(`${apiBase}/api/printers`);
      const data = await res.json();
      setPrinters(data);
    } catch (err) {
      console.error('Failed to fetch printers:', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${apiBase}/api/devices`);
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/jobs`);
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    }
  };

  const addActivity = (activity) => {
    setActivities(prev => [activity, ...prev].slice(0, 50));
  };

  const value = {
    darkMode, setDarkMode,
    stats, fetchStats,
    serverStatus, fetchStatus,
    activities, addActivity,
    printers, fetchPrinters,
    devices, fetchDevices,
    jobs, fetchJobs,
    apiBase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
