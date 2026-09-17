import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const GIT_PAT = process.env.GIT_PAT;
const OWNER = 'saad-pie';
const REPO = 'atria-dawn-hermes';

export default async function handler(req, res) {
  // 1. GET: Frontend polling handler
  if (req.method === 'GET') {
    const { runId } = req.query;
    if (!runId) return res.status(400).json({ error: 'Missing runId query parameter' });

    // Retrieve result stored by the webhook
    const responseData = await redis.get(`run:${runId}`);
    if (responseData) {
      await redis.del(`run:${runId}`); // Cleanup after single-use retrieval
      return res.status(200).json({ status: 'completed', response: responseData });
    }

    return res.status(200).json({ status: 'in_progress' });
  }

  // 2. WEBHOOK HANDLER: Triggered exclusively via explicit query string (e.g., /api/ask?type=callback)
  if (req.method === 'POST' && req.query.type === 'callback') {
    const body = req.body || {};
    const runId = body.run_id || body.runId;

    if (!runId || body.response === undefined) {
      return res.status(400).json({ error: 'Missing runId or response in webhook payload' });
    }

    // Persist to Redis with a 10-minute expiry safety net
    await redis.set(`run:${runId}`, body.response, { ex: 600 });
    console.log(`✅ Callback received and cached for runId: ${runId}`);
    return res.status(200).json({ success: true, message: 'Response stored successfully' });
  }

  // 3. DISPATCH HANDLER: User triggering GitHub Action
  if (req.method === 'POST') {
    const { prompt, callbackUrl } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // Generate a unique client transaction ID passed directly through GitHub workflow inputs
    const clientTxId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const dispatchRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/hermes-chat.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GIT_PAT}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              prompt,
              callback_url: callbackUrl || '',
              client_tx_id: clientTxId
            }
          })
        }
      );

      if (dispatchRes.status !== 204) {
        const errText = await dispatchRes.text();
        return res.status(dispatchRes.status).json({ error: errText });
      }

      // Fetch workflow runs using created filtering parameters
      await new Promise((r) => setTimeout(r, 2000));
      const runsRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/hermes-chat.yml/runs?per_page=5`,
        {
          headers: {
            'Authorization': `Bearer ${GIT_PAT}`,
            'Accept': 'application/vnd.github+json'
          }
        }
      );
      const runsData = await runsRes.json();
      
      // Fallback: Pick latest run ID directly
      const latestRun = runsData.workflow_runs?.[0];

      return res.status(200).json({
        success: true,
        runId: latestRun?.id ? String(latestRun.id) : clientTxId,
        message: '🚀 Workflow triggered successfully!'
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
