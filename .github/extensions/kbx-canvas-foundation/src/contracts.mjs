export const CANVAS_VERSION = 1;
export const KNOWN_THEME_IDS = ['dark', 'light', 'sepia', 'ocean'];
export const KNOWN_ITEM_STATUSES = ['blocked', 'active', 'done'];
export const KNOWN_RENDER_STATUSES = ['loading', 'ready', 'empty', 'error'];

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeTheme(theme) {
  const next = typeof theme === 'string' ? theme.toLowerCase() : 'dark';
  return KNOWN_THEME_IDS.includes(next) ? next : 'dark';
}

export function normalizeStatus(status) {
  const next = typeof status === 'string' ? status.toLowerCase() : 'ready';
  return KNOWN_RENDER_STATUSES.includes(next) ? next : 'ready';
}

export function normalizeItemStatus(status) {
  const next = typeof status === 'string' ? status.toLowerCase() : 'active';
  return KNOWN_ITEM_STATUSES.includes(next) ? next : 'active';
}

export function sanitizeArtifactId(value, fallback = 'kbx-canvas-artifact') {
  const next = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  return next.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9:_./#-]/g, '-');
}

export function normalizeLink(link = {}) {
  const href = typeof link.href === 'string' ? link.href.trim() : '';
  const label = typeof link.label === 'string' && link.label.trim().length > 0 ? link.label.trim() : href || 'Link';

  return {
    id: typeof link.id === 'string' && link.id.trim() ? link.id.trim() : `link-${Math.random().toString(36).slice(2, 10)}`,
    label,
    href,
  };
}

export function normalizeItem(item = {}) {
  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `item-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Untitled item',
    description: typeof item.description === 'string' ? item.description : '',
    status: normalizeItemStatus(item.status),
    url: typeof item.url === 'string' ? item.url : '',
  };
}

export function normalizeInput(input = {}) {
  const artifactId = sanitizeArtifactId(input.artifactId ?? input.documentId ?? input.id, 'kbx-canvas-artifact');
  return {
    artifactId,
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim() : 'KBX Canvas',
    theme: normalizeTheme(input.theme),
    status: normalizeStatus(input.status),
    items: Array.isArray(input.items) ? input.items.map(normalizeItem) : [],
    links: Array.isArray(input.links) ? input.links.map(normalizeLink) : [],
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
  };
}

export function createFoundationState(input = {}) {
  const normalized = normalizeInput(input);
  return {
    version: CANVAS_VERSION,
    kind: 'kbx.canvas.foundation',
    artifactId: normalized.artifactId,
    title: normalized.title,
    theme: normalized.theme,
    status: normalized.status,
    items: normalized.items,
    links: normalized.links,
    metadata: normalized.metadata,
    updatedAt: new Date().toISOString(),
  };
}

export function getStateKey(artifactId) {
  return sanitizeArtifactId(artifactId, 'kbx-canvas-artifact');
}

export function createDefaultStore() {
  return new Map();
}

export function mergeState(current, incoming = {}) {
  const next = createFoundationState({
    artifactId: current.artifactId ?? incoming.artifactId,
    title: incoming.title ?? current.title ?? 'KBX Canvas',
    theme: incoming.theme ?? current.theme ?? 'dark',
    status: incoming.status ?? current.status ?? 'ready',
    items: Array.isArray(incoming.items) ? incoming.items : current.items ?? [],
    links: Array.isArray(incoming.links) ? incoming.links : current.links ?? [],
    metadata: { ...(current.metadata ?? {}), ...(incoming.metadata ?? {}) },
  });

  return {
    ...next,
    updatedAt: new Date().toISOString(),
  };
}

export function validateAgainstSchema(schema, value, path = 'root') {
  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] };
  }

  const errors = [];
  const expectedType = schema.type;

  if (expectedType && expectedType !== 'object' && typeof value !== expectedType) {
    errors.push(`${path}: Expected ${expectedType} but received ${typeof value}`);
  }

  if (expectedType === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value))) {
    errors.push(`${path}: Expected object but received ${Array.isArray(value) ? 'array' : typeof value}`);
  }

  if (schema.enum && Array.isArray(schema.enum) && value !== undefined && value !== null && !schema.enum.includes(value)) {
    errors.push(`${path}: Value must be one of ${schema.enum.join(', ')}`);
  }

  if (schema.required && Array.isArray(schema.required) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const key of schema.required) {
      if (!(key in value)) {
        errors.push(`${path}: Missing required property '${key}'`);
      }
    }
  }

  if (schema.properties && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, definition] of Object.entries(schema.properties)) {
      if (key in value) {
        const result = validateAgainstSchema(definition, value[key], `${path}.${key}`);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function applyAction(state, action, payload = {}) {
  const next = state && typeof state === 'object' ? { ...state } : createFoundationState();

  switch (action) {
    case 'set_state': {
      return mergeState(next, payload);
    }
    case 'append_item': {
      return {
        ...next,
        items: [...(next.items ?? []), normalizeItem(payload)],
        updatedAt: new Date().toISOString(),
      };
    }
    case 'set_theme': {
      return {
        ...next,
        theme: normalizeTheme(payload.theme ?? payload),
        updatedAt: new Date().toISOString(),
      };
    }
    case 'append_link': {
      return {
        ...next,
        links: [...(next.links ?? []), normalizeLink(payload)],
        updatedAt: new Date().toISOString(),
      };
    }
    default:
      return next;
  }
}

export function resolveActionRequest({ stateStore, artifactId, action, payload = {}, defaultTitle = 'KBX Canvas' } = {}) {
  const actionName = action ?? 'set_state';
  const resolvedArtifactId = getStateKey(artifactId);
  const current = stateStore.get(resolvedArtifactId) ?? createFoundationState({ artifactId: resolvedArtifactId, title: defaultTitle });

  const rootValidation = validateAgainstSchema(createActionSchema(), { action: actionName, payload });
  if (!rootValidation.valid) {
    return { ok: false, errors: rootValidation.errors };
  }

  const actionSchema = getActionInputSchema(actionName);
  const resolvedPayload = { ...payload, artifactId: payload.artifactId ?? resolvedArtifactId };
  const payloadValidation = validateAgainstSchema(actionSchema, resolvedPayload, 'payload');
  if (!payloadValidation.valid) {
    return { ok: false, errors: payloadValidation.errors };
  }

  const nextState = applyAction(current, actionName, resolvedPayload);
  stateStore.set(resolvedArtifactId, nextState);
  return { ok: true, state: nextState, artifactId: resolvedArtifactId };
}

export function getActionInputSchema(actionName) {
  switch (actionName) {
    case 'set_state':
      return {
        type: 'object',
        properties: {
          artifactId: { type: 'string' },
          title: { type: 'string' },
          theme: { type: 'string', enum: ['dark', 'light', 'sepia', 'ocean'] },
          status: { type: 'string', enum: ['loading', 'ready', 'empty', 'error'] },
          items: { type: 'array' },
          links: { type: 'array' },
          metadata: { type: 'object' },
        },
        required: ['artifactId'],
        additionalProperties: true,
      };
    case 'append_item':
      return {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: ['blocked', 'active', 'done'] },
          url: { type: 'string' },
        },
        required: ['title'],
        additionalProperties: true,
      };
    case 'set_theme':
      return {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['dark', 'light', 'sepia', 'ocean'] },
        },
        required: ['theme'],
        additionalProperties: true,
      };
    case 'append_link':
      return {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          href: { type: 'string' },
        },
        required: ['href'],
        additionalProperties: true,
      };
    default:
      return {
        type: 'object',
        additionalProperties: true,
      };
  }
}

export function createActionSchema() {
  return {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['set_state', 'append_item', 'set_theme', 'append_link'],
      },
      payload: {
        type: 'object',
        additionalProperties: true,
      },
    },
    required: ['action', 'payload'],
  };
}
