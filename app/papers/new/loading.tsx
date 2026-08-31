import { Bar } from "@/components/Skeleton";

export default function NewPaperLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Bar className="h-6 w-40" />
      <div className="space-y-3">
        <Bar className="w-20" />
        <div className="skeleton h-[34px] w-full" />
        <div className="skeleton h-[88px] w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-[34px]" />)}
        </div>
      </div>
    </div>
  );
}
