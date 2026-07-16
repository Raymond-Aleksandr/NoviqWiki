Object.assign(process.env, {
  NODE_ENV: "test",
  NEXTWIKI_SECRET: "test-secret-test-secret-test-secret-1234",
  DATABASE_URL: "postgres://nextwiki:nextwiki@localhost:5432/nextwiki_test",
  NEXTWIKI_MEDIA_ROOT: "./test-results/media"
});
