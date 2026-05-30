import Link from "next/link";
import { DiceMark } from "./icons";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <span className="text-primary transition-transform group-hover:-rotate-6">
        <DiceMark size={28} />
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        aqoj
        <span className="ml-1.5 hidden text-xs font-medium text-muted sm:inline">
          à quoi on joue
        </span>
      </span>
    </Link>
  );
}
