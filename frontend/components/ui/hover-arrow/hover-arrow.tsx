import { cn } from "@/lib/utils"
import "./hover-arrow.css"

// ? Make sure that whatever component wraps this has a 'group' class

export default function HoverArrow({
  className,
  overrideGroupName = false,
}: {
  className?: string
  overrideGroupName?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      stroke="currentColor"
      fill="none"
      className={cn("size-4 stroke-2", className)}
    >
      <g fillRule="evenodd">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            overrideGroupName
              ? "hover-arrow-path opacity-0 transition-opacity duration-150 group-hover/arrow:opacity-100"
              : "hover-arrow-path"
          }
          d="M7 12h14"
        ></path>
        <path
          className={`-translate-x-[2px] transition-transform duration-150 ${overrideGroupName ? "group-hover/arrow:translate-x-[4px]" : "group-hover:translate-x-[4px]"}`}
          strokeDasharray={0}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 5l7 7-7 7"
        ></path>
      </g>
    </svg>
  )
}
