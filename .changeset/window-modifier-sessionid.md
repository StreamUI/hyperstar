---
"hyperstar": minor
---

Add `__window` event modifier for global event listeners and fix `sessionId` on view/lifecycle contexts

- **`__window` modifier**: Use `hs-on:keydown__window` to listen on `window` instead of the element. No focus required — perfect for games, keyboard shortcuts, and global hotkeys.
- **`sessionId` on ViewContext**: `ctx.sessionId` now works in views, `onConnect`, and `onDisconnect` (previously only available in actions).
- **Client bundle rebuilt** with the new event modifier.
