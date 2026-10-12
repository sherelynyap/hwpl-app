// IMPORTANT: never call the Anthropic (or any LLM) API directly from the
// app with a hardcoded key — it would ship inside the app bundle and be
// extractable. Instead, this hits a small backend endpoint you control
//
// Set this to your deployed endpoint once you have one running.
const SUMMARY_ENDPOINT = 'https://hwpl-backend.vercel.app/api/summarize';

function parseNoteCategories(categoryValue) {
  if (!categoryValue) return [];
  return String(categoryValue)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function generateAISummary(report, period, taggedNotes = []) {
  const payload = {
    period, // 'week' | 'month'
    categories: Object.fromEntries(
      Object.entries(report).map(([category, data]) => {
        const ratingNotes = data.entries.map((entry) => entry.note).filter(Boolean);
        const notesForCategory = taggedNotes
          .filter((note) => parseNoteCategories(note.category).includes(category))
          .map((note) => note.content);
        return [category, {
          average: data.average,
          count: data.count,
          notes: [...ratingNotes, ...notesForCategory],
        }];
      })
    ),
  };

  const response = await fetch(SUMMARY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Summary endpoint returned ${response.status}`);
  }

  const data = await response.json();
  return data.summary;
}
