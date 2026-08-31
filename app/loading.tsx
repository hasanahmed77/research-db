import { Bar, SkeletonRows } from "@/components/Skeleton";

export default function LibraryLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2">
        <div className="skeleton h-[34px] flex-1" />
        <div className="skeleton h-[34px] w-20" />
      </div>
      <Bar className="w-64" />
      <Bar className="w-24" />
      <SkeletonRows rows={5} />
    </div>
  );
}
