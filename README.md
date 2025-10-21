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

### Setup & Development

```bash
cd mystica-express
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your remote Supabase credentials

# Development server
pnpm dev

# Production build
pnpm build
pnpm start
```

The server runs on `http://localhost:3000` by default and connects to remote Supabase.

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
- Express.js 4.18
- Supabase (remote PostgreSQL with PostGIS, Auth, Storage)
- pnpm package manager
- Railway hosting

**Frontend:**
- SwiftUI
- SwiftData
- Native iOS/macOS

## License

Private project
