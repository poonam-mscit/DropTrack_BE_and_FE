# DropTrack Dropper App

Expo (React Native + TypeScript) mobile app for delivery droppers.

## Run

```bash
# from repo root
pnpm install
cd apps/dropper
pnpm start            # Expo dev server
# then press 'i' for iOS Simulator, 'a' for Android, or scan the QR with Expo Go
```

The app expects the DropTrack API to be reachable. Default is `http://192.168.1.27:3001`
— change in `app.json` → `extra.apiBaseUrl` if your LAN address differs.

## Sign in

Two paths:

1. **Cognito** — email + password against `POST /api/auth/sign-in` (needs the
   user pool client wired with USER_PASSWORD_AUTH).
2. **Dev impersonation** — tap *Use demo account (dev)* on the login screen.
   Signs in as the seeded dropper **James** via the `x-dev-user-id` header.

## Screens

- `LoginScreen` — auth
- `JobsScreen` — queue (active + up next), pull-to-refresh
- `JobDetailScreen` — assignment overview + Start
- `ActiveScreen` — live map, Mark Drop, Pause/Stop, GPS pings every 5 s
- `SummaryScreen` — post-shift stats + rating
- `ProfileScreen` — personal details placeholder + sign out

## Backend endpoints used

- `GET    /api/me/assignments`
- `GET    /api/me/assignments/:id`
- `POST   /api/me/assignments/:id/start | pause | resume | complete`
- `POST   /api/me/drops`
- `POST   /api/me/locations`
- `GET    /api/jobs/:id/map`

## Outstanding work

- Background location task (`expo-task-manager`) so the GPS keeps streaming
  when the app is minimised.
- Cognito refresh-token flow in `src/api/client.ts`.
- Push notifications (`expo-notifications`) for new assignments.
- Offline drop queue (sync when reconnected).
- Native build via `eas build --profile development`.
