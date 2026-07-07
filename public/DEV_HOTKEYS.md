rr# Dev Hotkeys

Hotkeys only work when `DEV_MODE === true` in `config.js`.

## Available Hotkeys

| Key | Action |
|-----|--------|
| 1 | Show auth/login screen |
| 2 | Seed test user + show home screen |
| 3 | Seed test user + seed pain pin + show chat screen |
| 4 | Seed test user + seed pain pin + show chat screen + trigger pin ceremony |
| T | Reset/seed complete test state |
| R | Clear localStorage and reload |
| H | Print hotkey help in console |

## Test User

- Username: `test`
- Password: `test`

## Test Pain Pin

Normalized coordinates:
- x: 0.5
- y: 0.55

## Test Chat History

1. bot: 我在呢，慢慢说。今天发生了什么让你不开心呀？
2. user: 今天我有一点难过。
3. bot: 我会先帮你把这份烦恼接住。

## Notes

- Hotkeys are disabled when typing in input/textarea fields
- Press H to see this help in the browser console
- DEV_MODE must be set to true in config.js for hotkeys to work