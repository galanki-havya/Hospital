/**
 * Real-time WebSocket server for MediCore HMS
 * Uses native Node http + the ws library if available, falls back to SSE pattern
 *
 * Events pushed:
 *   - bed.status_changed       { bedId, fromStatus, toStatus, wardName }
 *   - order.created            { orderId, orderType, priority, patientName }
 *   - order.status_changed     { orderId, status }
 *   - emergency.new_case       { caseId, severity, chiefComplaint }
 *   - queue.updated            { module, count }
 *   - ot.status_changed        { scheduleId, status, surgeryName }
 *   - notification.new         { message, module }
 */

// In-memory subscriber map: tenantId -> Set<(event) => void>
const subscribers = new Map();

/**
 * Subscribe a client callback to a tenant's events.
 * Returns an unsubscribe function.
 */
export function subscribe(tenantId, callback) {
  const key = String(tenantId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(callback);
  return () => {
    subscribers.get(key)?.delete(callback);
    if (subscribers.get(key)?.size === 0) subscribers.delete(key);
  };
}

/**
 * Broadcast an event to all subscribers of a tenant.
 */
export function broadcast(tenantId, eventType, data) {
  const key = String(tenantId);
  const subs = subscribers.get(key);
  if (!subs || subs.size === 0) return;

  const payload = JSON.stringify({ type: eventType, data, ts: new Date().toISOString() });
  for (const cb of subs) {
    try { cb(payload); } catch { /* subscriber gone */ }
  }
}

/**
 * Express middleware: GET /api/v1/realtime/stream
 * Uses Server-Sent Events (SSE) — works in every browser without a WS lib.
 * The frontend uses: new EventSource('/api/v1/realtime/stream')
 */
export function sseHandler(req, res) {
  const tenantId = req.tenantId;
  if (!tenantId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: new Date().toISOString() })}\n\n`);

  // Subscribe
  const unsubscribe = subscribe(tenantId, (payload) => {
    res.write(`data: ${payload}\n\n`);
  });

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
}

/**
 * Convenience helpers — call these from services to emit events
 */
export const emit = {
  bedStatusChanged: (tenantId, bedId, fromStatus, toStatus, wardName) =>
    broadcast(tenantId, 'bed.status_changed', { bedId: String(bedId), fromStatus, toStatus, wardName }),

  orderCreated: (tenantId, orderId, orderType, priority, patientName) =>
    broadcast(tenantId, 'order.created', { orderId: String(orderId), orderType, priority, patientName }),

  orderStatusChanged: (tenantId, orderId, status) =>
    broadcast(tenantId, 'order.status_changed', { orderId: String(orderId), status }),

  emergencyCase: (tenantId, caseId, severity, chiefComplaint) =>
    broadcast(tenantId, 'emergency.new_case', { caseId: String(caseId), severity, chiefComplaint }),

  otStatusChanged: (tenantId, scheduleId, status, surgeryName) =>
    broadcast(tenantId, 'ot.status_changed', { scheduleId: String(scheduleId), status, surgeryName }),

  queueUpdated: (tenantId, module, count) =>
    broadcast(tenantId, 'queue.updated', { module, count }),

  notification: (tenantId, message, module) =>
    broadcast(tenantId, 'notification.new', { message, module }),

  custom: (tenantId, eventType, data) =>
    broadcast(tenantId, eventType, data),
};
