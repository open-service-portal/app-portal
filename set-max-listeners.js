// This file is loaded via --require flag before backstage-cli starts
// It sets max listeners to prevent warnings when loading multiple config files

// console.log('[Backstage CLI] Init');

// Set EventEmitter max listeners
require('events').EventEmitter.defaultMaxListeners = 20;

// Set process max listeners
// if (process.setMaxListeners) {
//   process.setMaxListeners(20);
// }

// // Try to set AbortSignal max listeners (Node 15+)
// if (global.AbortSignal && AbortSignal.setMaxListeners) {
//   try {
//     AbortSignal.setMaxListeners(20);
//   } catch (e) {
//     // Ignore if not available
//   }
// }