// Acme Hub page behaviour: greeting, and buttons that hand a question to the Ask Acme widget.

const greeting = document.querySelector("[data-greeting]");
if (greeting) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  greeting.textContent = `Good ${part}, Linh`;
}

const today = document.querySelector("[data-today]");
if (today) {
  today.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// <button data-ask="question"> opens the widget and asks; <button data-ask> just opens it.
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ask]");
  if (!button || !window.DocAnswer) return;
  event.preventDefault();
  window.DocAnswer.open(button.dataset.ask || undefined);
});
