import { useEffect } from 'react';
import mermaid from 'mermaid';

/**
 * Hook to enable mermaid rendering in TechDocs and regular pages
 */
export const useMermaidEffect = () => {
  useEffect(() => {
    console.log('Mermaid effect initializing...');
    
    // Initialize mermaid
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
        console.log(`Found ${mermaidElements.length} mermaid diagrams to render`);
        
        mermaidElements.forEach((element: Element, index: number) => {
          const graphDefinition = element.textContent || '';
          const id = `mermaid-${Date.now()}-${index}`;
          
          // Check if already rendered
          if (element.classList.contains('mermaid-processed')) {
            return;
          }
          
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
              console.log(`Successfully rendered mermaid diagram ${id}`);
            }).catch(error => {
              console.error('Failed to render mermaid diagram:', error);
              div.remove();
            });
          } catch (error) {
            console.error('Mermaid initialization error:', error);
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
          console.log('Found shadow root, checking for mermaid diagrams...');
          renderMermaidInRoot(element.shadowRoot);
        }
      });
    };

    // Initial render
    renderAllMermaid();

    // Set up observer for dynamic content
    const observer = new MutationObserver((mutations) => {
      // Check if any mutation adds new content that might contain mermaid
      const hasNewContent = mutations.some(mutation => 
        mutation.addedNodes.length > 0 || 
        (mutation.target as Element).shadowRoot
      );
      
      if (hasNewContent) {
        // Debounce rendering to avoid multiple renders
        setTimeout(renderAllMermaid, 100);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also periodically check for new shadow roots (for late-loading content)
    const intervalId = setInterval(renderAllMermaid, 2000);

    // Cleanup
    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, []);
};