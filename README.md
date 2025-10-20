# New Mystica

A full-stack application with an Express.js backend and iOS/macOS SwiftUI frontend.

## Project Structure

```
new-mystica/
├── mystica-express/     # Backend API (Express.js + Supabase)
└── New-Mystica/         # Frontend iOS/macOS app (SwiftUI)
```

## Backend (mystica-express)

Express.js API server with Supabase integration.

### Prerequisites
- Node.js
- pnpm
- Supabase CLI (optional, for local development)

### Setup & Development

```bash
cd mystica-express
pnpm install
pnpm start
```

The server runs on `http://localhost:3000` by default.

### Supabase Local Development

```bash
cd mystica-express
supabase start   # Start local Supabase stack
supabase status  # View service URLs and credentials
supabase stop    # Stop services
```

Services available at:
- API: http://localhost:54321
- Studio: http://localhost:54323
- Database: postgresql://postgres:postgres@localhost:54322/postgres

### Deployment

Configured for Railway deployment. Push to your connected git branch to deploy.

## Frontend (New-Mystica)

Native iOS/macOS application built with SwiftUI and SwiftData.

### Prerequisites
- Xcode 15+
- macOS

### Development

1. Open `New-Mystica.xcodeproj` in Xcode
2. Select your target device/simulator
3. Press ⌘R to build and run

## Technology Stack

**Backend:**
- Express.js 4.16
- Supabase (PostgreSQL, Auth, Storage)
- pnpm package manager
- Railway hosting

**Frontend:**
- SwiftUI
- SwiftData
- Native iOS/macOS

## License

Private project
