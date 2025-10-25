import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📍 Environment: ${env.NODE_ENV}`);
  console.log(`🔗 Supabase URL: ${env.SUPABASE_URL}`);
});
