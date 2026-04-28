export const getSmartSearchFilters = async (_query: string) => null;

export const summarizePatientHistory = async (frontDeskId?: string | null) => {
  if (!frontDeskId) return 'Summary unavailable.';

  try {
    const response = await fetch('/api/ai/case-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ frontDeskId }),
    });

    if (!response.ok) {
      throw new Error('Case summary unavailable');
    }

    const data = await response.json();
    return data.summary || 'Summary unavailable.';
  } catch (error) {
    console.error('AI Summarization Error:', error);
    return 'Summary unavailable.';
  }
};

export const generateClinicalSuggestions = async (symptoms: string, clinicId?: string) => {
  try {
    const response = await fetch('/api/ai/clinical-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clinicId ? { 'x-clinic-id': clinicId } : {}),
      },
      body: JSON.stringify({ symptoms }),
    });

    if (!response.ok) {
      throw new Error('Clinical suggestions unavailable');
    }

    const data = await response.json();
    return Array.isArray(data.suggestions) ? data.suggestions : [];
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    return [];
  }
};
