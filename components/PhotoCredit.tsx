// Caption under a cover photo: the credit its licence requires (Wikimedia
// Commons, Unsplash) or, for an AI image, a note that it is illustrative.
// Renders nothing when the photo has no stored credit (an editor's upload).

export interface PhotoCreditInfo {
  sourceType: string;
  credit: string;
  license: string;
  sourceUrl: string;
}

export default function PhotoCredit({ info, className = "" }: { info: PhotoCreditInfo | null | undefined; className?: string }) {
  if (!info) return null;
  if (info.sourceType === "ai") {
    return <figcaption className={className}>Illustrative image generated with AI. It does not show the actual place or event.</figcaption>;
  }
  if (!info.credit) return null;
  return (
    <figcaption className={className}>
      Photo:{" "}
      {info.sourceUrl ? (
        <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {info.credit}
        </a>
      ) : (
        info.credit
      )}
      {info.license ? ` · ${info.license}` : ""}
    </figcaption>
  );
}
