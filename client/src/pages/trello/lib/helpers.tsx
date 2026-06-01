import type React from "react";

export const EMOJI_MAP: Record<string, string> = {
  white_check_mark: "✅", heavy_check_mark: "✔️", x: "❌", warning: "⚠️",
  red_circle: "🔴", large_blue_circle: "🔵", green_circle: "🟢", yellow_circle: "🟡",
  orange_circle: "🟠", purple_circle: "🟣", brown_circle: "🟤", black_circle: "⚫",
  white_circle: "⚪", fire: "🔥", tada: "🎉", rocket: "🚀", star: "⭐",
  thumbsup: "👍", thumbsdown: "👎", eyes: "👀", raised_hands: "🙌",
  clap: "👏", pray: "🙏", muscle: "💪", wave: "👋", point_right: "👉",
  point_left: "👈", point_up: "👆", point_down: "👇", ok_hand: "👌",
  heavy_exclamation_mark: "❗", question: "❓", exclamation: "❗",
  clock1: "🕐", hourglass: "⏳", calendar: "📅", memo: "📝", pencil: "✏️",
  mag: "🔍", link: "🔗", paperclip: "📎", chart_with_upwards_trend: "📈",
  chart_with_downwards_trend: "📉", bar_chart: "📊", bulb: "💡", hammer: "🔨",
  wrench: "🔧", lock: "🔒", unlock: "🔓", bell: "🔔", no_bell: "🔕",
  email: "📧", phone: "📞", computer: "💻", iphone: "📱", gear: "⚙️",
  recycle: "♻️", white_large_square: "⬜", black_large_square: "⬛",
  arrow_right: "➡️", arrow_left: "⬅️", arrow_up: "⬆️", arrow_down: "⬇️",
};

export function parseEmojis(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+\-]+):/g, (match, code) => EMOJI_MAP[code] ?? match);
}

export function renderMarkdown(text: string): React.ReactNode[] {
  const withEmoji = parseEmojis(text);
  const parts = withEmoji.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function urgencyColor(dias: number) {
  if (dias >= 14) return { bg: "bg-red-100 dark:bg-red-900/30", badge: "bg-red-500", text: "text-red-700 dark:text-red-300" };
  if (dias >= 7)  return { bg: "bg-orange-100 dark:bg-orange-900/30", badge: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" };
  return { bg: "bg-yellow-50 dark:bg-yellow-900/20", badge: "bg-yellow-400", text: "text-yellow-700 dark:text-yellow-300" };
}

export const LABEL_COLORS: Record<string, string> = {
  red: "bg-red-400",
  orange: "bg-orange-400",
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  purple: "bg-purple-400",
  pink: "bg-pink-400",
  sky: "bg-sky-400",
  lime: "bg-lime-400",
  black: "bg-gray-700",
  null: "bg-gray-300",
};
