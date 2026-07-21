import { messagingRouter } from './modules/messaging/messaging.routes.js';
const stack = (messagingRouter as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack;
for (const layer of stack) {
  if (layer.route) console.log(Object.keys(layer.route.methods).join(','), layer.route.path);
}
