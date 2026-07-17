import "dotenv/config";

import { resetE2eDatabase } from "./e2e-support";

async function main() {
  const reset = await resetE2eDatabase();
  console.log(
    `Reset and migrated e2e database schema (${reset.databaseLabel}${
      reset.createdDatabase ? ", created database" : ""
    }).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
