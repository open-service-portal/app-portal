import '@backstage/cli/asset-types';

// Increase max listeners to handle multiple config files without warnings
// This prevents "MaxListenersExceededWarning" when loading 10+ config files
import { setMaxListeners } from 'events';
setMaxListeners(20);

import ReactDOM from 'react-dom/client';
import App from './App';
import '@backstage/ui/css/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(App.createRoot());
