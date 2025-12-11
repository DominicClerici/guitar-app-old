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
      viewBox="0 0 10 10"
      aria-hidden="true"
      stroke="currentColor"
      fill="none"
      className={cn("h-2.5 w-2.5 stroke-2", className)}
    >
      <g fillRule="evenodd">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          className={
            overrideGroupName
              ? "opacity-0 transition-opacity duration-150 group-hover/arrow:opacity-100"
              : "hover-arrow-path"
          }
          d="M0 5h7"
        ></path>
        <path
          className={`transition-transform duration-150 ${overrideGroupName ? "group-hover/arrow:translate-x-[3.5px]" : "group-hover:translate-x-[3.5px]"}`}
          strokeDasharray={0}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1 1.5l3.5 3.5-3.5 3.5"
        ></path>
      </g>
    </svg>
  )
}
