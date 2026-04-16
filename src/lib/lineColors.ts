// 지하철 노선별 배경 컬러 (공용 유틸)
export function getLineColor(line: string): string {
  const colors: Record<string, string> = {
    "1": "bg-blue-600",
    "2": "bg-green-500",
    "3": "bg-orange-500",
    "4": "bg-sky-400",
    "5": "bg-purple-500",
    "6": "bg-amber-700",
    "7": "bg-olive-600",
    "8": "bg-pink-500",
    "9": "bg-amber-400",
    "신분당": "bg-red-500",
    "분당": "bg-yellow-500",
    "경의중앙": "bg-teal-500",
    "공항": "bg-blue-400",
    "수인분당": "bg-yellow-500",
    "GTX-A": "bg-purple-700",
    "GTX-B": "bg-blue-700",
    "GTX-C": "bg-green-700",
    "서해": "bg-blue-500",
    "경춘": "bg-green-600",
    "경강": "bg-blue-800",
    "의정부": "bg-orange-400",
    "용인": "bg-yellow-600",
    "김포골드": "bg-yellow-700",
    "우이신설": "bg-green-400",
    "신림": "bg-blue-500",
  };
  return colors[line] || "bg-gray-400";
}

export function LineBadge({ line }: { line: string }) {
  return (
    <span className={`${getLineColor(line)} text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>
      {line}
    </span>
  );
}
