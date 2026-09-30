import type { SetupMessages } from "../messages";
import type { SetupValues } from "../model";

export function StorageStep({
  mediaDriver,
  messages
}: {
  mediaDriver: SetupValues["mediaDriver"];
  messages: Pick<SetupMessages, "localFilesystem" | "localFilesystemDescription" | "s3Storage" | "s3StorageDescription">;
}) {
  return (
    <div className="setup-choice-grid">
      <div className="setup-choice">
        <span>
          <strong>{mediaDriver === "local" ? messages.localFilesystem : messages.s3Storage}</strong>
          <small>{mediaDriver === "local" ? messages.localFilesystemDescription : messages.s3StorageDescription}</small>
        </span>
      </div>
    </div>
  );
}
