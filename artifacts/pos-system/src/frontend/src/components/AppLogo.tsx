import { useState } from "react";
import { useGetSettings } from "@workspace/api-client-react";

const OFFICIAL_LOGO = "/assets/images/omnisystem_pro_logo_1784250216808.png";

const LOGO_SOURCES = [
  OFFICIAL_LOGO,
  "/omnisystem-logo.png",
  "/assets/images/omnisystem_pro_logo_1784250216808.jpg",
  "/assets/images/omnisystem_logo_1783814567998.jpg",
];

const ICON_SOURCES = [
  OFFICIAL_LOGO,
  "/omnisystem-logo.png",
  "/assets/images/omnisystem_pro_logo_1784250216808.jpg",
  "/assets/images/omnisystem_logo_1783814567998.jpg",
];

interface LogoProps {
  src?: string;
  className?: string;
  alt?: string;
  fallback?: React.ReactNode;
  style?: React.CSSProperties;
}

export function AppLogo({
  src,
  className = "w-full h-full object-contain",
  alt = "App Logo",
  fallback,
  style,
  ...props
}: LogoProps) {
  const { data: settings } = useGetSettings();
  const systemLogoUrl = settings?.systemLogoUrl;

  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const handleError = (failingSrc?: string) => {
    if (!failingSrc) return;
    setFailedSources((prev) => {
      if (prev.has(failingSrc)) return prev;
      const next = new Set(prev);
      next.add(failingSrc);
      return next;
    });
  };

  const candidateSources = [
    systemLogoUrl,
    src,
    ...LOGO_SOURCES
  ].filter((s): s is string => Boolean(s && typeof s === "string" && s.trim() !== "" && !failedSources.has(s)));

  const currentSrc = candidateSources[0];

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div 
        className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black rounded-xl shadow-inner select-none"
        style={{ fontSize: "1.2rem", ...style }}
      >
        إتقان
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => handleError(currentSrc)}
      style={style}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}

export function AppIcon({
  src,
  className = "w-full h-full object-contain",
  alt = "App Icon",
  fallback,
  style,
  ...props
}: LogoProps) {
  const { data: settings } = useGetSettings();
  const systemLogoUrl = settings?.systemLogoUrl;

  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());

  const handleError = (failingSrc?: string) => {
    if (!failingSrc) return;
    setFailedSources((prev) => {
      if (prev.has(failingSrc)) return prev;
      const next = new Set(prev);
      next.add(failingSrc);
      return next;
    });
  };

  const candidateSources = [
    systemLogoUrl,
    src,
    ...ICON_SOURCES
  ].filter((s): s is string => Boolean(s && typeof s === "string" && s.trim() !== "" && !failedSources.has(s)));

  const currentSrc = candidateSources[0];

  if (!currentSrc) {
    if (fallback) return <>{fallback}</>;
    return (
      <div 
        className="w-full h-full flex items-center justify-center bg-blue-600 text-white font-bold rounded-full select-none"
        style={{ fontSize: "0.8rem", ...style }}
      >
        IS
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={() => handleError(currentSrc)}
      style={style}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}
