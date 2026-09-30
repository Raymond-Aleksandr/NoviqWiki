import { z } from "zod";
import { apiError, empty, ok } from "@/modules/api/responses";
import { requireApiContext } from "@/modules/api/auth";
import { deleteMedia, getMediaReferences } from "@/modules/media/service";
import { ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };
const mediaIdSchema = z.string().uuid();

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireApiContext("media.read");
    const id = mediaIdSchema.parse((await params).id);
    return ok({ references: await getMediaReferences(id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Props) {
  try {
    const { session } = await requireApiContext("media.delete", request);
    if (!session) throw new ForbiddenError("Authentication required.");
    const id = mediaIdSchema.parse((await params).id);
    const url = new URL(request.url);
    await deleteMedia({
      assetId: id,
      actorId: session.user.id,
      actorDisplayName: session.user.displayName,
      force: url.searchParams.get("force") === "true"
    });
    return empty();
  } catch (error) {
    return apiError(error);
  }
}
