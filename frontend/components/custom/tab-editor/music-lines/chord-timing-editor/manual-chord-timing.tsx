import useTabContext from "../../tab-context-main"

export default function ManualChordTiming() {
  const { bpm } = useTabContext()
  return (
    <div className="flex flex-col gap-2">
      <p>Manual timing</p>

      {/* Main bar grid ui */}
      <div className="h-24 border-y">
        <div className="flex h-full px-2">
          <div className="relative w-px">
            {/* Visually indicate the end of the last bar */}
            <div className="h-full w-0 border-r border-dashed" />
            <span className="text-muted-foreground/50 absolute -bottom-5 -left-0.75 text-sm leading-4">
              4
            </span>
          </div>
          <div className="flex h-full grow justify-between px-8">
            <div className="relative w-px">
              <div className="bg-border h-full w-px" />
              <span className="text-muted-foreground absolute -bottom-5 -left-0.75 text-sm leading-4">
                1
              </span>
            </div>

            <div className="relative w-px">
              <div className="bg-border h-full w-px" />
              <span className="text-muted-foreground absolute -bottom-5 -left-0.75 text-sm leading-4">
                2
              </span>
            </div>
            <div className="relative w-px">
              <div className="bg-border h-full w-px" />
              <span className="text-muted-foreground absolute -bottom-5 -left-0.75 text-sm leading-4">
                3
              </span>
            </div>
            <div className="relative w-px">
              <div className="bg-border h-full w-px" />
              <span className="text-muted-foreground absolute -bottom-5 -left-0.75 text-sm leading-4">
                4
              </span>
            </div>
          </div>
          <div className="relative w-px">
            {/* Visually indicate the start of the next bar */}
            <div className="h-full w-0 border-r border-dashed" />
            <span className="text-muted-foreground/50 absolute -bottom-5 -left-0.75 text-sm leading-4">
              1
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
