type RecipeSection = 'ingredients' | 'steps' | 'nutritionTips' | 'cautions' | 'audience';

const sectionLabels: Record<RecipeSection, string[]> = {
  ingredients: ['食材', 'Ingredients'],
  steps: ['做法步骤', 'Cooking steps', 'Tutorial'],
  nutritionTips: ['营养提示', 'Nutrition tips'],
  cautions: ['注意事项', 'Cautions'],
  audience: ['适合人群', 'Suitable people']
};

function normalizeHeading(value: string) {
  return value.trim().replace(/[:：]$/, '').toLowerCase();
}

function cleanSectionLine(value: string) {
  return value
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.、]\s*/, '')
    .trim();
}

function demoteSectionHeadings(content: string) {
  const knownLabels = Object.values(sectionLabels).flat().map(normalizeHeading);
  return content
    .split('\n')
    .map(line => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (!heading) return line;
      return knownLabels.includes(normalizeHeading(heading[2])) ? `### ${heading[2].trim()}` : line;
    })
    .join('\n');
}

export function extractRecipeSectionItems(content: string | undefined, section: RecipeSection) {
  if (!content) return [];

  const lines = content.split('\n');
  const labels = sectionLabels[section].map(normalizeHeading);
  const items: string[] = [];
  let isInSection = false;

  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      isInSection = labels.includes(normalizeHeading(heading[1]));
      continue;
    }

    if (!isInSection) continue;
    const item = cleanSectionLine(line);
    if (item) items.push(item);
  }

  return items;
}

export function ensureRecipeTitle(title: string, content: string | undefined) {
  const cleanContent = demoteSectionHeadings(String(content || '').trim());
  if (!title.trim()) return cleanContent;
  if (!cleanContent) return `## ${title.trim()}`;

  const firstHeading = cleanContent.match(/^#{1,3}\s+(.+)$/m);
  if (firstHeading && normalizeHeading(firstHeading[1]) === normalizeHeading(title)) {
    return cleanContent;
  }

  return `## ${title.trim()}\n\n${cleanContent}`;
}

export function buildRecipeMarkdown(options: {
  title: string;
  ingredients: string[];
  steps: string[];
  nutritionTips: string[];
  cautions: string[];
  audience: string[];
  t: (key: any) => string;
}) {
  const { title, ingredients, steps, nutritionTips, cautions, audience, t } = options;

  return [
    `## ${title}`,
    ingredients.length ? `### ${t('ingredients')}\n${ingredients.map(item => `- ${item}`).join('\n')}` : '',
    steps.length ? `### ${t('cookingSteps')}\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}` : `### ${t('cookingSteps')}\n${t('noRecipeContent')}`,
    nutritionTips.length ? `### ${t('nutritionTips')}\n${nutritionTips.map(item => `- ${item}`).join('\n')}` : '',
    cautions.length ? `### ${t('cautions')}\n${cautions.map(item => `- ${item}`).join('\n')}` : '',
    audience.length ? `### ${t('suitablePeople')}\n${audience.map(item => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');
}
