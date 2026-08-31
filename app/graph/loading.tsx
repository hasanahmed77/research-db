import { Bar } from "@/components/Skeleton";

export default function GraphLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Bar className="w-48" />
      <div className="skeleton h-[34px] w-full" />
      <div className="glass min-h-96 flex-1" />
    </div>
  );
}
