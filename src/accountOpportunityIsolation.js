export async function runIsolatedAccountOpportunity(task, dateStr, contextLabel) {
  try {
    return await task();
  } catch (error) {
    const message = error?.message || String(error);
    console.error(
      `[Scheduled][AccountOpportunity] Isolated ${contextLabel} failure for ${dateStr}: ${message}`
    );
    return {
      date: dateStr,
      mode: "account-opportunity",
      accountOpportunityPublished: false,
      accountOpportunityIsolatedFailure: true,
      error: message,
    };
  }
}
