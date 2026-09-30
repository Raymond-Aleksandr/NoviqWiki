import "dotenv/config";
import { sqlClient } from "@/db/client";
import { getPrimarySite } from "@/db/site";
import { rebuildSearchIndex } from "@/modules/search/service";

async function main() {
  const site = await getPrimarySite();
  if (!site) {
    console.log("No site exists; search index was not rebuilt.");
  } else {
    const count = await rebuildSearchIndex(site.id);
    console.log(`Rebuilt search index for ${count} page(s).`);
  }
  await sqlClient.end({ timeout: 5 });
}

void main();
