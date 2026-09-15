const getHttpUrl = (baseUrl: string): string => {
  let url = baseUrl.trim();
  // If connecting to the default Render backend from Vercel, use the same-origin proxy
  // to completely eliminate CORS preflights, ISP domain blocks, and SSL handshakes
  if (
    typeof window !== 'undefined' &&
    (url === 'debris-scan-backend.onrender.com' ||
      url === 'https://debris-scan-backend.onrender.com')
  ) {
    return '/api/proxy';
  }

  if (url.startsWith('http://') || url.startsWith('https://')) return url;
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
    },
  });
  if (!res.ok) throw new Error(`Start mission failed: ${res.status}`);
  return res.json();
}

export async function getMission(backendUrl: string, missionId: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions/${missionId}`);
  if (!res.ok) throw new Error(`Get mission failed: ${res.status}`);
  return res.json();
}

export async function getHealth(backendUrl: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${getHttpUrl(backendUrl)}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connecting to cloud backend...');
    }
    throw err;
  }
}

export { getHttpUrl };
