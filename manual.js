function openManual() {
  document.getElementById('modal-manual').classList.add('show');
}

function closeManual(e) {
  if (e && e.target !== document.getElementById('modal-manual')) return;
  document.getElementById('modal-manual').classList.remove('show');
}
