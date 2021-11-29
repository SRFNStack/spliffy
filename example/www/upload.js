const fileInput = document.getElementById('file')
document.getElementById('butty').onclick = e => {
  e.preventDefault()
  fetch('?filename=' + fileInput.files[0].name, { method: 'POST', body: fileInput.files[0] })
    .then(() => alert('Upload Successful'))
    .catch(console.error)
  return false
}
