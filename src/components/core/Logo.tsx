import { FC } from "react";
import { cn } from "@/lib/styles";
import { APP_NAME } from "@/lib/constants";

type LogoProps = {
  className?: string;
};

const Logo: FC<LogoProps> = ({ className }) => <span className={cn("font-logo text-3xl", className)}>{APP_NAME}</span>;

export default Logo;
