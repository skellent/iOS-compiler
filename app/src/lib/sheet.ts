export function openSheet(bodyElement) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";

  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.appendChild(bodyElement);
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  function close() {
    backdrop.classList.remove("sheet-open");
    backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
  }

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });

  requestAnimationFrame(() => backdrop.classList.add("sheet-open"));

  return { close, sheet };
}
// TypeScript source.
