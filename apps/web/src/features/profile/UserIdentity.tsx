import { UserFlag } from "./UserFlag";
import { OnlineStatusDot } from "../../components/ui/OnlineStatusDot";

interface UserIdentityProps {
  nickname: string;
  country: string | null;
  rating?: number;
  online?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserIdentity({
  nickname,
  country,
  rating,
  online,
  size = "md",
  className = "",
}: UserIdentityProps): JSX.Element {
  const textSize =
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg font-semibold" : "text-base";
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {online !== undefined && (
        <OnlineStatusDot online={online} size={size === "md" ? "md" : "sm"} />
      )}
      <span className={textSize}>{nickname}</span>
      <UserFlag country={country} size={size === "sm" ? "sm" : "md"} />
      {rating !== undefined && (
        <span className="text-text-secondary text-sm">({rating})</span>
      )}
    </span>
  );
}
