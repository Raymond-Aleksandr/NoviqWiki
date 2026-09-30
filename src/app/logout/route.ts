import { redirect } from "next/navigation";
import { invalidateCurrentSession } from "@/modules/auth/session";

export async function POST() {
  await invalidateCurrentSession();
  redirect("/");
}
