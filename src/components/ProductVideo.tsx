import { useEffect, useRef, useState } from "react";

interface ProductVideoProps {
  url: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsInline?: boolean;
}

type VideoKind =
  | { kind: "native"; mime?: string }
  | { kind: "hls" }
  | { kind: "youtube"; embed: string }
  | { kind: "vimeo"; embed: string };

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mpd: "application/dash+xml",
};

function detect(url: string): VideoKind {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return { kind: "youtube", embed: `https://www.youtube.com/embed/${id}` };
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts) return { kind: "youtube", embed: `https://www.youtube.com/embed/${shorts[1]}` };
      const embed = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embed) return { kind: "youtube", embed: `https://www.youtube.com/embed/${embed[1]}` };
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return { kind: "youtube", embed: `https://www.youtube.com/embed/${id}` };
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return { kind: "vimeo", embed: `https://player.vimeo.com/video/${id}` };
    }
    if (host === "player.vimeo.com") {
      return { kind: "vimeo", embed: url };
    }

    // Extension-based detection
    const ext = u.pathname.split(".").pop()?.toLowerCase() || "";

    if (ext === "m3u8") return { kind: "hls" };
    if (MIME_BY_EXT[ext]) return { kind: "native", mime: MIME_BY_EXT[ext] };

    // Extensionless or unknown (e.g. Scene7 dynamic media) — let the browser sniff
    return { kind: "native" };
  } catch {
    return { kind: "native" };
  }
}

export default function ProductVideo({
  url,
  className = "",
  autoPlay = false,
  muted = false,
  loop = false,
  controls = true,
  playsInline = true,
}: ProductVideoProps) {
  const info = detect(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsReady, setHlsReady] = useState(false);

  // HLS support: use native (Safari) or dynamically import hls.js for others
  useEffect(() => {
    if (info.kind !== "hls" || !videoRef.current) return;
    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      setHlsReady(true);
      return;
    }

    let hls: any;
    let cancelled = false;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled || !video) return;
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.loadSource(url);
          hls.attachMedia(video);
          setHlsReady(true);
        } else {
          video.src = url;
        }
      })
      .catch(() => {
        if (!cancelled) video.src = url;
      });

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
    };
  }, [url, info.kind]);

  if (info.kind === "youtube" || info.kind === "vimeo") {
    const src =
      info.kind === "youtube"
        ? `${info.embed}?rel=0${autoPlay ? "&autoplay=1&mute=1" : ""}${loop ? `&loop=1&playlist=${info.embed.split("/").pop()}` : ""}`
        : `${info.embed}${info.embed.includes("?") ? "&" : "?"}${autoPlay ? "autoplay=1&muted=1&" : ""}${loop ? "loop=1&" : ""}`.replace(/[?&]$/, "");
    return (
      <iframe
        src={src}
        className={className}
        title="Product video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      controls={controls}
      playsInline={playsInline}
      preload="metadata"
    >
      {info.kind === "native" && (
        <>
          {info.mime ? (
            <source src={url} type={info.mime} />
          ) : (
            <source src={url} />
          )}
        </>
      )}
      Your browser does not support the video tag.
    </video>
  );
}