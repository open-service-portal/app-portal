// Minimal script to hide Lifecycle column
// Find and hide by text content (more reliable than nth-child)

let hideTimeout;

function hideLifecycle() {
  document.querySelectorAll('table:not([data-processed])').forEach(table => {
    const ths = table.querySelectorAll('th');
    let lifecycleIndex = -1;
    
    ths.forEach((th, idx) => {
      if (th.textContent?.trim() === 'Lifecycle') {
        lifecycleIndex = idx;
        th.style.display = 'none';
      }
    });
    
    if (lifecycleIndex !== -1) {
      table.querySelectorAll('tr').forEach(row => {
        const cell = row.children[lifecycleIndex];
        if (cell) cell.style.display = 'none';
      });
    }
    
    table.dataset.processed = "1";
  });
}

// Run on load and DOM changes (debounced)
hideLifecycle();
new MutationObserver(() => {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(hideLifecycle, 50);
}).observe(document.body, { childList: true, subtree: true });