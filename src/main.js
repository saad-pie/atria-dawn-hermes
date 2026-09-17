document.getElementById('sendBtn').addEventListener('click', async () => {
  const prompt = document.getElementById('promptInput').value.trim();
  const statusDiv = document.getElementById('status');

  if (!prompt) {
    statusDiv.style.color = '#f87171';
    statusDiv.textContent = '⚠️ Please enter a prompt first, my friend!';
    return;
  }

  statusDiv.style.color = '#38bdf8';
  statusDiv.textContent = '🚀 Dispatches flying to GitHub Actions...';

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();

    if (response.ok) {
      statusDiv.style.color = '#4ade80';
      statusDiv.textContent = '✅ Workflow triggered successfully! Check your GitHub Actions logs for the response.';
    } else {
      statusDiv.style.color = '#f87171';
      statusDiv.textContent = `❌ Error: ${data.error || 'Failed to trigger workflow.'}`;
    }
  } catch (err) {
    statusDiv.style.color = '#f87171';
    statusDiv.textContent = `❌ Network Error: ${err.message}`;
  }
});
