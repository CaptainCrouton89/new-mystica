import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Supabase URL: ${env.SUPABASE_URL}`);
});
