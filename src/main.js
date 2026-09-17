document.getElementById('sendBtn').addEventListener('click', async () => {
  const prompt = document.getElementById('promptInput').value.trim();
  const statusDiv = document.getElementById('status');
  const responseBox = document.getElementById('responseBox');
  const responseContent = document.getElementById('responseContent');

  if (!prompt) {
    statusDiv.style.color = '#f87171';
    statusDiv.textContent = '⚠️ Please enter a prompt first!';
    return;
  }

  statusDiv.style.color = '#38bdf8';
  statusDiv.textContent = '🚀 Dispatching task to GitHub Actions & Atria-Dawn...';
  responseBox.style.display = 'none';
  responseContent.textContent = '';

  try {
    // FIX: Include ?type=callback query parameter for the webhook route
    const callbackUrl = `${window.location.origin}/api/ask?type=callback`;

    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, callbackUrl })
    });

    const rawText = await response.text();
    let data;

    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error(`Server returned HTML instead of JSON (${response.status}). Check Vercel logs.`);
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to trigger workflow.');
    }

    statusDiv.style.color = '#facc15';
    statusDiv.textContent = '⏳ Workflow triggered! Waiting for Hermes Agent to reply... 🤖✨';

    const runId = data.runId;
    if (!runId) {
      statusDiv.style.color = '#4ade80';
      statusDiv.textContent = '✅ Workflow triggered successfully! Check your GitHub Actions logs.';
      return;
    }

    let attempts = 0;
    const maxAttempts = 40; // Poll for up to 120 seconds

    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const checkRes = await fetch(`/api/ask?runId=${runId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'completed' && checkData.response) {
          clearInterval(pollInterval);
          statusDiv.style.color = '#4ade80';
          statusDiv.textContent = '🎉 Response received successfully! 💖';
          responseContent.textContent = checkData.response;
          responseBox.style.display = 'block';
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          statusDiv.style.color = '#f87171';
          statusDiv.textContent = '⏰ Polling timed out. Check your GitHub Actions tab for the complete result.';
        }
      } catch (pollErr) {
        console.error('Polling error:', pollErr);
      }
    }, 3000);

  } catch (err) {
    statusDiv.style.color = '#f87171';
    statusDiv.textContent = `❌ Network Error: ${err.message}`;
  }
});
