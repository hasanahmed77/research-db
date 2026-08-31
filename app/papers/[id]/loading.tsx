import { Bar } from "@/components/Skeleton";

export default function PaperLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <section className="space-y-3">
        <Bar className="h-6 w-2/3" />
        <Bar className="w-1/3" />
        <div className="flex gap-2 pt-1">
          <div className="skeleton h-[34px] w-32" />
          <div className="skeleton h-[34px] w-40" />
          <div className="skeleton h-[34px] w-24" />
        </div>
      </section>

      <section className="space-y-2">
        <Bar className="w-20" />
        <div className="skeleton h-[88px] w-full" />
      </section>

      <section className="space-y-6">
        <Bar className="w-40" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Bar className="h-4 w-1/2" />
            <Bar className="w-3/4" />
            <div className="skeleton h-[88px] w-full" />
          </div>
        ))}
      </section>
    </div>
  );
}
