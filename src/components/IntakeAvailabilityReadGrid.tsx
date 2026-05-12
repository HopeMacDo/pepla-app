import type { IntakeAvailability } from "../lib/models";

const DAY_KEYS = ["tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const SLOT_ROWS = [
  { key: "mornings" as const, label: "AM", ariaSlot: "Mornings" },
  { key: "afternoons" as const, label: "PM", ariaSlot: "Afternoons" }
] as const;

type DayKey = (typeof DAY_KEYS)[number];

function isSelected(selections: IntakeAvailability, slotKey: (typeof SLOT_ROWS)[number]["key"], day: DayKey) {
  return selections[slotKey][day];
}

export type IntakeAvailabilityReadGridProps = {
  selections: IntakeAvailability;
  className?: string;
};

export default function IntakeAvailabilityReadGrid({ selections, className }: IntakeAvailabilityReadGridProps) {
  return (
    <div className={className}>
      <div
        className="inline-grid w-full max-w-md gap-x-2 gap-y-2.5"
        style={{ gridTemplateColumns: `auto repeat(${DAY_KEYS.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Preferred availability by day and time of day"
      >
        <div aria-hidden="true" />
        {DAY_KEYS.map((day, i) => (
          <div
            key={day}
            className="text-center font-display text-[10px] uppercase tracking-pepla text-slateGrey/55"
          >
            {DAY_LABELS[i]}
          </div>
        ))}

        {SLOT_ROWS.map((row) => (
          <div key={row.key} className="contents">
            <div className="flex items-center font-display text-[10px] uppercase tracking-pepla text-slateGrey/55">
              <span title={row.ariaSlot}>{row.label}</span>
            </div>
            {DAY_KEYS.map((day, dayIdx) => {
              const on = isSelected(selections, row.key, day);
              return (
                <div key={`${row.key}-${day}`} className="flex min-h-[1.125rem] items-center justify-center">
                  <span
                    className={[
                      "h-3 w-full max-w-[3rem] rounded-sm",
                      on ? "bg-sky/85" : "border border-slateGrey/12 bg-chalk/50"
                    ].join(" ")}
                    role="img"
                    aria-label={`${row.ariaSlot} ${DAY_LABELS[dayIdx]}: ${on ? "available" : "not selected"}`}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
