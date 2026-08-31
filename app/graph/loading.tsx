import { Bar } from "@/components/Skeleton";

export default function GraphLoading() {
  return (
    <div className="space-y-4">
      <Bar className="w-48" />
      <div className="skeleton h-[34px] w-full" />
      <div className="glass h-[calc(100vh-14rem)] min-h-96" />
    </div>
  );
}
