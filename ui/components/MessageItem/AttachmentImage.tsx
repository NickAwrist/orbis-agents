import { useEffect, useState } from "react";
import type { ImageAttachment } from "../../../src/attachments/types";
import { fetchAttachmentImage } from "../../persist/attachments";

export function AttachmentImage({
  attachment,
}: {
  attachment: ImageAttachment;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetchAttachmentImage(attachment.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id]);

  if (!url) {
    return (
      <div className="flex h-32 w-44 items-center justify-center rounded-lg border border-border-subtle bg-background/30 px-3 text-center text-xs text-muted-foreground">
        {attachment.name}
      </div>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" title={attachment.name}>
      <img
        src={url}
        alt={attachment.name}
        className="max-h-72 max-w-full rounded-lg border border-border-subtle object-contain"
      />
    </a>
  );
}
