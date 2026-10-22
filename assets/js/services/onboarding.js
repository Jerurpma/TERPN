const GOAL_LABELS = Object.freeze({
  learn: 'Learn terpene basics',
  journal: 'Track personal patterns',
  pairing: 'Explore flavor and aroma pairing',
  mindful: 'Build mindful reflection habits'
});

const AROMA_TO_TERPENES = Object.freeze({
  citrus: ['Limonene', 'Terpinolene', 'Ocimene'],
  floral: ['Linalool', 'Ocimene', 'Terpinolene'],
  forest: ['Alpha-pinene', 'Humulene', 'Terpinolene'],
  spice: ['Beta-caryophyllene', 'Humulene', 'Myrcene']
});

export function onboardingScore(profile) {
  if (!profile) return 0;
  const fields = ['name', 'goal', 'aroma', 'sensitivity'];
  const complete = fields.filter(field => String(profile[field] || '').trim()).length;
  return Math.round((complete / fields.length) * 100);
}

export function starterPath(profile) {
  if (!profile) return null;
  const selected = AROMA_TO_TERPENES[profile.aroma] || AROMA_TO_TERPENES.citrus;
  const goal = GOAL_LABELS[profile.goal] || GOAL_LABELS.learn;
  return {
    title: goal,
    selected,
    steps: [
      `Start with ${selected.slice(0, 2).join(' and ')} as comparison anchors.`,
      'Log aroma, setting, before/after reflections, and notes without treating them as medical outcomes.',
      'Review three or more entries before looking for personal pattern language.',
      'Export a backup before testing backend or account flags.'
    ]
  };
}
