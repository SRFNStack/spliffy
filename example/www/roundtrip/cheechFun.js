document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault()
  fetch(
    'chong?q=some+string%20with%27codes%27',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ requestMessage: document.getElementById('cheech').value })
    }
  ).then(r => r.json())
    .then(data => { document.getElementById('chong').innerText = data.responseMessage })
})
