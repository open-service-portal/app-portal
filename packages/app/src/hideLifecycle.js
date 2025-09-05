// Minimal script to hide Lifecycle column
// Find and hide by text content (more reliable than nth-child)

function hideLifecycle() {
  document.querySelectorAll('th').forEach((th, index) => {
    if (th.textContent?.trim() === 'Lifecycle') {
      // Hide header
      th.style.display = 'none';
      
      // Hide all cells in this column
      const table = th.closest('table');
      table?.querySelectorAll('tr').forEach(row => {
        const cell = row.children[index];
        if (cell) cell.style.display = 'none';
      });
    }
  });
}

// Run on load and DOM changes
hideLifecycle();
new MutationObserver(() => setTimeout(hideLifecycle, 50))
  .observe(document.body, { childList: true, subtree: true });