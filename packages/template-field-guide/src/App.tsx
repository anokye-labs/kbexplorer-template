import { templateDescriptor } from './template';

export function App() {
  return (
    <main>
      <h1>{templateDescriptor.title}</h1>
      <p>{templateDescriptor.summary}</p>
    </main>
  );
}
