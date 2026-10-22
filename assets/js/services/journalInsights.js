function splitTerpenes(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function increment(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map, limit = 3) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function computeJournalInsights(entries = []) {
  const terpeneCounts = new Map();
  const moodCounts = new Map();
  const settingCounts = new Map();

  entries.forEach(entry => {
    splitTerpenes(entry.terpenes).forEach(terpene => increment(terpeneCounts, terpene));
    increment(moodCounts, entry.after || 'Neutral');
    increment(settingCounts, entry.setting || 'Unspecified');
  });

  const sortedDates = entries
    .map(entry => entry.date)
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));

  return {
    totalEntries: entries.length,
    latestDate: sortedDates.at(-1) || 'No entries yet',
    topTerpenes: topEntries(terpeneCounts),
    topMoods: topEntries(moodCounts),
    topSettings: topEntries(settingCounts),
    hasEnoughForPatterns: entries.length >= 3
  };
}
