import mermaid from 'mermaid';

// Initialize mermaid with theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    primaryColor: '#9c27b0',
    primaryTextColor: '#fff',
    primaryBorderColor: '#7b1fa2',
    lineColor: '#5e35b1',
    secondaryColor: '#512da8',
    tertiaryColor: '#fff'
  }
});

// Function to render mermaid diagrams in a given root
const renderMermaidInRoot = (root: Document | ShadowRoot) => {
  const mermaidElements = root.querySelectorAll('pre.mermaid');
  
  if (mermaidElements.length > 0) {
    mermaidElements.forEach((element: Element, index: number) => {
      // Check if already rendered
      if (element.classList.contains('mermaid-processed')) {
        return;
      }
      
      const graphDefinition = element.textContent || '';
      const id = `mermaid-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a div to hold the rendered diagram
      const div = document.createElement('div');
      div.id = id;
      div.className = 'mermaid-rendered';
      
      // Insert the div before the pre element
      element.parentNode?.insertBefore(div, element);
      
      // Render the diagram
      try {
        mermaid.render(id, graphDefinition).then(({ svg }) => {
          div.innerHTML = svg;
          // Hide the original pre element and mark as processed
          (element as HTMLElement).style.display = 'none';
          element.classList.add('mermaid-processed');
        }).catch(() => {
          // Silent failure - remove the div if rendering fails
          div.remove();
        });
      } catch {
        // Silent failure - remove the div if initialization fails
        div.remove();
      }
    });
  }
};

// Function to find and render in all shadow roots
const renderAllMermaid = () => {
  // Render in main document
  renderMermaidInRoot(document);
  
  // Find all elements that might have shadow roots (TechDocs uses shadow DOM)
  const elementsWithShadow = document.querySelectorAll('*');
  
  elementsWithShadow.forEach(element => {
    if (element.shadowRoot) {
      renderMermaidInRoot(element.shadowRoot);
    }
  });
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    renderAllMermaid();
  });
} else {
  renderAllMermaid();
}

// Set up observer for dynamic content
const observer = new MutationObserver((mutations) => {
  // Check if any mutation adds new content that might contain mermaid
  const hasNewContent = mutations.some(mutation => {
    if (mutation.addedNodes.length > 0) {
      // Check if any added node or its children contain mermaid
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof Element) {
          if (node.querySelector?.('pre.mermaid') || 
              node.classList?.contains('mermaid') ||
              node.shadowRoot) {
            return true;
          }
        }
      }
    }
    return false;
  });
  
  if (hasNewContent) {
    // Debounce rendering to avoid multiple renders
    setTimeout(renderAllMermaid, 100);
  }
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
} else {
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Also periodically check for new shadow roots (for late-loading content)
setInterval(() => {
  const shadowRoots = Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot);
  if (shadowRoots.length > 0) {
    renderAllMermaid();
  }
}, 3000);