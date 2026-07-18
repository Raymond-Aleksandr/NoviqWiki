Object.assign(process.env, {
  NODE_ENV: "test",
  NOVIQWIKI_SECRET: "test-secret-test-secret-test-secret-1234",
  DATABASE_URL: "postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_test",
  NOVIQWIKI_MEDIA_ROOT: "./test-results/media"
});
