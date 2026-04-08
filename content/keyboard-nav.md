---
id: "keyboard-nav"
title: "Keyboard Navigation"
emoji: "🎨"
cluster: ui
connections:
  - to: "theme-system"
    description: "imports nextTheme"
  - to: "app-shell"
    description: "called by Explorer"
  - to: "type-system"
    description: "imports KBGraph, Theme"
---

# Keyboard Navigation

Keyboard navigation exists so power users can browse the knowledge base without touching a mouse. It keeps the interaction model simple — just three keys — while respecting editable elements to avoid conflicts with text input.

## At a Glance

| Component | Responsibility | Key File | Source |
|-----------|---------------|----------|--------|
| `useKeyboardNav` | Global keydown listener hook | `src/hooks/useKeyboardNav.ts` | [src/hooks/useKeyboardNav.ts:11](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L11) |
| `nextTheme` | Cycle through theme modes | `src/hooks/useTheme.ts` | imported at line 3 |

## Key Bindings

| Key | Action | Source |
|-----|--------|--------|
| `t` | Cycle theme: dark → light → sepia → dark | [src/hooks/useKeyboardNav.ts:22-26](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L22) |
| `←` (ArrowLeft) | Navigate to previous node | [src/hooks/useKeyboardNav.ts:28-41](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L28) |
| `→` (ArrowRight) | Navigate to next node | [src/hooks/useKeyboardNav.ts:28-41](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L28) |

## Event Flow

```mermaid
flowchart TD
    A["window 'keydown' event"] --> B{"target is INPUT,\nTEXTAREA, SELECT\nor contentEditable?"}
    B -->|yes| C["Ignore — let native\ninput handle it"]
    B -->|no| D{"key?"}
    D -->|'t'| E["Read localStorage\nkbe-theme"]
    E --> F["nextTheme(current)\n→ setTheme()"]
    D -->|ArrowLeft / ArrowRight| G["Parse window.location.hash\nfor /node/:id"]
    G --> H["Find current index\nin graph.nodes"]
    H --> I["Compute next index\n(wraps with modulo)"]
    I --> J["Set window.location.hash\nto new node"]

    style A fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style B fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style C fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style D fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style E fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style F fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style G fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style H fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style I fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
    style J fill:#1e3a5f,stroke:#4a9eed,color:#e0e0e0
```

<!-- Sources: src/hooks/useKeyboardNav.ts:16-42 -->

## Hook Lifecycle

```mermaid
sequenceDiagram
    participant Explorer as Explorer component
    participant Hook as useKeyboardNav
    participant Window as window

    Explorer->>Hook: mount with graph, setTheme
    Hook->>Window: addEventListener('keydown', handler)
    Note over Window: User presses keys...
    Window->>Hook: keydown event
    Hook->>Hook: check target element
    Hook->>Window: update hash or theme

    Explorer->>Hook: unmount
    Hook->>Window: removeEventListener('keydown', handler)
```

<!-- Sources: src/hooks/useKeyboardNav.ts:46-48 -->

## Input Element Guard

The handler at [src/hooks/useKeyboardNav.ts:17-19](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L17) checks the event target's `tagName` against `INPUT`, `TEXTAREA`, and `SELECT`, plus the `isContentEditable` property. This prevents keyboard shortcuts from hijacking text entry in HUD search boxes or any future form elements.

## Arrow Navigation

Node cycling at [src/hooks/useKeyboardNav.ts:28-41](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L28) parses the current node ID from `window.location.hash`, finds its index in `graph.nodes`, then computes the next index using modular arithmetic — `ArrowRight` adds 1, `ArrowLeft` subtracts 1, both wrapping around the array boundaries. If the graph is `null` or the hash doesn't match the `/node/:id` pattern, the handler is a no-op.

## Cleanup

The `useEffect` returns a cleanup function at [src/hooks/useKeyboardNav.ts:47](https://github.com/anokye-labs/kbexplorer/blob/main/src/hooks/useKeyboardNav.ts#L47) that removes the event listener, ensuring no dangling handlers survive component unmount. The effect depends on `[graph, setTheme]` so the handler is rebuilt if either changes.
