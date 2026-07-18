import { prepareStandaloneAssets } from "./standalone-assets";

prepareStandaloneAssets().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
