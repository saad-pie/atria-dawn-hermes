document.getElementById('sendBtn').addEventListener('click', async () => {
  const prompt = document.getElementById('promptInput').value.trim();
  const statusDiv = document.getElementById('status');
  const responseBox = document.getElementById('responseBox');
  const responseContent = document.getElementById('responseContent');

  if (!prompt) {
    statusDiv.style.color = '#f87171';
    statusDiv.textContent = '⚠️ Please enter a prompt first, my friend! Let us make magic happen! ✨';
    return;
  }

  // Reset and show loading state
  statusDiv.style.color = '#38bdf8';
  statusDiv.textContent = '🚀 Dispatches flying to GitHub Actions & Atria-Dawn... Sit tight! ☕';
  responseBox.style.display = 'none';
  responseContent.textContent = '';

  try {
    // Determine the callback URL based on current host
    const callbackUrl = `${window.location.origin}/api/ask`;

    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, callbackUrl })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to trigger workflow.');
    }

    statusDiv.style.color = '#facc15';
    statusDiv.textContent = '⏳ Workflow triggered! Waiting for Atria-Dawn Hermes Agent to reply... 🤖✨';

    const runId = data.runId;
    if (!runId) {
      statusDiv.style.color = '#4ade80';
      statusDiv.textContent = '✅ Workflow triggered successfully! Check your GitHub Actions logs.';
      return;
    }

    // Poll the backend every 3 seconds to retrieve the completed agent answer!
    let attempts = 0;
    const maxAttempts = 25; // Try for up to 75 seconds

    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const checkRes = await fetch(`/api/ask?runId=${runId}`);
        const checkData = await checkRes.json();

        if (checkData.status === 'completed' && checkData.response) {
          clearInterval(pollInterval);
          statusDiv.style.color = '#4ade80';
          statusDiv.textContent = '🎉 Response received from Hermes Agent successfully! 💖';
          responseContent.textContent = checkData.response;
          responseBox.style.display = 'block';
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          statusDiv.style.color = '#f87171';
          statusDiv.textContent = '⏰ Polling timed out, but your workflow is still running on GitHub! Check your actions tab.';
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
          
