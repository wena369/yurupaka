window.YURUPAKA_SUPABASE = {
  // Supabase Project Settings > API からコピーしてください。
  url: 'https://hfkuuqsauzrhnasvanpv.supabase.co',
  // anon public key を設定してください。service_role key は絶対に入れないでください。
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhma3V1cXNhdXpyaG5hc3ZhbnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODM4NTUsImV4cCI6MjA5MTA1OTg1NX0.wcMTb75HqApi3oG6sqslK2iX4gsyEeoUlp5sjLss1qo',
  // Storage の公開バケット名。SQL例では yurupaka-media を使います。
  bucket: 'yurupaka-media',
  // events テーブルに tenant_id が必須で残っている場合だけ設定します。
  // このサイト単独運用では、Supabase側で tenant_id の NOT NULL を外すのがおすすめです。
  tenantId: ''
};
