import { Redis } from '@upstash/redis';

let redis;
try {
  redis = Redis.fromEnv();
} catch (e) {
  console.warn('Upstash Redis env variables missing. Falling back to global memory store.');
}

const GIT_PAT = process.env.GIT_PAT;
const OWNER = 'saad-pie';
const REPO = 'atria-dawn-hermes';

global.latestAgentResponses = global.latestAgentResponses || {};

export default async function handler(req, res) {
  try {
    // 1. GET: Frontend polling handler
    if (req.method === 'GET') {
      const { runId } = req.query;
      if (!runId) return res.status(400).json({ error: 'Missing runId query parameter' });

      let responseData = null;

      if (redis) {
        responseData = await redis.get(`run:${runId}`);
        if (responseData) await redis.del(`run:${runId}`);
      } else {
        responseData = global.latestAgentResponses[runId];
        if (responseData) delete global.latestAgentResponses[runId];
      }

      if (responseData) {
        return res.status(200).json({ status: 'completed', response: responseData });
      }

      return res.status(200).json({ status: 'in_progress' });
    }

    // 2. WEBHOOK HANDLER: Triggered via /api/ask?type=callback
    if (req.method === 'POST' && req.query.type === 'callback') {
      const body = req.body || {};
      const runId = body.run_id || body.runId;

      if (!runId || body.response === undefined) {
        return res.status(400).json({ error: 'Missing runId or response in webhook payload' });
      }

      if (redis) {
        await redis.set(`run:${runId}`, body.response, { ex: 600 });
      } else {
        global.latestAgentResponses[runId] = body.response;
      }

      console.log(`✅ Callback received and stored for runId: ${runId}`);
      return res.status(200).json({ success: true, message: 'Response stored successfully' });
    }

    // 3. DISPATCH HANDLER: User triggering GitHub Action
    if (req.method === 'POST') {
      if (!GIT_PAT) {
        return res.status(500).json({ error: 'GIT_PAT environment variable is missing in Vercel settings.' });
      }

      const { prompt, callbackUrl } = req.body || {};
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

      const clientTxId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const dispatchRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/hermes-chat.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GIT_PAT}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Atria-Dawn-Hermes-App'
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              prompt,
              callback_url: callbackUrl || ''
            }
          })
        }
      );

      if (dispatchRes.status !== 204) {
        const errText = await dispatchRes.text();
        return res.status(dispatchRes.status).json({ error: `GitHub API error (${dispatchRes.status}): ${errText}` });
      }

      await new Promise((r) => setTimeout(r, 2000));
      const runsRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/hermes-chat.yml/runs?per_page=5`,
        {
          headers: {
            'Authorization': `Bearer ${GIT_PAT}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Atria-Dawn-Hermes-App'
          }
        }
      );
      const runsData = await runsRes.json();
      const latestRun = runsData.workflow_runs?.[0];

      return res.status(200).json({
        success: true,
        runId: latestRun?.id ? String(latestRun.id) : clientTxId,
        message: '🚀 Workflow triggered successfully!'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
