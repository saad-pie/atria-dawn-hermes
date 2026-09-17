export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  // Updated to use GIT_PAT since GitHub reserves the GITHUB_ prefix! 🔑
  const GIT_PAT = process.env.GIT_PAT;
  const owner = 'saad-pie';
  const repo = 'atria-dawn-hermes';

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/hermes-chat.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GIT_PAT}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { prompt: prompt }
      })
    });

    if (response.status === 204) {
      return res.status(200).json({ success: true, message: '🚀 Hermes workflow triggered successfully!' });
    } else {
      const errorData = await response.text();
      return res.status(response.status).json({ error: errorData });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
