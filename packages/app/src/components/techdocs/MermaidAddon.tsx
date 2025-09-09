import { useEffect } from 'react';
import mermaid from 'mermaid';
import { TechDocsAddonLocations } from '@backstage/plugin-techdocs-react';
import { useTechDocsReaderPage } from '@backstage/plugin-techdocs-react';

/**
 * TechDocs addon that enables mermaid diagram rendering
 */
export const MermaidAddon = () => {
  const readerPage = useTechDocsReaderPage();
  const shadowRoot = readerPage?.shadowRoot;
  
  console.log('MermaidAddon mounted, shadowRoot:', shadowRoot);

  useEffect(() => {
    if (!shadowRoot) {
      console.log('No shadowRoot available');
      return;
    }

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

    // Find all mermaid code blocks
    const mermaidElements = shadowRoot.querySelectorAll('pre.mermaid');
    
    if (mermaidElements.length > 0) {
      console.log(`Found ${mermaidElements.length} mermaid diagrams to render`);
      
      mermaidElements.forEach((element: Element, index: number) => {
        const graphDefinition = element.textContent || '';
        const id = `mermaid-${Date.now()}-${index}`;
        
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
            // Hide the original pre element
            (element as HTMLElement).style.display = 'none';
          }).catch(error => {
            console.error('Failed to render mermaid diagram:', error);
            div.remove();
          });
        } catch (error) {
          console.error('Mermaid initialization error:', error);
        }
      });
    }

    // Cleanup function
    return () => {
      // Remove rendered diagrams and restore original pre elements
      const renderedDiagrams = shadowRoot.querySelectorAll('.mermaid-rendered');
      renderedDiagrams.forEach((div: Element) => div.remove());
      
      mermaidElements.forEach((element: Element) => {
        (element as HTMLElement).style.display = '';
      });
    };
  }, [shadowRoot]);

  // This addon doesn't render any visible UI
  return null;
};

// Export with location for registration
export const mermaidAddon = {
  component: MermaidAddon,
  location: TechDocsAddonLocations.Content
};