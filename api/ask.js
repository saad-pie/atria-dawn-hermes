// Store responses temporarily in memory (or use a lightweight kv store/database if preferred)
global.latestAgentResponses = global.latestAgentResponses || {};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Frontend can poll this to check if the answer is ready
    const { runId } = req.query;
    if (global.latestAgentResponses[runId]) {
      const answer = global.latestAgentResponses[runId];
      delete global.latestAgentResponses[runId]; // clean up
      return res.status(200).json({ status: 'completed', response: answer });
    }
    return res.status(200).json({ status: 'in_progress' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, callbackUrl } = req.body;
  const GIT_PAT = process.env.GIT_PAT;
  const owner = 'saad-pie';
  const repo = 'atria-dawn-hermes';

  try {
    // 1. Trigger the workflow and pass the callback URL along with the prompt!
    const dispatchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/hermes-chat.yml/dispatches`, {
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
    });

    if (dispatchRes.status !== 204) {
      const errText = await dispatchRes.text();
      return res.status(dispatchRes.status).json({ error: errText });
    }

    // 2. Fetch the latest run ID so frontend can track it
    await new Promise(r => setTimeout(r, 3000));
    const runsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/hermes-chat.yml/runs?per_page=1`, {
      headers: { 'Authorization': `Bearer ${GIT_PAT}`, 'Accept': 'application/vnd.github+json' }
    });
    const runsData = await runsRes.json();
    const latestRun = runsData.workflow_runs?.[0];

    return res.status(200).json({ 
      success: true, 
      runId: latestRun?.id,
      message: '🚀 Workflow triggered and processing!'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
