global.latestAgentResponses = global.latestAgentResponses || {};

export default async function handler(req, res) {
  // GET: Frontend polling for results
  if (req.method === 'GET') {
    const { runId } = req.query;
    if (global.latestAgentResponses[runId]) {
      const answer = global.latestAgentResponses[runId];
      delete global.latestAgentResponses[runId]; // clean up after retrieval
      return res.status(200).json({ status: 'completed', response: answer });
    }
    return res.status(200).json({ status: 'in_progress' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // WEBHOOK CALLBACK HANDLER: Triggered when GitHub Action finishes
  if (body.response !== undefined || body.run_id || body.runId) {
    const runId = body.run_id || body.runId || req.query.runId;
    if (runId) {
      global.latestAgentResponses[runId] = body.response;
      console.log(`✅ Received callback and saved response for runId: ${runId}`);
      return res.status(200).json({ success: true, message: 'Response stored successfully' });
    }
    return res.status(400).json({ error: 'Missing runId in callback payload' });
  }

  // USER DISPATCH HANDLER: Triggered from frontend to start GitHub Action
  const { prompt, callbackUrl } = body;
  const GIT_PAT = process.env.GIT_PAT;
  const owner = 'saad-pie';
  const repo = 'atria-dawn-hermes';

  try {
    const dispatchRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/hermes-chat.yml/dispatches`,
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
            prompt: prompt,
            callback_url: callbackUrl || ''
          }
        })
      }
    );

    if (dispatchRes.status !== 204) {
      const errText = await dispatchRes.text();
      return res.status(dispatchRes.status).json({ error: errText });
    }

    // Fetch the triggered run ID so the frontend can poll against it
    await new Promise(r => setTimeout(r, 3000));
    const runsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/hermes-chat.yml/runs?per_page=1`,
      {
        headers: {
          'Authorization': `Bearer ${GIT_PAT}`,
          'Accept': 'application/vnd.github+json'
        }
      }
    );
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs?.[0];

    return res.status(200).json({
      success: true,
      runId: latestRun?.id ? String(latestRun.id) : null,
      message: '🚀 Workflow triggered and processing!'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
