import { useEffect, useState } from "react";
export default function PhotoImage({
  blob,
  alt,
  ...props
}: { blob: Blob; alt: string } & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? <img src={url} alt={alt} {...props} /> : null;
}
