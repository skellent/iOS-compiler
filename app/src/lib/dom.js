export function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

export function setLoading(button, loading) {
  button.disabled = loading;
  button.querySelector(".btn-label").hidden = loading;
  button.querySelector(".btn-spinner").hidden = !loading;
}

export function shake(el) {
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}
