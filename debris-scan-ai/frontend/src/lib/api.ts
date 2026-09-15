const getHttpUrl = (baseUrl: string): string => {
  let url = baseUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Localhost/127.0.0.1 uses plain http://, all remote domains (Render, tunnels, cloud) use https://
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return `http://${url}`;
  }
  return `https://${url}`;
};

export async function createMission(backendUrl: string, siteName: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
    },
    body: JSON.stringify({ site_name: siteName }),
  });
  if (!res.ok) throw new Error(`Create mission failed: ${res.status}`);
  return res.json();
}

export async function startMission(backendUrl: string, missionId: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions/${missionId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true',
    },
  });
  if (!res.ok) throw new Error(`Start mission failed: ${res.status}`);
  return res.json();
}

export async function getMission(backendUrl: string, missionId: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions/${missionId}`, {
    headers: { 'Bypass-Tunnel-Reminder': 'true' },
  });
  if (!res.ok) throw new Error(`Get mission failed: ${res.status}`);
  return res.json();
}

export async function getHealth(backendUrl: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/health`, {
    headers: { 'Bypass-Tunnel-Reminder': 'true' },
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export { getHttpUrl };
