const SUPABASE_URL = 'https://neqxgfngmsysojsppjob.supabase.co';
const SUPABASE_KEY = 'sb_publishable_PfLkC0-ndwysvhQSIiLvdQ_9v8zrOYy';

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function supabase(method, table, body = null, filter = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`;
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { operation, payload } = req.body || {};

  if (!operation) return res.status(400).json({ error: 'Missing operation' });

  try {
    // ── GET TRACKS ──
    if (operation === 'get_tracks') {
      const r = await supabase('GET', 'cc_tracks', null, '?select=id,name&order=rank');
      return res.status(r.status).json(r.data);
    }

    // ── ADD ACTION ──
    if (operation === 'add_action') {
      const { id, track_id, title, notes, link, due, done, added_from } = payload;
      const r = await supabase('POST', 'cc_actions', {
        id, track_id, title,
        notes: notes || '',
        link: link || '',
        due: due || '',
        done: done ?? false,
        added_from: added_from || 'chat'
      });
      if (!r.ok) return res.status(r.status).json({ error: r.data });
      return res.status(200).json({ success: true, data: r.data });
    }

    // ── MARK DONE ──
    if (operation === 'mark_done') {
      const { id, track_id, title, date } = payload;
      const patch = await supabase('PATCH', 'cc_actions', { done: true }, `?id=eq.${id}`);
      if (!patch.ok) return res.status(patch.status).json({ error: patch.data });
      const log = await supabase('POST', 'cc_recap_logs', {
        id: `l${Date.now()}`,
        text: title,
        track_id: track_id || '',
        type: 'action',
        date,
        source: 'chat'
      });
      return res.status(200).json({ success: true });
    }

    // ── GET OPEN ACTIONS ──
    if (operation === 'get_open_actions') {
      const r = await supabase('GET', 'cc_actions', null, '?done=eq.false&select=id,title,track_id');
      return res.status(r.status).json(r.data);
    }

    // ── LOG TO RECAP ──
    if (operation === 'log_recap') {
      const { text, track_id, date } = payload;
      const r = await supabase('POST', 'cc_recap_logs', {
        id: `l${Date.now()}`,
        text,
        track_id: track_id || '',
        type: 'manual',
        date,
        source: 'chat'
      });
      if (!r.ok) return res.status(r.status).json({ error: r.data });
      return res.status(200).json({ success: true });
    }

    // ── SET INTENTION ──
    if (operation === 'set_intention') {
      const { id, date, track_id, goal } = payload;
      const r = await supabase('POST', 'cc_intentions', {
        id: id || `i${Date.now()}`,
        date,
        track_id: track_id || '',
        goal
      });
      if (!r.ok) return res.status(r.status).json({ error: r.data });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown operation: ${operation}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
