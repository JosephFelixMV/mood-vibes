import { useProxiedImage } from "@/hooks/useProxiedImage";

interface ProxiedImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

/**
 * Drop-in <img> replacement that routes through the image proxy cache.
 * Shows the original URL immediately, swaps to cached version once resolved.
 */
export default function ProxiedImg({ src, ...props }: ProxiedImgProps) {
  const proxiedSrc = useProxiedImage(src);
  return <img {...props} src={proxiedSrc || src} />;
}
