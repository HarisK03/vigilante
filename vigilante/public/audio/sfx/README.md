# Sound effects

Put your clips in this folder. The game only uses **up to two files** by default (you can point both constants at one file).

## Configure paths

Edit **`lib/sfx.ts`** — set `UI_SOUND` and `GAME_SOUND` to match **your** filenames, e.g.:

```ts
const UI_SOUND = "/audio/sfx/my-button.ogg";
const GAME_SOUND = "/audio/sfx/chime.ogg";
```

**One file only:** use the same path twice:

```ts
const UI_SOUND = "/audio/sfx/everything.ogg";
const GAME_SOUND = "/audio/sfx/everything.ogg";
```

## How keys map (same file reused on purpose)

| Constant   | Used for |
|------------|----------|
| `UI_SOUND` | Clicks, modals open/close, panel, zoom tiers, incident select |
| `GAME_SOUND` | New incident, incident expired |

Missing or wrong paths fail silently (no crash).
