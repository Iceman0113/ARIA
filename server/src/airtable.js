const API = 'https://api.airtable.com/v0';

export function makeAirtable({
  apiKey = process.env.AIRTABLE_API_KEY,
  baseId = process.env.AIRTABLE_BASE_ID,
  table = 'Products',
  fetchImpl = fetch,
} = {}) {
  async function listItems() {
    const res = await fetchImpl(`${API}/${baseId}/${table}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}`);
    const data = await res.json();
    return data.records.map((r) => ({ id: r.id, ...r.fields }));
  }
  return { listItems };
}
