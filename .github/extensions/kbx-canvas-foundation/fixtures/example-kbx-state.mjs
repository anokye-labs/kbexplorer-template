import { createFoundationState } from '../src/contracts.mjs';

export const exampleState = createFoundationState({
  artifactId: 'example:kbx-foundation',
  title: 'Template 4 Foundation Preview',
  theme: 'ocean',
  status: 'ready',
  items: [
    { id: 'task-1', title: 'Scaffold canvas shell', description: 'Create the reusable provider and HTML renderer.', status: 'done', url: 'https://example.com/task-1' },
    { id: 'task-2', title: 'Model resilient state', description: 'Keep artifact IDs durable while panel identity remains transient.', status: 'active', url: 'https://example.com/task-2' },
    { id: 'task-3', title: 'Prepare DAG variant', description: 'Later swap in the Issue DAG replacement without coupling to the current session.', status: 'blocked', url: 'https://example.com/task-3' },
  ],
  links: [
    { id: 'link-1', label: 'Issue DAG', href: 'https://example.com/dag' },
    { id: 'link-2', label: 'Template 4 specification', href: 'https://example.com/template-4' },
  ],
});
