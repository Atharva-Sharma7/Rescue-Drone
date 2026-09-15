const getHttpUrl = (baseUrl: string): string => {
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) return baseUrl;
  return `http://${baseUrl}`;
};

export async function createMission(backendUrl: string, siteName: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site_name: siteName }),
  });
  if (!res.ok) throw new Error(`Create mission failed: ${res.status}`);
  return res.json();
}

export async function startMission(backendUrl: string, missionId: string) {
  const res = await fetch(`${getHttpUrl(backendUrl)}/missions/${missionId}/start`, {
    method: 'POST',
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
  const res = await fetch(`${getHttpUrl(backendUrl)}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export { getHttpUrl };
