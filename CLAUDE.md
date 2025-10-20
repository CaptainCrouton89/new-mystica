# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo containing two applications:

- **mystica-express/** - Express.js backend API server
- **New-Mystica/** - iOS/macOS application (SwiftUI + SwiftData)

## Backend (mystica-express)

### Technology Stack
- Express.js 4.16.x with Jade templating
- Supabase for database and authentication
- pnpm for package management
- Deployed to Railway

### Development Commands

```bash
# Install dependencies
cd mystica-express
pnpm install

# Start development server (runs on port 3000 by default)
pnpm start

# No build step required
pnpm build  # echoes "No build step required"
```

### Server Configuration
- Default port: 3000 (configured in `bin/www`)
- Can be overridden via `PORT` environment variable
- Routes defined in `routes/` directory
- Static files served from `public/`

### Supabase Integration

Supabase local development is configured in `supabase/config.toml`:

- API Port: 54321
- Database Port: 54322
- Studio Port: 54323
- Email Testing (Inbucket) Port: 54324
- Analytics Port: 54327

To work with Supabase:
```bash
cd mystica-express
supabase start    # Start local Supabase instance
supabase stop     # Stop local Supabase instance
supabase status   # Check service status
```

### Deployment

Configured for Railway deployment via `railway.json`:
- Build: `pnpm install`
- Start: `pnpm start`
- Restart policy: ON_FAILURE with max 10 retries

## Frontend (New-Mystica)

### Technology Stack
- SwiftUI for UI
- SwiftData for local persistence
- Xcode project structure

### Development
- Open `New-Mystica.xcodeproj` in Xcode
- Main app entry: `New-Mystica/New_MysticaApp.swift`
- Main view: `New-Mystica/ContentView.swift`
- Data model: `New-Mystica/Item.swift`

### Architecture
- Uses SwiftData `ModelContainer` for persistence
- Schema includes `Item` model
- Data stored persistently (not in-memory)

## Key Architecture Notes

### Backend Routes
Currently implements two basic routes:
- `/` - Index route (defined in `routes/index.js`)
- `/users` - Users route (defined in `routes/users.js`)

### Error Handling
Backend uses centralized error handling:
- 404 handler forwards to error middleware
- Error details shown only in development mode
- Errors rendered via Jade `error` template

### Frontend Data Flow
- SwiftData manages model context
- Environment injection for `modelContext`
- `@Query` property wrapper for reactive data fetching

## Common Patterns

### Adding Backend Routes
1. Create route file in `mystica-express/routes/`
2. Register in `app.js` using `app.use(path, router)`
3. Follow existing route patterns in `routes/index.js`

### Adding Frontend Views
1. Create new Swift file in `New-Mystica/New-Mystica/`
2. Import SwiftUI and SwiftData as needed
3. Use `@Environment(\.modelContext)` for data operations
4. Use `@Query` for reactive data fetching
