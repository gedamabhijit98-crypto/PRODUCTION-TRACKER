export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  res.status(200).json({
    url: process.env.VERCEL_SUPABASE_URL || '',
    key: process.env.VERCEL_SUPABASE_ANON_KEY || ''
  });
}